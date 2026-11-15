// Map-integrated 3D view with two honest data scales, loaded only when opened:
// - "crater": the whole Jezero crater on NASA MOLA heights (~1.3 km grid, interpolated) under Viking colour and HiRISE where it exists;
// - "delta": the 2 km delta-front clip on USGS CTX heights (20 m grid) under HiRISE at ~1.2 m/pixel.
import { loadJezeroDem } from "./bundled-dem.js";
import { MAP_LAYERS, JEZERO_CTX_CONTEXT } from "./constants.js";

const R = 3396190;
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const CONTROLS_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
const TREK = "https://trek.nasa.gov/tiles/Mars/EQ/";
const MOLA_URL = TREK + "Mars_MGS_MOLA_DEM_mosaic_global_463m_8/1.0.0/default/default028mm/";
const MOLA_ZOOM = 5;
// The 8-bit MOLA mosaic stretches the global range (-8201 m Hellas to +21229 m Olympus Mons) over 0-255,
// about 115.4 m per grey level. Checked against the USGS CTX clip: grey 49 at the Jezero floor gives -2546 m.
const MOLA_MIN_METERS = -8201;
const MOLA_METERS_PER_LEVEL = 29430 / 255;
const CRATER_BOUNDS = { north: 18.9, south: 18.0, west: 77.0, east: 77.9 };
const CRATER_GRID = 121;
const VIKING_URL = MAP_LAYERS.find(layer => layer.id === "viking").url + "/default/default028mm/";
const HIRISE_URL = MAP_LAYERS.find(layer => layer.id === "hirise").url + "/default/default028mm/";
const CTX_URL = JEZERO_CTX_CONTEXT.url + "/default/default028mm/";
const CTX_COVERAGE = JEZERO_CTX_CONTEXT.coverage;
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

async function craterTexture(THREE, maxSize, anisotropy, onProgress)
{
    const bounds = CRATER_BOUNDS;
    const canvas = document.createElement("canvas");
    const aspect = (bounds.north - bounds.south) / ((bounds.east - bounds.west) * Math.cos(18.45 * Math.PI / 180));
    canvas.width = Math.min(maxSize, 3072);
    canvas.height = Math.round(canvas.width * aspect);
    const context = canvas.getContext("2d");
    context.fillStyle = "#3a2b26";
    context.fillRect(0, 0, canvas.width, canvas.height);
    let done = 0;
    const tick = () => onProgress(++done);
    await drawLayer(context, canvas, bounds, VIKING_URL, 7, "jpg", tick);
    // CTX (wider, ~6 m) then HiRISE (narrower, sharper) are greyscale with transparent gaps, drawn only over their own footprint; Viking colour stays elsewhere.
    // Luminosity blending keeps the Viking colour and takes only the detail, so a footprint does not read as a grey patch.
    const zoom = canvas.width > 2048 ? 12 : 11;

    for (const [coverage, url] of [[CTX_COVERAGE, CTX_URL], [HIRISE_COVERAGE, HIRISE_URL]])
    {
        const part = { north: Math.min(bounds.north, coverage.north), south: Math.max(bounds.south, coverage.south), west: Math.max(bounds.west, coverage.west), east: Math.min(bounds.east, coverage.east) };
        const sub = document.createElement("canvas");
        sub.width = Math.round(canvas.width * (part.east - part.west) / (bounds.east - bounds.west));
        sub.height = Math.round(canvas.height * (part.north - part.south) / (bounds.north - bounds.south));
        await drawLayer(sub.getContext("2d"), sub, part, url, zoom, "png", tick);
        context.globalCompositeOperation = "luminosity";
        context.drawImage(sub, canvas.width * (part.west - bounds.west) / (bounds.east - bounds.west), canvas.height * (bounds.north - part.north) / (bounds.north - bounds.south));
        context.globalCompositeOperation = "source-over";
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    return texture;
}

async function deltaTexture(THREE, bounds, maxSize, anisotropy, onProgress)
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
    texture.anisotropy = anisotropy;
    return texture;
}

