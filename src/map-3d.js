// Map-integrated 3D view with two honest data scales, loaded only when opened:
// - "crater": a qualitative 3D shape from 8-bit MOLA grayscale tiles, not verified metric elevations, under NASA imagery;
// - "delta": the 2 km delta-front clip on USGS CTX heights (20 m grid) under HiRISE at ~1.2 m/pixel.
import { loadJezeroDem } from "./bundled-dem.js";
import { MAP_LAYERS } from "./constants.js";

const R = 3396190;
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const CONTROLS_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
const TREK = "https://trek.nasa.gov/tiles/Mars/EQ/";
const MOLA_URL = TREK + "Mars_MGS_MOLA_DEM_mosaic_global_463m_8/1.0.0/default/default028mm/";
const MOLA_ZOOM = 5;
// The conversion below assumes a linear 8-bit intensity stretch. Its calibration has NOT
// been verified against the Mars Trek rendering transfer function; one CTX sample cannot
// validate the whole image. Use this only to shape a qualitative crater preview, never
// to report quantitative elevations or slopes. The CTX numeric DEM is the metered source.
const MOLA_MIN_METERS = -8201;
const MOLA_METERS_PER_LEVEL = 29430 / 255;
const CRATER_BOUNDS = { north: 18.9, south: 18.0, west: 77.0, east: 77.9 };
const CRATER_GRID = 121;
const VIKING_URL = MAP_LAYERS.find(layer => layer.id === "viking").url + "/default/default028mm/";
const HIRISE_URL = MAP_LAYERS.find(layer => layer.id === "hirise").url + "/default/default028mm/";
const HIRISE_COVERAGE = MAP_LAYERS.find(layer => layer.id === "hirise").coverage;

let deltaPromise = null;

export function demBounds(dem)
{
    return { north: dem.north, south: dem.north - dem.latStep * dem.height, west: dem.west, east: dem.west + dem.lonStep * dem.width };
}

export function pointsInside(bounds, points)
{
    return points.filter(point => point.lat <= bounds.north && point.lat >= bounds.south && point.lon >= bounds.west && point.lon <= bounds.east);
}

export function molaGreyToMeters(grey)
{
    return MOLA_MIN_METERS + grey * MOLA_METERS_PER_LEVEL;
}

