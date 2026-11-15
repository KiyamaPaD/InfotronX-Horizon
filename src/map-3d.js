// Map-integrated 3D view: real USGS CTX heights with the NASA HiRISE mosaic draped on top. three.js loads only when opened.
import { loadJezeroDem } from "./bundled-dem.js";
import { sampleElevation } from "./terrain.js";
import { MAP_LAYERS } from "./constants.js";

const R = 3396190;
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const CONTROLS_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
// Mars Trek serves the Jezero HiRISE mosaic down to zoom 17; zoom 15 is about 1.2 m per pixel over the 2 km clip.
const TEXTURE_ZOOM = 15;

let demPromise = null;

export function demBounds(dem)
{
    return { north: dem.north, south: dem.north - dem.latStep * dem.height, west: dem.west, east: dem.west + dem.lonStep * dem.width };
}

export function pointsInsideDem(dem, points)
{
    const bounds = demBounds(dem);
    return points.filter(point => point.lat <= bounds.north && point.lat >= bounds.south && point.lon >= bounds.west && point.lon <= bounds.east);
}

function reducedMotion()
{
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function hiriseTexture(THREE, bounds, maxSize, onProgress)
{
    const scale = 256 * 2 ** TEXTURE_ZOOM;
    const px = lon => (lon + 180) / 360 * scale * 2;
    const py = lat => (90 - lat) / 180 * scale;
    const x0 = Math.floor(px(bounds.west) / 256), x1 = Math.floor(px(bounds.east) / 256);
    const y0 = Math.floor(py(bounds.north) / 256), y1 = Math.floor(py(bounds.south) / 256);
    const mosaic = document.createElement("canvas");
    mosaic.width = (x1 - x0 + 1) * 256;
    mosaic.height = (y1 - y0 + 1) * 256;
    const context = mosaic.getContext("2d");
    const base = MAP_LAYERS.find(layer => layer.id === "hirise").url + "/default/default028mm/" + TEXTURE_ZOOM + "/";
    const total = (x1 - x0 + 1) * (y1 - y0 + 1);
    let done = 0;
    const loads = [];

    for (let y = y0; y <= y1; y++)
    {
        for (let x = x0; x <= x1; x++)
        {
            loads.push(new Promise((resolve, reject) =>
            {
                const image = new Image();
                image.crossOrigin = "anonymous";
                image.onload = () =>
                {
                    context.drawImage(image, (x - x0) * 256, (y - y0) * 256);
                    onProgress(++done, total);
                    resolve();
                };
                image.onerror = reject;
                image.src = base + y + "/" + x + ".png";
            }));
        }
    }

    await Promise.all(loads);
    const sx = px(bounds.west) - x0 * 256, sy = py(bounds.north) - y0 * 256;
    const sw = px(bounds.east) - px(bounds.west), sh = py(bounds.south) - py(bounds.north);
    const crop = document.createElement("canvas");
    crop.width = Math.min(maxSize, 2048, Math.round(sw));
    crop.height = Math.round(crop.width * sh / sw);
    crop.getContext("2d").drawImage(mosaic, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    const texture = new THREE.CanvasTexture(crop);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export async function openMap3d({ host, points = [], routeColor = "#ff9a6b", onFocusArea, onClose })
{
    const layer = document.createElement("section");
    layer.className = "map-3d-layer";
    layer.setAttribute("aria-label", "3D terrain view");
    layer.innerHTML = `
        <div class="map-3d-canvas"></div>
        <div class="map-3d-panel">
            <div class="map-3d-eyebrow">JEZERO · 3D RELIEF</div>
            <p class="map-3d-copy">USGS CTX heights (20 m grid) with NASA HiRISE imagery (~1.2 m/pixel). Height is exaggerated for readability.</p>
            <label class="map-3d-range">Vertical ×<span data-3d="ex-value">3</span><input data-3d="ex" type="range" min="1" max="6" step="0.5" value="3" /></label>
            <div class="map-3d-actions">
                <button type="button" class="btn btn-accent compact" data-3d="fly">Fly in</button>
                <button type="button" class="btn btn-outline compact" data-3d="spin" aria-pressed="true">Rotate</button>
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
        demPromise ??= loadJezeroDem();
        const [THREE, { OrbitControls }, dem] = await Promise.all([import(THREE_URL), import(CONTROLS_URL), demPromise]);

        if (disposed) return { close };

        const { width, height, elevations, latStep, lonStep } = dem;
        const bounds = demBounds(dem);
        const midLat = (bounds.north + bounds.south) / 2;
        const spanX = lonStep * width * R * Math.cos(midLat * Math.PI / 180) * Math.PI / 180;
        const spanY = latStep * height * R * Math.PI / 180;
        const known = elevations.filter(value => value !== null);
        const minZ = Math.min(...known);
        const maxZ = Math.max(...known);
        const toScene = (point, elevation, factor) => new THREE.Vector3(
            ((point.lon - bounds.west) / (bounds.east - bounds.west) - 0.5) * spanX,
            (elevation - minZ) * factor,
            ((bounds.north - point.lat) / (bounds.north - bounds.south) - 0.5) * spanY);

        const canvasHost = layer.querySelector(".map-3d-canvas");
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        canvasHost.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b1118);
        scene.fog = new THREE.Fog(0x0b1118, spanX * 1.6, spanX * 4);
        const camera = new THREE.PerspectiveCamera(45, 1, 1, spanX * 20);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI * 0.47;
        controls.minDistance = spanX * 0.2;
        controls.maxDistance = spanX * 3;
        controls.autoRotate = !reducedMotion();
        controls.autoRotateSpeed = 0.5;
        get("spin").setAttribute("aria-pressed", String(controls.autoRotate));

        scene.add(new THREE.HemisphereLight(0xffe2cf, 0x1b2430, 0.9));
        const sun = new THREE.DirectionalLight(0xfff1e0, 1.6);
        sun.position.set(-spanX, spanX * 0.8, spanY * 0.6);
        scene.add(sun);

        const geometry = new THREE.PlaneGeometry(spanX, spanY, width - 1, height - 1);
        geometry.rotateX(-Math.PI / 2);
        const colors = new Float32Array(width * height * 3);

        for (let i = 0; i < width * height; i++)
        {
            const t = elevations[i] === null ? 0 : (elevations[i] - minZ) / (maxZ - minZ);
            const color = new THREE.Color().setHSL(0.05 + t * 0.03, 0.45, elevations[i] === null ? 0.05 : 0.22 + t * 0.45);
            colors.set([color.r, color.g, color.b], i * 3);
        }

        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
        const terrain = new THREE.Mesh(geometry, material);
        scene.add(terrain);
        const routeGroup = new THREE.Group();
        scene.add(routeGroup);
        let factor = 3;

        const inside = pointsInsideDem(dem, points);
        let drawRoute = () => {};

        if (inside.length >= 2)
        {
            drawRoute = () =>
            {
                routeGroup.clear();
                const dense = [];

                for (let i = 1; i < inside.length; i++)
                {
                    for (let step = 0; step <= 24; step++)
                    {
                        const t = step / 24;
                        const point = { lat: inside[i - 1].lat + (inside[i].lat - inside[i - 1].lat) * t, lon: inside[i - 1].lon + (inside[i].lon - inside[i - 1].lon) * t };
                        const elevation = sampleElevation(dem, point);
                        if (elevation !== null) dense.push(toScene(point, elevation, factor).add(new THREE.Vector3(0, 6, 0)));
                    }
                }

                if (dense.length < 2) return;
                const curve = new THREE.CatmullRomCurve3(dense);
                const tube = new THREE.TubeGeometry(curve, dense.length * 2, spanX * 0.0025, 8, false);
                const line = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: routeColor }));
                routeGroup.add(line);

                for (const point of inside)
                {
                    const elevation = sampleElevation(dem, point);
                    if (elevation === null) continue;
                    const marker = new THREE.Mesh(new THREE.SphereGeometry(spanX * 0.006, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                    marker.position.copy(toScene(point, elevation, factor).add(new THREE.Vector3(0, 10, 0)));
                    routeGroup.add(marker);
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
            get("route").textContent = `Your route: ${inside.length} waypoints shown on the terrain.`;
        }
        else
        {
            get("route").innerHTML = points.length >= 2
                ? 'Your route is outside the 3D area (the delta front, about 2 × 2 km). <button type="button" class="map-3d-link" data-3d="go">Show the 3D area on the map</button>'
                : 'Draw two or more waypoints inside the 3D area to see your route on the terrain. <button type="button" class="map-3d-link" data-3d="go">Show the 3D area on the map</button>';
            get("go")?.addEventListener("click", () => { onFocusArea?.({ lat: midLat, lon: (bounds.west + bounds.east) / 2 }); close(); });
        }

        const applyFactor = () =>
        {
            const position = geometry.attributes.position;

            for (let i = 0; i < position.count; i++)
            {
                position.setY(i, ((elevations[i] ?? minZ) - minZ) * factor);
            }

            position.needsUpdate = true;
            geometry.computeVertexNormals();
            drawRoute();
        };

        applyFactor();
        const target = new THREE.Vector3(0, (maxZ - minZ) * factor * 0.3, 0);
        const endPosition = new THREE.Vector3(spanX * 0.55, spanX * 0.55, spanY * 0.85);
        const startPosition = new THREE.Vector3(spanX * 0.1, spanX * 2.6, spanY * 0.15);

        const flyIn = () =>
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
                if (t < 1 && !disposed) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };

        const resize = () =>
        {
            const box = canvasHost.getBoundingClientRect();
            renderer.setSize(box.width, box.height, false);
            camera.aspect = box.width / Math.max(1, box.height);
            camera.updateProjectionMatrix();
        };

        new ResizeObserver(resize).observe(canvasHost);
        resize();
        flyIn();
        renderer.setAnimationLoop(() =>
        {
            controls.update();
            renderer.render(scene, camera);
        });
        status.textContent = `${Math.round(spanX)} × ${Math.round(spanY)} m · ${Math.round(maxZ - minZ)} m relief · loading HiRISE…`;

        get("ex").addEventListener("input", event =>
        {
            factor = Number(event.target.value);
            get("ex-value").textContent = factor;
            applyFactor();
        });
        get("fly").addEventListener("click", flyIn);
        get("spin").addEventListener("click", event =>
        {
            controls.autoRotate = !controls.autoRotate;
            event.currentTarget.setAttribute("aria-pressed", String(controls.autoRotate));
        });

        hiriseTexture(THREE, bounds, renderer.capabilities.maxTextureSize, (done, total) =>
        {
            if (!disposed) status.textContent = `Loading HiRISE imagery ${done}/${total}`;
        }).then(texture =>
        {
            if (disposed) return;
            material.map = texture;
            material.vertexColors = false;
            material.needsUpdate = true;
            status.textContent = `${Math.round(spanX)} × ${Math.round(spanY)} m · ${Math.round(maxZ - minZ)} m relief · HiRISE z${TEXTURE_ZOOM}`;
        }).catch(() =>
        {
            if (!disposed) status.textContent = "HiRISE imagery unavailable · showing relief colours";
        });
    }
    catch
    {
        status.textContent = "3D view could not load. Check your connection and try again.";
    }

    get("close").focus();
    return { close };
}