function glowTexture(THREE, stops)
{
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([at, colour]) => gradient.addColorStop(at, colour));
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
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
    crater: { eyebrow: "JEZERO CRATER · 3D", text: "Whole crater on NASA MOLA heights (~1.3 km grid, smoothed; about 115 m height steps) with Viking colour and HiRISE where it exists. Approximate relief, not exact elevations. Curvature is exaggerated.", switchLabel: "Delta detail · 20 m" },
    delta: { eyebrow: "DELTA FRONT · 3D DETAIL", text: "USGS CTX heights (20 m grid) with NASA HiRISE imagery (~1.2 m/pixel). Height and curvature are exaggerated for readability.", switchLabel: "Whole crater" }
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
    let hud = null;
    let scene = null;
    let session = 0;

    const close = () =>
    {
        if (disposed) return;
        disposed = true;
        renderer?.setAnimationLoop(null);
        scene?.traverse(object =>
        {
            object.geometry?.dispose();

            for (const material of [].concat(object.material || []))
            {
                material.map?.dispose();
                material.dispose();
            }
        });
        hud?.scene.traverse(object =>
        {
            object.geometry?.dispose();

            for (const material of [].concat(object.material || []))
            {
                material.map?.dispose();
                material.dispose();
            }
        });
        renderer?.dispose();
        renderer?.forceContextLoss();
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
        renderer.autoClear = false;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
        // A small 3D Mars in the corner, drawn by the same renderer: Jezero pulses on it and two moons circle it.
        const buildHud = () =>
        {
            const hudScene = new THREE.Scene();
            const hudCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
            hudCamera.position.set(0, 0, 6.4);
            const globeMaterial = new THREE.MeshStandardMaterial({ color: 0x8a4a2c, roughness: 1 });
            const globe = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), globeMaterial);
            const tilt = new THREE.Group();
            tilt.rotation.z = THREE.MathUtils.degToRad(25);
            tilt.add(globe);
            hudScene.add(tilt);
            hudScene.add(new THREE.Mesh(new THREE.SphereGeometry(1.66, 48, 32), new THREE.ShaderMaterial({
                transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
                vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
                fragmentShader: "varying vec3 n; void main(){ float i = pow(0.74 - dot(n, vec3(0.0, 0.0, 1.0)), 3.2); gl_FragColor = vec4(1.0, 0.52, 0.32, 1.0) * i * 1.6; }"
            })));
            const light = new THREE.DirectionalLight(0xffe2c4, 3);
            light.position.set(-4, 2, 5);
            hudScene.add(light, new THREE.HemisphereLight(0x8fa8d0, 0x2a1810, 0.4));
            const phi = (77.45 + 180) / 360 * Math.PI * 2, theta = (90 - 18.44) / 180 * Math.PI;
            const normal = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
            const pin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd3a8 }));
            pin.position.copy(normal).multiplyScalar(1.51);
            const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffa070, transparent: true, side: THREE.DoubleSide, depthWrite: false });
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 32), ringMaterial);
            ring.position.copy(normal).multiplyScalar(1.51);
            ring.lookAt(normal.clone().multiplyScalar(4));
            globe.add(pin, ring);
            const moons = [0.07, 0.05].map(radius => { const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), new THREE.MeshStandardMaterial({ color: 0x8a7a6c, roughness: 1, flatShading: true })); hudScene.add(moon); return moon; });
            const canvas = document.createElement("canvas");
            canvas.width = 1024;
            canvas.height = 512;
            drawLayer(canvas.getContext("2d"), canvas, { north: 89.999, south: -89.999, west: -179.999, east: 179.999 }, VIKING_URL, 1, "jpg").then(() =>
            {
                if (disposed) return;
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                globeMaterial.map = texture;
                globeMaterial.color.set(0xffffff);
                globeMaterial.needsUpdate = true;
            }).catch(() => {});
            hud = { scene: hudScene, camera: hudCamera, globe, ring, ringMaterial, moons, base: -Math.atan2(normal.x, normal.z) };
        };

        const renderHud = now =>
        {
            const time = now / 1000, still = reducedMotion();
            const width = canvasHost.clientWidth, height = canvasHost.clientHeight;
            const size = Math.round(Math.min(190, Math.max(110, width * 0.24)));
            hud.globe.rotation.y = hud.base + (still ? 0 : Math.sin(time * 0.35) * 0.9);
            const pulse = (time * 0.8) % 1;
            hud.ring.scale.setScalar(1 + pulse * 2.4);
            hud.ringMaterial.opacity = (1 - pulse) * 0.9;
            hud.moons.forEach((moon, index) =>
            {
                const angle = still ? index * 2 : time * (1.1 - index * 0.5) + index * 2;
                moon.position.set(Math.cos(angle) * (2.3 + index * 0.6), Math.sin(angle) * 0.45 * (index ? -1 : 1), Math.sin(angle) * (2.3 + index * 0.6));
            });
            renderer.setScissorTest(true);
            renderer.setViewport(width - size - 14, 64, size, size);
            renderer.setScissor(width - size - 14, 64, size, size);
            renderer.clearDepth();
            renderer.render(hud.scene, hud.camera);
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, width, height);
        };

        buildHud();
        const tickers = new Set();
        renderer.setAnimationLoop(now =>
        {
            controls.update();
            for (const tick of tickers) tick(now);
            renderer.clear();
            if (scene) renderer.render(scene, camera);
            if (hud && scene) renderHud(now);
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
            // The map is wrapped onto a small sphere so the route sits on a planet. The curvature is exaggerated for effect.
            const radius = spanX;
            const bend = (x, y, z, target = new THREE.Vector3()) =>
            {
                const d = Math.hypot(x, z);

                if (d < 1e-6) return target.set(x, y, z);

                const angle = d / radius, ring = radius + y;
                return target.set(x / d * ring * Math.sin(angle), ring * Math.cos(angle) - radius, z / d * ring * Math.sin(angle));
            };
            const toScene = (point, elevation) => bend(
                ((point.lon - bounds.west) / (bounds.east - bounds.west) - 0.5) * spanX,
                (elevation - minZ) * factor,
                ((bounds.north - point.lat) / (bounds.north - bounds.south) - 0.5) * spanY);

            scene = new THREE.Scene();
            tickers.clear();
            scene.background = new THREE.Color(0x0b1118);
            scene.fog = new THREE.Fog(0x452a1f, spanX * 2.2, spanX * 5);
            scene.add(new THREE.HemisphereLight(0xffe2cf, 0x1b2430, 0.9));
            // Distant stars; decoration only, drifting slowly.
            const starCount = 900;
            const starPositions = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount; i++)
            {
                const theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * 0.9 + 0.1), radius = spanX * 9;
                starPositions.set([radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)], i * 3);
            }
            const starGeometry = new THREE.BufferGeometry();
            starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
            const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xcfe0ff, size: spanX * 0.03, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 }));
            scene.add(stars);
            if (!reducedMotion()) tickers.add(now => { stars.rotation.y = now * 0.000004; });
            const sun = new THREE.DirectionalLight(0xfff1e0, 1.6);
            sun.position.set(-spanX, spanX * 0.8, spanY * 0.6);
            scene.add(sun);
            camera.near = spanX / 2000;
            camera.far = spanX * 20;
            camera.updateProjectionMatrix();
            controls.minDistance = spanX * 0.15;
            controls.maxDistance = spanX * 3;

            // Butterscotch Martian sky that darkens toward space, with the Sun, two moons crossing and dust on the wind.
            const sky = new THREE.Mesh(new THREE.SphereGeometry(spanX * 12, 32, 16), new THREE.ShaderMaterial({
                side: THREE.BackSide, depthWrite: false, fog: false,
                vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
                fragmentShader: "varying vec3 p; void main(){ float h = clamp(p.y, 0.0, 1.0); vec3 c = mix(vec3(0.78, 0.47, 0.34), vec3(0.25, 0.15, 0.17), smoothstep(0.0, 0.18, h)); c = mix(c, vec3(0.03, 0.05, 0.09), smoothstep(0.12, 0.7, h)); if (p.y < 0.0) c = vec3(0.27, 0.16, 0.12); gl_FragColor = vec4(c, 1.0); }"
            }));
            sky.renderOrder = -10;
            scene.add(sky);
            const sunDirection = sun.position.clone().normalize();
            const skySun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.1, "rgba(255,236,190,.95)"], [0.3, "rgba(255,170,90,.35)"], [1, "rgba(255,110,50,0)"]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
            skySun.position.copy(sunDirection).multiplyScalar(spanX * 9);
            skySun.scale.setScalar(spanX * 2.2);
            scene.add(skySun);
            const moons = [[0.045, 0.034, 0.0, 0x8a7a6c], [0.03, 0.012, 0.5, 0x7d6a5c]].map(([size, speed, phase, colour]) =>
            {
                const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(spanX * size, 2), new THREE.MeshStandardMaterial({ color: colour, roughness: 1, flatShading: true, fog: false }));
                scene.add(mesh);
                return { mesh, speed, phase };
            });
            if (!reducedMotion())
            {
                tickers.add(now =>
                {
                    const time = now / 1000;
                    skySun.material.opacity = 0.85 + Math.sin(time * 0.8) * 0.12;

                    for (const moon of moons)
                    {
                        const u = (time * moon.speed + moon.phase) % 1, angle = Math.PI * u;
                        moon.mesh.position.set(-Math.cos(angle) * spanX * 7, Math.sin(angle) * spanX * 4.2 + spanX * 0.4, -spanY * 5);
                        moon.mesh.rotation.y = time * 0.3;
                    }

                    sky.rotation.y = 0;
                });
            }

            const dustCount = 260;
            const dustPositions = new Float32Array(dustCount * 3);
            for (let i = 0; i < dustCount; i++) dustPositions.set([(Math.random() - 0.5) * spanX * 1.4, spanX * (0.01 + Math.random() * 0.22), (Math.random() - 0.5) * spanY * 1.4], i * 3);
            const dustGeometry = new THREE.BufferGeometry();
            dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
            scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xe0a47c, size: spanX * 0.006, transparent: true, opacity: 0.4, depthWrite: false })));
            if (!reducedMotion())
            {
                let previous = 0;
                tickers.add(now =>
                {
                    const delta = Math.min(0.05, (now - previous) / 1000);
                    previous = now;

                    for (let i = 0; i < dustCount; i++)
                    {
                        dustPositions[i * 3] += spanX * (0.012 + (i % 5) * 0.004) * delta;
                        dustPositions[i * 3 + 1] += Math.sin(now / 900 + i) * spanX * 0.002 * delta;
                        if (dustPositions[i * 3] > spanX * 0.7) dustPositions[i * 3] = -spanX * 0.7;
                    }

                    dustGeometry.attributes.position.needsUpdate = true;
                });
            }

            const geometry = new THREE.PlaneGeometry(spanX, spanY, width - 1, height - 1);
            geometry.rotateX(-Math.PI / 2);
            const flat = Float32Array.from(geometry.attributes.position.array);
            const scratch = new THREE.Vector3();
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
            const body = new THREE.Mesh(new THREE.SphereGeometry(radius - spanX * 0.003, 96, 64), new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 1 }));
            body.position.y = -radius;
            const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 96, 64), new THREE.ShaderMaterial({
                transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
                vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
                fragmentShader: "varying vec3 n; void main(){ float i = pow(max(0.0, 0.72 - dot(n, vec3(0.0, 0.0, 1.0))), 3.0); gl_FragColor = vec4(1.0, 0.55, 0.34, 1.0) * i * 1.5; }"
            }));
            halo.position.y = -radius;
            scene.add(body, halo);
            const overlay = new THREE.Group();
            scene.add(overlay);
            const inside = pointsInside(bounds, points);
            const sample = point => sampleGrid(grid, point);
            const lift = spanX * 0.003;

            // Every segment is sampled; parts outside the height grid return null and are skipped. Rebuilt on each redraw because heights follow the vertical exaggeration.
            const routeSamples = () =>
            {
                const list = [];

                for (let i = 1; i < points.length; i++)
                {
                    for (let step = 0; step <= 24; step++)
                    {
                        const t = step / 24;
                        const point = { lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t, lon: points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t };
                        const elevation = sample(point);
                        if (elevation !== null) list.push(toScene(point, elevation));
                    }
                }

                return list;
            };

            let roverTick = null;
            let ringTick = null;

            const drawOverlay = () =>
            {
                overlay.clear();
                if (roverTick) { tickers.delete(roverTick); roverTick = null; }
                if (ringTick) { tickers.delete(ringTick); ringTick = null; }
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

                const dense = routeSamples();
                if (dense.length < 2) return;
                let routeLength = 0;
                for (let i = 1; i < dense.length; i++) routeLength += dense[i].distanceTo(dense[i - 1]);
                // Thick enough to see on a short route, thin enough not to swallow a long one.
                const tubeRadius = Math.max(spanX * 0.0007, Math.min(spanX * 0.0025, routeLength * 0.004));
                const lifted = dense.map(point => point.clone().add(new THREE.Vector3(0, lift * 2, 0)));
                const curve = new THREE.CatmullRomCurve3(lifted);
                const tube = new THREE.TubeGeometry(curve, lifted.length * 2, tubeRadius, 8, false);
                const tubeMesh = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: routeColor, depthTest: false }));
                tubeMesh.renderOrder = 10;
                overlay.add(tubeMesh);

                const pulseRings = [];

                for (const point of inside)
                {
                    const elevation = sample(point);
                    if (elevation === null) continue;
                    const marker = new THREE.Mesh(new THREE.SphereGeometry(tubeRadius * 2.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
                    marker.renderOrder = 11;
                    marker.position.copy(toScene(point, elevation).add(new THREE.Vector3(0, lift * 3, 0)));
                    overlay.add(marker);
                    const pulseRing = new THREE.Mesh(new THREE.RingGeometry(tubeRadius * 2.9, tubeRadius * 3.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: routeColor, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
                    pulseRing.renderOrder = 9;
                    pulseRing.position.copy(marker.position);
                    overlay.add(pulseRing);
                    pulseRings.push(pulseRing);
                }

                if (reducedMotion()) return;
                ringTick = now =>
                {
                    pulseRings.forEach((item, index) =>
                    {
                        const phase = (now / 1000 * 0.8 + index * 0.23) % 1;
                        item.scale.setScalar(1 + phase * 3);
                        item.material.opacity = (1 - phase) * 0.8;
                    });
                };
                tickers.add(ringTick);
                // A marker travels along the route so its direction and length read at a glance.
                const rover = new THREE.Mesh(new THREE.SphereGeometry(tubeRadius * 3, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
                const halo = new THREE.Mesh(new THREE.SphereGeometry(tubeRadius * 5, 20, 14), new THREE.MeshBasicMaterial({ color: routeColor, transparent: true, opacity: 0.35, depthTest: false }));
                rover.renderOrder = 12; halo.renderOrder = 12;
                overlay.add(rover, halo);
                const seconds = Math.max(6, Math.min(20, routeLength / (spanX * 0.04)));
                roverTick = now =>
                {
                    const t = (now / 1000 / seconds) % 1;
                    rover.position.copy(curve.getPointAt(t));
                    halo.position.copy(rover.position);
                    halo.scale.setScalar(1 + 0.25 * Math.sin(now / 250));
                };
                tickers.add(roverTick);
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
                    bend(flat[i * 3], ((elevations[i] ?? minZ) - minZ) * factor, flat[i * 3 + 2], scratch);
                    position.setXYZ(i, scratch.x, scratch.y, scratch.z);
                }

                position.needsUpdate = true;
                geometry.computeVertexNormals();
                drawOverlay();
            };

            const routeText = routeSamples().length >= 2
                ? (inside.length === points.length ? `Your route: ${inside.length} waypoints shown on the terrain.` : "Your route: the part inside this 3D area is shown on the terrain.")
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
            const sizeLabel = which === "crater" ? `${(spanX / 1000).toFixed(0)} × ${(spanY / 1000).toFixed(0)} km · ~${Math.round((maxZ - minZ) / 10) * 10} m relief (MOLA)` : `${Math.round(spanX)} × ${Math.round(spanY)} m · ${Math.round(maxZ - minZ)} m relief (CTX)`;
            status.textContent = sizeLabel + " · loading imagery…";
            const loader = which === "crater" ? craterTexture(THREE, renderer.capabilities.maxTextureSize, renderer.capabilities.getMaxAnisotropy(), done => { if (id === session && !disposed) status.textContent = `${sizeLabel} · imagery ${done} tiles`; })
                : deltaTexture(THREE, bounds, renderer.capabilities.maxTextureSize, renderer.capabilities.getMaxAnisotropy(), done => { if (id === session && !disposed) status.textContent = `${sizeLabel} · HiRISE ${done} tiles`; });

            loader.then(texture =>
            {
                if (disposed || id !== session) return;
                material.map = texture;
                material.vertexColors = false;
                material.needsUpdate = true;
                status.textContent = sizeLabel + (which === "crater" ? " · Viking + CTX + HiRISE" : " · HiRISE z15");
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