function reducedMotion()
{
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function tilePixel(zoom)
{
    const scale = 256 * 2 ** zoom;
    return { x: lon => (lon + 180) / 360 * scale * 2, y: lat => (90 - lat) / 180 * scale };
}

function loadImage(url)
{
    return new Promise((resolve, reject) =>
    {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

// Draws the tiles of one layer that cover `bounds` into a canvas cropped exactly to those bounds.
async function drawLayer(context, size, bounds, base, zoom, extension, onTile)
{
    const pixel = tilePixel(zoom);
    const x0 = Math.floor(pixel.x(bounds.west) / 256), x1 = Math.floor(pixel.x(bounds.east) / 256);
    const y0 = Math.floor(pixel.y(bounds.north) / 256), y1 = Math.floor(pixel.y(bounds.south) / 256);
    const scaleX = size.width / (pixel.x(bounds.east) - pixel.x(bounds.west));
    const scaleY = size.height / (pixel.y(bounds.south) - pixel.y(bounds.north));
    const jobs = [];

    for (let y = y0; y <= y1; y++)
    {
        for (let x = x0; x <= x1; x++)
        {
            jobs.push(loadImage(base + zoom + "/" + y + "/" + x + "." + extension).then(image =>
            {
                context.drawImage(image, (x * 256 - pixel.x(bounds.west)) * scaleX, (y * 256 - pixel.y(bounds.north)) * scaleY, 256 * scaleX + 0.5, 256 * scaleY + 0.5);
                onTile?.();
            }, () => onTile?.()));
        }
    }

    await Promise.all(jobs);
    return jobs.length;
}

async function craterGrid()
{
    const bounds = CRATER_BOUNDS;
    const pixel = tilePixel(MOLA_ZOOM);
    const x0 = Math.floor(pixel.x(bounds.west) / 256), x1 = Math.floor(pixel.x(bounds.east) / 256);
    const y0 = Math.floor(pixel.y(bounds.north) / 256), y1 = Math.floor(pixel.y(bounds.south) / 256);
    const canvas = document.createElement("canvas");
    canvas.width = (x1 - x0 + 1) * 256;
    canvas.height = (y1 - y0 + 1) * 256;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    for (let y = y0; y <= y1; y++)
    {
        for (let x = x0; x <= x1; x++)
        {
            context.drawImage(await loadImage(MOLA_URL + MOLA_ZOOM + "/" + y + "/" + x + ".png"), (x - x0) * 256, (y - y0) * 256);
        }
    }

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const grey = (px, py) =>
    {
        const cx = Math.max(0, Math.min(canvas.width - 1, px)), cy = Math.max(0, Math.min(canvas.height - 1, py));
        return data[(cy * canvas.width + cx) * 4];
    };
    const elevations = [];
    const latStep = (bounds.north - bounds.south) / (CRATER_GRID - 1);
    const lonStep = (bounds.east - bounds.west) / (CRATER_GRID - 1);

    for (let row = 0; row < CRATER_GRID; row++)
    {
        for (let column = 0; column < CRATER_GRID; column++)
        {
            // Bilinear interpolation between the ~1.3 km MOLA samples; it smooths, it does not add detail.
            const fx = pixel.x(bounds.west + column * lonStep) - x0 * 256 - 0.5;
            const fy = pixel.y(bounds.north - row * latStep) - y0 * 256 - 0.5;
            const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
            const value = grey(ix, iy) * (1 - tx) * (1 - ty) + grey(ix + 1, iy) * tx * (1 - ty) + grey(ix, iy + 1) * (1 - tx) * ty + grey(ix + 1, iy + 1) * tx * ty;
            elevations.push(molaGreyToMeters(value));
        }
    }

    return { width: CRATER_GRID, height: CRATER_GRID, north: bounds.north, west: bounds.west, latStep, lonStep, elevations };
}

async function craterTexture(THREE, maxSize, onProgress)
{
    const bounds = CRATER_BOUNDS;
    const canvas = document.createElement("canvas");
    const aspect = (bounds.north - bounds.south) / ((bounds.east - bounds.west) * Math.cos(18.45 * Math.PI / 180));
    canvas.width = Math.min(maxSize, 2048);
    canvas.height = Math.round(canvas.width * aspect);
    const context = canvas.getContext("2d");
    context.fillStyle = "#3a2b26";
    context.fillRect(0, 0, canvas.width, canvas.height);
    let done = 0;
    const tick = () => onProgress(++done);
    await drawLayer(context, canvas, bounds, VIKING_URL, 7, "jpg", tick);
    // HiRISE is greyscale with transparent gaps; drawn only over its own footprint, Viking colour stays elsewhere.
    const hirise = { north: Math.min(bounds.north, HIRISE_COVERAGE.north), south: Math.max(bounds.south, HIRISE_COVERAGE.south), west: Math.max(bounds.west, HIRISE_COVERAGE.west), east: Math.min(bounds.east, HIRISE_COVERAGE.east) };
    const sub = document.createElement("canvas");
    sub.width = Math.round(canvas.width * (hirise.east - hirise.west) / (bounds.east - bounds.west));
    sub.height = Math.round(canvas.height * (hirise.north - hirise.south) / (bounds.north - bounds.south));
    await drawLayer(sub.getContext("2d"), sub, hirise, HIRISE_URL, 11, "png", tick);
    // Luminosity blending keeps the Viking colour and takes only the HiRISE detail, so the footprint does not read as a grey patch.
    context.globalCompositeOperation = "luminosity";
    context.drawImage(sub, canvas.width * (hirise.west - bounds.west) / (bounds.east - bounds.west), canvas.height * (bounds.north - hirise.north) / (bounds.north - bounds.south));
    context.globalCompositeOperation = "source-over";
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

async function deltaTexture(THREE, bounds, maxSize, onProgress)
{
    const pixel = tilePixel(15);
    const width = Math.min(maxSize, 2048, Math.round(pixel.x(bounds.east) - pixel.x(bounds.west)));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width * (pixel.y(bounds.south) - pixel.y(bounds.north)) / (pixel.x(bounds.east) - pixel.x(bounds.west)));
    let done = 0;
    // Mars Trek serves the Jezero HiRISE mosaic down to zoom 17; zoom 15 is about 1.2 m per pixel over the 2 km clip.
    await drawLayer(canvas.getContext("2d"), canvas, bounds, HIRISE_URL, 15, "png", () => onProgress(++done));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function sampleGrid(grid, point)
{
    const column = (point.lon - grid.west) / grid.lonStep;
    const row = (grid.north - point.lat) / grid.latStep;

    if (column < 0 || row < 0 || column > grid.width - 1 || row > grid.height - 1)
    {
        return null;
    }

    const c = Math.min(grid.width - 2, Math.floor(column)), r = Math.min(grid.height - 2, Math.floor(row));
    const tx = column - c, ty = row - r;
    const at = (rr, cc) => grid.elevations[rr * grid.width + cc];
    const values = [at(r, c), at(r, c + 1), at(r + 1, c), at(r + 1, c + 1)];

    if (values.some(value => value === null))
    {
        return null;
    }

    return values[0] * (1 - tx) * (1 - ty) + values[1] * tx * (1 - ty) + values[2] * (1 - tx) * ty + values[3] * tx * ty;
}

const COPY = {
    crater: { eyebrow: "JEZERO CRATER · 3D", text: "Whole-crater visualization from NASA MOLA 8-bit grayscale imagery and Viking/HiRISE context. Vertical mapping is illustrative and not calibrated in meters. Use Delta detail for a documented numeric DEM.", switchLabel: "Delta detail · 20 m" },
    delta: { eyebrow: "DELTA FRONT · 3D DETAIL", text: "USGS CTX heights (20 m grid) with NASA HiRISE imagery (~1.2 m/pixel). Height is exaggerated for readability.", switchLabel: "Whole crater" }
};

export async function openMap3d({ host, points = [], routeColor = "#ff9a6b", mode = "crater", onFocusArea, onClose })
{
    const layer = document.createElement("section");
    layer.className = "map-3d-layer";
    layer.setAttribute("aria-label", "3D terrain view");
    layer.innerHTML = `
        <div class="map-3d-canvas"></div>
        <div class="map-3d-panel">
            <div class="map-3d-eyebrow" data-3d="eyebrow"></div>
            <p class="map-3d-copy" data-3d="copy"></p>
            <label class="map-3d-range">Vertical ×<span data-3d="ex-value">3</span><input data-3d="ex" type="range" min="1" max="8" step="0.5" value="3" /></label>
            <div class="map-3d-actions">
                <button type="button" class="btn btn-accent compact" data-3d="fly">Fly in</button>
                <button type="button" class="btn btn-outline compact" data-3d="spin" aria-pressed="true">Rotate</button>
                <button type="button" class="btn btn-outline compact" data-3d="switch"></button>
            </div>
            <p class="map-3d-route" data-3d="route"></p>
        </div>
        <button type="button" class="map-3d-close" data-3d="close" aria-label="Close 3D view">✕ 2D map</button>
        <div class="map-3d-status" role="status" data-3d="status">Loading 3D terrain…</div>`;
    host.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add("is-open"));
    const get = name => layer.querySelector(`[data-3d="${name}"]`);
    const status = get("status");
    let disposed = false;
    let renderer = null;
    let scene = null;
    let session = 0;

    const close = () =>
    {
        if (disposed) return;
        disposed = true;
        renderer?.setAnimationLoop(null);
        renderer?.dispose();
        layer.classList.remove("is-open");
        setTimeout(() => layer.remove(), reducedMotion() ? 0 : 260);
        onClose?.();
    };

    get("close").addEventListener("click", close);
    layer.addEventListener("keydown", event => { if (event.key === "Escape") close(); });

    try
    {
        const [THREE, { OrbitControls }] = await Promise.all([import(THREE_URL), import(CONTROLS_URL)]);

        if (disposed) return { close };

        const canvasHost = layer.querySelector(".map-3d-canvas");
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        canvasHost.appendChild(renderer.domElement);
        const camera = new THREE.PerspectiveCamera(45, 1, 1, 1e7);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI * 0.47;
        controls.autoRotate = !reducedMotion();
        controls.autoRotateSpeed = 0.5;
        get("spin").setAttribute("aria-pressed", String(controls.autoRotate));
        let factor = 3;
        let applyFactor = () => {};
        let flyIn = () => {};

        const resize = () =>
        {
            const box = canvasHost.getBoundingClientRect();
            renderer.setSize(box.width, box.height, false);
            camera.aspect = box.width / Math.max(1, box.height);
            camera.updateProjectionMatrix();
        };

        new ResizeObserver(resize).observe(canvasHost);
        resize();
        renderer.setAnimationLoop(() =>
        {
            controls.update();
            if (scene) renderer.render(scene, camera);
        });

        const build = async which =>
        {
            const id = ++session;
            mode = which;
            // A 1.2 km deep crater 50 km wide looks flat at true scale; the delta clip reads well at x3.
            factor = which === "crater" ? 6 : 3;
            get("ex").value = String(factor);
            get("ex-value").textContent = factor;
            get("eyebrow").textContent = COPY[which].eyebrow;
            get("copy").textContent = COPY[which].text;
            get("switch").textContent = COPY[which].switchLabel;
            status.textContent = which === "crater" ? "Loading MOLA heights…" : "Loading CTX heights…";
            const grid = which === "crater" ? await craterGrid() : await (deltaPromise ??= loadJezeroDem());

            if (disposed || id !== session) return;

            const { width, height, elevations, latStep, lonStep } = grid;
            const bounds = demBounds(grid);
            const midLat = (bounds.north + bounds.south) / 2;
            const spanX = lonStep * width * R * Math.cos(midLat * Math.PI / 180) * Math.PI / 180;
            const spanY = latStep * height * R * Math.PI / 180;
            const known = elevations.filter(value => value !== null);
            const minZ = Math.min(...known);
            const maxZ = Math.max(...known);
            const toScene = (point, elevation) => new THREE.Vector3(
                ((point.lon - bounds.west) / (bounds.east - bounds.west) - 0.5) * spanX,
                (elevation - minZ) * factor,
                ((bounds.north - point.lat) / (bounds.north - bounds.south) - 0.5) * spanY);

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0b1118);
            scene.fog = new THREE.Fog(0x0b1118, spanX * 2.2, spanX * 5);
            scene.add(new THREE.HemisphereLight(0xffe2cf, 0x1b2430, 0.9));
            const sun = new THREE.DirectionalLight(0xfff1e0, 1.6);
            sun.position.set(-spanX, spanX * 0.8, spanY * 0.6);
            scene.add(sun);
            camera.near = spanX / 2000;
            camera.far = spanX * 20;
            camera.updateProjectionMatrix();
            controls.minDistance = spanX * 0.15;
            controls.maxDistance = spanX * 3;

            const geometry = new THREE.PlaneGeometry(spanX, spanY, width - 1, height - 1);
            geometry.rotateX(-Math.PI / 2);
            const colors = new Float32Array(width * height * 3);

            for (let i = 0; i < width * height; i++)
            {
                const t = elevations[i] === null ? 0 : (elevations[i] - minZ) / Math.max(1, maxZ - minZ);
                const color = new THREE.Color().setHSL(0.05 + t * 0.03, 0.45, elevations[i] === null ? 0.05 : 0.22 + t * 0.45);
                colors.set([color.r, color.g, color.b], i * 3);
            }

            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
            scene.add(new THREE.Mesh(geometry, material));
            const overlay = new THREE.Group();
            scene.add(overlay);
            const inside = pointsInside(bounds, points);
            const sample = point => sampleGrid(grid, point);

            const drawOverlay = () =>
            {
                overlay.clear();
                const lift = spanX * 0.003;

                if (which === "crater" && deltaPromise)
                {
                    deltaPromise.then(delta =>
                    {
                        if (id !== session) return;
                        const d = demBounds(delta);
                        const corners = [[d.north, d.west], [d.north, d.east], [d.south, d.east], [d.south, d.west], [d.north, d.west]]
                            .map(([lat, lon]) => toScene({ lat, lon }, (sample({ lat, lon }) ?? minZ)).add(new THREE.Vector3(0, lift * 3, 0)));
                        overlay.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineBasicMaterial({ color: 0x75d1c8 })));
                    });
                }

                if (inside.length < 2) return;
                const dense = [];

                for (let i = 1; i < inside.length; i++)
                {
                    for (let step = 0; step <= 24; step++)
                    {
                        const t = step / 24;
                        const point = { lat: inside[i - 1].lat + (inside[i].lat - inside[i - 1].lat) * t, lon: inside[i - 1].lon + (inside[i].lon - inside[i - 1].lon) * t };
                        const elevation = sample(point);
                        if (elevation !== null) dense.push(toScene(point, elevation).add(new THREE.Vector3(0, lift * 2, 0)));
                    }
                }

                if (dense.length < 2) return;
                const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dense), dense.length * 2, spanX * 0.0025, 8, false);
                overlay.add(new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: routeColor })));

                for (const point of inside)
                {
                    const elevation = sample(point);
                    if (elevation === null) continue;
                    const marker = new THREE.Mesh(new THREE.SphereGeometry(spanX * 0.006, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                    marker.position.copy(toScene(point, elevation).add(new THREE.Vector3(0, lift * 3, 0)));
                    overlay.add(marker);
                }

                if (reducedMotion()) return;
                // Draw the route progressively along the tube.
                const totalIndices = tube.index.count;
                const start = performance.now();
                tube.setDrawRange(0, 0);
                const grow = now =>
                {
                    const t = Math.min(1, (now - start) / 1600);
                    tube.setDrawRange(0, Math.floor(totalIndices * t / 3) * 3);
                    if (t < 1 && !disposed) requestAnimationFrame(grow);
                };
                requestAnimationFrame(grow);
            };

            applyFactor = () =>
            {
                const position = geometry.attributes.position;

                for (let i = 0; i < position.count; i++)
                {
                    position.setY(i, ((elevations[i] ?? minZ) - minZ) * factor);
                }

                position.needsUpdate = true;
                geometry.computeVertexNormals();
                drawOverlay();
            };

            const routeText = inside.length >= 2
                ? `Your route: ${inside.length} waypoints shown on the terrain.`
                : points.length >= 2 ? "Your route is outside this 3D area." : "Draw two or more waypoints to see your route on the terrain.";
            get("route").innerHTML = routeText + (which === "delta" && inside.length < 2 ? ' <button type="button" class="map-3d-link" data-3d="go">Show the detailed area on the map</button>' : "");
            get("go")?.addEventListener("click", () => { onFocusArea?.({ lat: midLat, lon: (bounds.west + bounds.east) / 2 }); close(); });

            applyFactor();
            const target = new THREE.Vector3(0, (maxZ - minZ) * factor * 0.25, 0);
            const endPosition = which === "crater" ? new THREE.Vector3(spanX * 0.25, spanX * 0.8, spanY * 0.7) : new THREE.Vector3(spanX * 0.5, spanX * 0.5, spanY * 0.8);
            const startPosition = new THREE.Vector3(spanX * 0.1, spanX * 2.4, spanY * 0.15);

            flyIn = () =>
            {
                controls.target.copy(target);

                if (reducedMotion())
                {
                    camera.position.copy(endPosition);
                    return;
                }

                camera.position.copy(startPosition);
                const start = performance.now();
                const step = now =>
                {
                    const t = Math.min(1, (now - start) / 2400);
                    camera.position.lerpVectors(startPosition, endPosition, 1 - Math.pow(1 - t, 3));
                    if (t < 1 && !disposed && id === session) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            };

            flyIn();
            const sizeLabel = which === "crater" ? `${(spanX / 1000).toFixed(0)} × ${(spanY / 1000).toFixed(0)} km · illustrative MOLA relief (not meter-calibrated)` : `${Math.round(spanX)} × ${Math.round(spanY)} m · ${Math.round(maxZ - minZ)} m relief (CTX)`;
            status.textContent = sizeLabel + " · loading imagery…";
            const loader = which === "crater" ? craterTexture(THREE, renderer.capabilities.maxTextureSize, done => { if (id === session && !disposed) status.textContent = `${sizeLabel} · imagery ${done} tiles`; })
                : deltaTexture(THREE, bounds, renderer.capabilities.maxTextureSize, done => { if (id === session && !disposed) status.textContent = `${sizeLabel} · HiRISE ${done} tiles`; });

            loader.then(texture =>
            {
                if (disposed || id !== session) return;
                material.map = texture;
                material.vertexColors = false;
                material.needsUpdate = true;
                status.textContent = sizeLabel + (which === "crater" ? " · Viking + HiRISE" : " · HiRISE z15");
            }).catch(() =>
            {
                if (!disposed && id === session) status.textContent = sizeLabel + " · imagery unavailable, relief colours";
            });
        };

        deltaPromise ??= loadJezeroDem();
        get("ex").addEventListener("input", event =>
        {
            factor = Number(event.target.value);
            get("ex-value").textContent = factor;
            applyFactor();
        });
        get("fly").addEventListener("click", () => flyIn());
        get("spin").addEventListener("click", event =>
        {
            controls.autoRotate = !controls.autoRotate;
            event.currentTarget.setAttribute("aria-pressed", String(controls.autoRotate));
        });
        get("switch").addEventListener("click", () => build(mode === "crater" ? "delta" : "crater").catch(() => { status.textContent = "3D terrain could not load. Check your connection."; }));
        await build(mode);
    }
    catch
    {
        status.textContent = "3D view could not load. Check your connection and try again.";
    }

    get("close").focus();
    return { close };
}
