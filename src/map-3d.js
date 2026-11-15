// Map-integrated 3D view with two honest data scales, loaded only when opened:
// - "crater": a qualitative 3D shape from 8-bit MOLA grayscale tiles, not verified metric elevations, under NASA imagery;
// - "delta": the 2 km delta-front clip on USGS CTX heights (20 m grid) under HiRISE at ~1.2 m/pixel.
import { loadJezeroDem } from "./bundled-dem.js";
import { MAP_LAYERS, JEZERO_CTX_CONTEXT } from "./constants.js";
import { addSpaceDecor } from "./space-decor.js";
import { lowPower, createGovernor } from "./perf.js";
import { analyzeRoute, formatDistance } from "./geo.js";
import { MARS_SITES, SITE_TYPES } from "./mars-sites.js";
import { getLineStyle, mountLineControls } from "./line-style.js";
import { directionOf, latLonOf, ellipseRadius, parseGlb, subdivide, positionGroups } from "./planet-mesh.js";

// NASA/JPL-Caltech 3D model of Mars: https://science.nasa.gov/resource/planet-mars-3d-model/
const NASA_MODEL_URL = new URL("../assets/nasa/mars-3d-model.glb", import.meta.url);
let nasaModel = null;

async function loadNasaModel(passes)
{
    if (nasaModel?.passes === passes) return nasaModel;

    const parsed = parseGlb(await (await fetch(NASA_MODEL_URL)).arrayBuffer());
    // The model's equatorial radius is 500; work in units of one equatorial radius.
    const dense = subdivide(parsed.positions.map(value => value / 500), parsed.uvs, parsed.indices, passes);
    const count = dense.positions.length / 3;
    const directions = new Float32Array(count * 3), radii = new Float32Array(count), lat = new Float32Array(count), lon = new Float32Array(count);

    for (let i = 0; i < count; i++)
    {
        const x = dense.positions[i * 3], y = dense.positions[i * 3 + 1], z = dense.positions[i * 3 + 2];
        const length = Math.hypot(x, y, z) || 1;
        directions[i * 3] = x / length; directions[i * 3 + 1] = y / length; directions[i * 3 + 2] = z / length;
        radii[i] = ellipseRadius(x / length, y / length, z / length);
        const place = latLonOf(x, y, z);
        lat[i] = place.lat;
        lon[i] = place.lon;
    }

    const { group, count: groupCount } = positionGroups(dense.positions);
    const decode = image => createImageBitmap(new Blob([image.bytes], { type: image.type }), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const [diffuse, normal] = await Promise.all([decode(parsed.diffuse), decode(parsed.normal)]);
    nasaModel = { passes, directions, radii, lat, lon, uvs: dense.uvs, indices: dense.indices, groups: group, groupCount, diffuse, normal };
    return nasaModel;
}

function releaseNasaModel()
{
    nasaModel?.diffuse.close();
    nasaModel?.normal.close();
    nasaModel = null;
}

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
const MOLA_DEM_URL = MOLA_URL;
const MOLA_SHADE_URL = MAP_LAYERS.find(layer => layer.id === "mola").url + "/default/default028mm/";
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
    canvas.width = Math.min(maxSize, lowPower() ? 2048 : 3072);
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

// The whole planet as one equirectangular canvas (2^(zoom+1) by 2^zoom tiles of 256 px), longitude -180 at the left edge.
async function globalMosaic(base, zoom, extension = "jpg", fill = "#6b3a26")
{
    const canvas = document.createElement("canvas");
    canvas.width = 512 * 2 ** zoom;
    canvas.height = 256 * 2 ** zoom;
    const context = canvas.getContext("2d");
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    await drawLayer(context, canvas, { north: 89.999, south: -89.999, west: -179.999, east: 179.999 }, base, zoom, extension);
    return canvas;
}

function disposeTree(root)
{
    root.traverse(object =>
    {
        object.geometry?.dispose();

        for (const material of [].concat(object.material || []))
        {
            material.map?.dispose();
            material.bumpMap?.dispose();
            material.dispose();
        }
    });
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
    crater: { title: "Jezero Crater", eyebrow: "3D VIEW · WHOLE CRATER", text: "Whole-crater visualization from NASA MOLA 8-bit grayscale imagery and Viking/HiRISE context. Vertical mapping is illustrative and not calibrated in meters. Use Delta detail for a documented numeric DEM.", switchLabel: "Delta detail · 20 m" },
    planet: { title: "Whole planet", eyebrow: "3D VIEW · MARS", text: "NASA's own 3D model of Mars (NASA/JPL-Caltech) with one texture, lifted by real MOLA heights (relief exaggerated; set the slider to 1 for true scale). Click a glowing pin for a real place, its facts and NASA photos. Your route follows the surface between waypoints, anywhere on the planet. Distances use Mars's real radius.", switchLabel: "Whole crater" },
    delta: { title: "Delta front", eyebrow: "3D VIEW · DETAIL", text: "USGS CTX heights (20 m grid) with NASA HiRISE imagery (~1.2 m/pixel). Height and curvature are exaggerated for readability.", switchLabel: "Whole planet" }
};

export async function openMap3d({ host, points = [], getPoints, getRoutes, getObservations, getLinks, onNodeClick, subscribe, getMode, setMode, onAddWaypoint, onMovePoint, onSelectWaypoint, onSelectObservation, onObserve, canUndo, canRedo, onUndo, onRedo, routeControls, routeColor = "#ff9a6b", mode = "planet", onFocusArea, onClose })
{
    const layer = document.createElement("section");
    layer.className = "map-3d-layer";
    layer.setAttribute("aria-label", "3D terrain view");
    layer.innerHTML = `
        <div class="map-3d-canvas"></div>
        <div class="map-3d-panel">
            <div class="map-3d-head"><div><div class="map-3d-eyebrow" data-3d="eyebrow"></div><h3 class="map-3d-title" data-3d="title"></h3></div><button type="button" class="map-3d-fold" data-3d="fold" aria-expanded="true" aria-label="Fold or unfold this panel">−</button></div>
            <p class="map-3d-copy" data-3d="copy"></p>
            <div class="map-3d-group"><span class="map-3d-label">VIEW</span>
                <label class="map-3d-range">Vertical ×<span data-3d="ex-value">3</span><input data-3d="ex" type="range" min="1" max="12" step="0.5" value="6" /></label>
                <div class="map-3d-actions">
                    <button type="button" class="btn btn-accent compact" data-3d="fit" title="Frame the whole route">Fit route</button>
                    <button type="button" class="btn btn-outline compact" data-3d="fly">Fly in</button>
                    <button type="button" class="btn btn-outline compact" data-3d="spin" aria-pressed="true">Rotate</button>
                    <button type="button" class="btn btn-outline compact" data-3d="switch" hidden></button>
                </div>
            </div>
            <div class="map-3d-group"><span class="map-3d-label">TOOLS</span>
                <div class="map-3d-actions map-3d-tools" role="group" aria-label="Map tools">
                    <button type="button" class="btn btn-outline compact" data-3d-mode="pan" aria-pressed="true" title="Turn the planet and click places (E)">Explore</button>
                    <button type="button" class="btn btn-outline compact" data-3d-mode="draw" aria-pressed="false" title="Click the planet to add a waypoint (D)">Draw</button>
                    <button type="button" class="btn btn-outline compact" data-3d-mode="edit" aria-pressed="false" title="Drag a waypoint to move it (M)">Move</button>
                    <button type="button" class="btn btn-outline compact" data-3d-mode="observe" aria-pressed="false" title="Click the planet to add a field note (N)">Note</button>
                </div>
                <div class="map-3d-actions"><button type="button" class="btn btn-quiet compact" data-3d="undo">Undo</button><button type="button" class="btn btn-quiet compact" data-3d="redo">Redo</button></div>
            </div>
            <div class="map-3d-group"><span class="map-3d-label">YOUR ROUTE</span><p class="map-3d-route" data-3d="route"></p></div>
            <details class="map-3d-group map-3d-lines"><summary class="map-3d-label">LINES</summary><div data-3d="lines"></div></details>
            <details class="map-3d-group map-3d-legend" open><summary class="map-3d-label">LEGEND</summary>
                <ul>
                    <li><i class="lg3-pin" style="--c:#75d1c8"></i>Landing site of a rover or lander</li>
                    <li><i class="lg3-pin" style="--c:#e3a06a"></i>Natural feature: volcano, canyon, basin</li>
                    <li><i class="lg3-pin" style="--c:#75d1c8;--s:9px"></i>First waypoint of your route</li>
                    <li><i class="lg3-pin" style="--c:#fff;--s:9px"></i>Other waypoints, with a pulsing ring</li>
                    <li><i class="lg3-line"></i>Your route, along the surface of Mars</li>
                </ul>
            </details>
        </div>
        <aside class="map-3d-site" data-3d="site" hidden aria-label="Place on Mars">
            <button type="button" class="map-3d-site-close" data-3d="site-close" aria-label="Close">×</button>
            <span class="map-3d-site-type" data-3d="site-type"></span>
            <h3 data-3d="site-name"></h3>
            <p class="map-3d-site-coords" data-3d="site-coords"></p>
            <p class="map-3d-site-summary" data-3d="site-summary"></p>
            <ul class="map-3d-site-facts" data-3d="site-facts"></ul>
            <div class="map-3d-site-photos" data-3d="site-photos"></div>
            <p class="map-3d-site-credit">Photos: NASA Image and Video Library. Click one to open it. The summary is written for Mars Atlas.</p>
            <div class="map-3d-site-actions"><button type="button" class="btn btn-accent compact" data-3d="site-fly">Fly here</button><button type="button" class="btn btn-outline compact" data-3d="site-add">Add as waypoint</button></div>
        </aside>
        <div class="map-3d-tip" hidden></div>
        <div class="map-3d-nav">
            <button type="button" class="map-3d-compass" data-3d="compass" aria-label="Compass. North is where the red needle points. Click to return to the default view.">
                <svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" fill="#0b121bcc" stroke="#ffffff33"/><g data-3d="needle" style="transform-origin:28px 28px"><path d="M28 7 L34 28 L28 24 L22 28 Z" fill="#e3623a"/><path d="M28 49 L34 28 L28 32 L22 28 Z" fill="#aebdca"/></g><text x="28" y="6" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">N</text></svg>
            </button>
            <div class="map-3d-poles"><button type="button" data-3d="north" title="Look down on the north pole">N pole</button><button type="button" data-3d="south" title="Look down on the south pole">S pole</button></div>
            <div class="map-3d-readout" data-3d="readout" aria-live="off"></div>
            <div class="map-3d-readout" data-3d="pointer" aria-live="off"></div>
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
    let stopListening = null;
    let stopTools = null;
    const currentPoints = () => getPoints ? getPoints() : points;
    let hudKeep = null;
    let decorHandle = null;
    let skipFrames = false;
    let frameToggle = false;
    const light = lowPower();
    let scene = null;
    let session = 0;

    const close = () =>
    {
        if (disposed) return;
        disposed = true;
        renderer?.setAnimationLoop(null);
        stopListening?.();
        releaseNasaModel();
        scene?.traverse(object =>
        {
            object.geometry?.dispose();

            for (const material of [].concat(object.material || []))
            {
                material.map?.dispose();
                material.bumpMap?.dispose();
                material.dispose();
            }
        });
        hud?.scene.traverse(object =>
        {
            object.geometry?.dispose();

            for (const material of [].concat(object.material || []))
            {
                material.map?.dispose();
                material.bumpMap?.dispose();
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

        const tickers = new Set();
        // If frames stay slow, drop the decoration first (level 1), then the extra animation (level 2).
        const governor = createGovernor(level =>
        {
            renderer.setPixelRatio(1);
            resize();
            decorHandle?.setVisible(false);
            hud = null;
            hudKeep = null;

            if (level >= 2)
            {
                tickers.clear();
                controls.autoRotate = false;
                get("spin").setAttribute("aria-pressed", "false");
                skipFrames = true;
            }

            status.textContent = "Effects reduced to keep the view smooth.";
        });
        renderer.setAnimationLoop(now =>
        {
            if (skipFrames && (frameToggle = !frameToggle)) return;
            governor.tick(now);
            controls.update();
            for (const tick of tickers) tick(now);
            renderer.clear();
            if (scene) renderer.render(scene, camera);
            if (hud && scene) renderHud(now);
        });

        // The whole planet at its true proportions: real Viking colour, MOLA relief (exaggerated) and a route that can run anywhere on it.
        const buildPlanet = async id =>
        {
            status.textContent = "Loading the whole planet…";
            controls.maxPolarAngle = Math.PI;
            if (scene) disposeTree(scene);
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x05070d);
            tickers.clear();
            hud = null;
            camera.near = 0.01;
            camera.far = 400;
            camera.updateProjectionMatrix();
            controls.minDistance = 1.12;
            controls.maxDistance = 14;
            scene.add(new THREE.HemisphereLight(0xffe2cf, 0x1b2430, 0.55));
            const sunLight = new THREE.DirectionalLight(0xfff1e0, 2.4);
            sunLight.position.set(-5, 2.5, 4);
            scene.add(sunLight);
            const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.1, "rgba(255,236,190,.95)"], [0.3, "rgba(255,170,90,.35)"], [1, "rgba(255,110,50,0)"]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
            sunSprite.position.set(-30, 12, -22);
            sunSprite.scale.setScalar(14);
            scene.add(sunSprite);

            if (!light)
            {
                decorHandle = addSpaceDecor(THREE, scene, { radius: 1, center: new THREE.Vector3(), reduced: reducedMotion() });
                tickers.add(now => decorHandle.update(now));
            }

            // NASA's own 3D model of Mars (NASA/JPL-Caltech), made denser so real MOLA heights can lift it. One mesh, one texture.
            const nasa = await loadNasaModel(light ? 2 : 3);

            if (disposed || id !== session) return;

            const vertexCount = nasa.directions.length / 3;
            const geometry = new THREE.BufferGeometry();
            const positionArray = new Float32Array(nasa.directions.length);
            geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
            geometry.setAttribute("uv", new THREE.BufferAttribute(nasa.uvs, 2));
            geometry.setIndex(new THREE.BufferAttribute(nasa.indices, 1));
            const diffuse = new THREE.Texture(nasa.diffuse);
            diffuse.flipY = false;
            diffuse.colorSpace = THREE.SRGBColorSpace;
            diffuse.anisotropy = renderer.capabilities.getMaxAnisotropy();
            diffuse.needsUpdate = true;
            const normalMap = new THREE.Texture(nasa.normal);
            normalMap.flipY = false;
            normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
            normalMap.needsUpdate = true;
            const material = new THREE.MeshStandardMaterial({ map: diffuse, normalMap, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.92, metalness: 0 });
            scene.add(new THREE.Mesh(geometry, material));
            scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), new THREE.ShaderMaterial({
                transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
                vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
                fragmentShader: "varying vec3 n; void main(){ float i = pow(max(0.0, 0.72 - dot(n, vec3(0.0, 0.0, 1.0))), 3.0); gl_FragColor = vec4(1.0, 0.55, 0.34, 1.0) * i * 1.5; }"
            })));

            // MOLA grey level 0-255 spans 29.4 km of height; at true scale that is 0.87% of the radius, multiplied by the slider.
            const relief = { data: null, width: 0, height: 0 };
            const dispAt = (lat, lon) =>
            {
                if (!relief.data) return 0;

                const x = Math.min(relief.width - 1, Math.max(0, (lon + 180) / 360 * relief.width)), y = Math.min(relief.height - 1, Math.max(0, (90 - lat) / 180 * relief.height));
                const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(relief.width - 1, x0 + 1), y1 = Math.min(relief.height - 1, y0 + 1), tx = x - x0, ty = y - y0;
                const grey = (cx, cy) => relief.data[(cy * relief.width + cx) * 4];
                const value = grey(x0, y0) * (1 - tx) * (1 - ty) + grey(x1, y0) * tx * (1 - ty) + grey(x0, y1) * (1 - tx) * ty + grey(x1, y1) * tx * ty;
                return value / 255 * 0.00867 * factor;
            };
            const applyRelief = () =>
            {
                for (let i = 0; i < vertexCount; i++)
                {
                    const radius = nasa.radii[i] * (1 + dispAt(nasa.lat[i], nasa.lon[i]));
                    positionArray[i * 3] = nasa.directions[i * 3] * radius;
                    positionArray[i * 3 + 1] = nasa.directions[i * 3 + 1] * radius;
                    positionArray[i * 3 + 2] = nasa.directions[i * 3 + 2] * radius;
                }

                geometry.attributes.position.needsUpdate = true;
                geometry.computeVertexNormals();

                // Texture seams duplicate vertices; give each pair the same normal so no line shows.
                const normals = geometry.attributes.normal.array;
                const sums = new Float32Array(nasa.groupCount * 3);

                for (let i = 0; i < vertexCount; i++)
                {
                    const g = nasa.groups[i] * 3;
                    sums[g] += normals[i * 3]; sums[g + 1] += normals[i * 3 + 1]; sums[g + 2] += normals[i * 3 + 2];
                }

                for (let i = 0; i < vertexCount; i++)
                {
                    const g = nasa.groups[i] * 3, length = Math.hypot(sums[g], sums[g + 1], sums[g + 2]) || 1;
                    normals[i * 3] = sums[g] / length; normals[i * 3 + 1] = sums[g + 1] / length; normals[i * 3 + 2] = sums[g + 2] / length;
                }

                geometry.attributes.normal.needsUpdate = true;
                geometry.computeBoundingSphere();
            };

            const toVector = (lat, lon) =>
            {
                const d = directionOf(lat, lon);
                return new THREE.Vector3(d.x, d.y, d.z);
            };
            const toLatLon = vector => latLonOf(vector.x, vector.y, vector.z);

            let valid = [];
            let vectors = [];
            const readPoints = () =>
            {
                valid = currentPoints().filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
                vectors = valid.map(point => toVector(point.lat, point.lon));
            };
            readPoints();
            const route = new THREE.Group();
            scene.add(route);
            const waypointTargets = [], noteTargets = [], labels = [];
            let roverTick = null, ringTick = null;
            const labelCache = new Map();
            const labelTexture = text =>
            {
                if (!labelCache.has(text))
                {
                    const label = document.createElement("canvas");
                    label.width = 256;
                    label.height = 64;
                    const context = label.getContext("2d");
                    context.font = "700 30px sans-serif";
                    context.textAlign = "center";
                    context.textBaseline = "middle";
                    context.lineWidth = 6;
                    context.strokeStyle = "#0b121b";
                    context.strokeText(text, 128, 34);
                    context.fillStyle = "#ffffff";
                    context.fillText(text, 128, 34);
                    labelCache.set(text, new THREE.CanvasTexture(label));
                }

                return labelCache.get(text);
            };
            // Same symbols as the 2D map: circle, diamond, square, triangle and star.
            const shapeGeometry = (icon, size) => icon === "diamond" ? new THREE.OctahedronGeometry(size * 1.3)
                : icon === "square" ? new THREE.BoxGeometry(size * 1.7, size * 1.7, size * 1.7)
                : icon === "triangle" ? new THREE.ConeGeometry(size * 1.4, size * 2.4, 3)
                : icon === "star" ? new THREE.TetrahedronGeometry(size * 1.7)
                : new THREE.SphereGeometry(size, 16, 12);
            const surfaceOf = (vector, lift) =>
            {
                const { lat, lon } = toLatLon(vector);
                const n = vector.clone().normalize();
                return n.multiplyScalar(ellipseRadius(n.x, n.y, n.z) * (1 + dispAt(lat, lon) + lift));
            };
            // Points along the great circles between waypoints, so a long route bends with the planet instead of cutting through it.
            const densify = (list, lift) =>
            {
                const out = [];

                for (let i = 1; i < list.length; i++)
                {
                    const a = list[i - 1], b = list[i];
                    const omega = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
                    const steps = Math.max(2, Math.ceil(omega / 0.008));

                    for (let step = i === 1 ? 0 : 1; step <= steps; step++)
                    {
                        const t = step / steps;
                        const along = omega < 1e-6 ? a.clone() : a.clone().multiplyScalar(Math.sin((1 - t) * omega) / Math.sin(omega)).add(b.clone().multiplyScalar(Math.sin(t * omega) / Math.sin(omega)));
                        out.push(surfaceOf(along, lift));
                    }
                }

                return out;
            };
            const clearRoute = () =>
            {
                route.traverse(object =>
                {
                    object.geometry?.dispose();
                    for (const material of [].concat(object.material || [])) material.dispose();
                });
                route.clear();
            };
            tickers.add(() => { const near = camera.position.length() < 2.3; for (const sprite of labels) sprite.visible = near; });
            const targetFor = radius =>
            {
                const target = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
                route.add(target);
                return target;
            };
            const addLabel = (text, position, size) =>
            {
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text), transparent: true, depthWrite: false, fog: false }));
                sprite.position.copy(position).multiplyScalar(1 + size * 2.6);
                sprite.scale.set(0.17, 0.0425, 1);
                sprite.visible = false;
                route.add(sprite);
                labels.push(sprite);
            };

            const drawRoute = () =>
            {
                readPoints();
                clearRoute();
                if (roverTick) { tickers.delete(roverTick); roverTick = null; }
                if (ringTick) { tickers.delete(ringTick); ringTick = null; }
                waypointTargets.length = 0;
                noteTargets.length = 0;
                labels.length = 0;
                const look = getLineStyle();
                const colour = routeControls?.getColor?.() || routeColor;

                // The other routes of the mission, thin and dashed, as on the 2D map.
                for (const other of getRoutes ? getRoutes() : [])
                {
                    if (other.active || other.points.length < 2) continue;

                    const ends = other.points.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon)).map(point => toVector(point.lat, point.lon));
                    const path = densify(ends, 0.003);

                    if (path.length < 2) continue;

                    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineDashedMaterial({ color: other.color || "#8da0b0", dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.8 * look.opacity }));
                    line.computeLineDistances();
                    route.add(line);
                }

                // Field notes, as on the 2D map.
                for (const note of getObservations ? getObservations() : [])
                {
                    if (!Number.isFinite(note.lat) || !Number.isFinite(note.lon)) continue;

                    const size = 0.009 * look.markerSize;
                    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(size), new THREE.MeshBasicMaterial({ color: 0xffdd9c }));
                    marker.position.copy(surfaceAt(note.lat, note.lon, 0.007));
                    route.add(marker);
                    const target = targetFor(0.024);
                    target.position.copy(marker.position);
                    target.userData.observationId = note.id;
                    noteTargets.push(target);

                    if (note.title) addLabel(String(note.title).slice(0, 18), marker.position, size);
                }

                if (!vectors.length) return;

                let totalAngle = 0;
                for (let i = 1; i < vectors.length; i++) totalAngle += Math.acos(Math.max(-1, Math.min(1, vectors[i - 1].dot(vectors[i]))));

                // Thick enough to see on a short route, thin enough not to swallow a long one.
                const base = Math.max(0.0035, Math.min(0.014, totalAngle * 0.012));
                const tube = base * look.width;
                const lift = tube * 1.4;
                const dense = densify(vectors, lift);
                const ringMaterials = [];

                valid.forEach((point, index) =>
                {
                    const position = surfaceOf(vectors[index], lift).multiplyScalar(1 + tube * 0.4);
                    const size = Math.max(0.004, base * 2.2 * look.markerSize);
                    const marker = new THREE.Mesh(shapeGeometry(point.icon, size), new THREE.MeshBasicMaterial({ color: point.color || (index === 0 ? "#75d1c8" : "#ffffff") }));
                    marker.position.copy(position);
                    marker.lookAt(position.clone().multiplyScalar(2));
                    const ring = new THREE.Mesh(new THREE.RingGeometry(base * 2.9 * look.markerSize, base * 3.5 * look.markerSize, 32), new THREE.MeshBasicMaterial({ color: colour, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
                    ring.position.copy(position);
                    ring.lookAt(position.clone().multiplyScalar(2));
                    route.add(marker, ring);
                    ringMaterials.push(ring);
                    const target = targetFor(Math.max(0.02, size * 2.4));
                    target.position.copy(position);
                    target.userData.waypointId = point.id;
                    waypointTargets.push(target);
                    addLabel(String(point.name || "").trim().slice(0, 18) || String(index + 1), position, size);
                });

                // Extra connections between waypoints.
                for (const [first, second] of getLinks ? getLinks() : [])
                {
                    const a = valid.findIndex(point => point.id === first), b = valid.findIndex(point => point.id === second);

                    if (a < 0 || b < 0) continue;

                    const path = densify([vectors[a], vectors[b]], lift);

                    if (path.length < 2) continue;

                    route.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length, tube * 0.7, 6, false), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.8 * look.opacity })));
                }

                if (dense.length < 2) return;

                const curve = new THREE.CatmullRomCurve3(dense);
                const lineMaterial = new THREE.MeshBasicMaterial({ color: colour, transparent: look.opacity < 1, opacity: look.opacity });
                const outline = new THREE.MeshBasicMaterial({ color: 0x07121a, transparent: true, opacity: 0.55 * look.opacity });

                if (look.style === "dashed")
                {
                    // Short pieces with gaps; each piece is its own thin tube.
                    const on = 14, off = 9;

                    for (let from = 0; from < dense.length - 1; from += on + off)
                    {
                        const piece = dense.slice(from, Math.min(dense.length, from + on + 1));

                        if (piece.length < 2) continue;

                        route.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(piece), piece.length, tube, 8, false), lineMaterial));
                    }
                }
                else
                {
                    if (look.glow) route.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(6000, dense.length * 2), tube * 1.7, 8, false), outline));

                    route.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(6000, dense.length * 2), tube, 8, false), lineMaterial));
                }

                if (reducedMotion() || !look.animate) return;

                ringTick = now => ringMaterials.forEach((ring, index) =>
                {
                    const phase = (now / 1000 * 0.8 + index * 0.23) % 1;
                    ring.scale.setScalar(1 + phase * 3);
                    ring.material.opacity = (1 - phase) * 0.8;
                });
                tickers.add(ringTick);
                const rover = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.006, base * 3 * look.markerSize), 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                route.add(rover);
                const seconds = Math.max(6, Math.min(24, totalAngle * 8));
                roverTick = now => rover.position.copy(curve.getPointAt((now / 1000 / seconds) % 1));
                tickers.add(roverTick);
            };

            const glow = glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,.4)"], [1, "rgba(255,255,255,0)"]]);
            const surfaceAt = (lat, lon, lift = 0) =>
            {
                const direction = toVector(lat, lon);
                return direction.multiplyScalar(ellipseRadius(direction.x, direction.y, direction.z) * (1 + dispAt(lat, lon) + lift));
            };
            const minimumDistance = () => 1 + 0.00867 * factor + 0.008;
            const fieldOfView = () => Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));

            // The camera glides to look down on a direction from a given distance (planet radius = 1).
            const flyTo = (direction, distance) =>
            {
                controls.target.set(0, 0, 0);
                const end = direction.clone().normalize().multiplyScalar(Math.max(distance, minimumDistance()));

                if (reducedMotion())
                {
                    camera.position.copy(end);
                    return;
                }

                const start = camera.position.clone();
                const begin = performance.now();
                const step = now =>
                {
                    const t = Math.min(1, (now - begin) / 1300);
                    const eased = 1 - Math.pow(1 - t, 3);
                    const turn = start.clone().normalize().lerp(end.clone().normalize(), eased).normalize();
                    camera.position.copy(turn.multiplyScalar(start.length() + (end.length() - start.length()) * eased));
                    if (t < 1 && !disposed && id === session) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            };

            // Fit route: the whole route, with a little room around it, fills the view.
            const defaultDirection = toVector(18.44, 77.45);
            const fitRoute = () =>
            {
                readPoints();

                if (!vectors.length)
                {
                    flyTo(defaultDirection, 3.1);
                    status.textContent = "Add waypoints and this button frames them all.";
                    return;
                }

                const centre = vectors.reduce((sum, vector) => sum.add(vector), new THREE.Vector3()).normalize();

                if (centre.lengthSq() < 0.5)
                {
                    flyTo(vectors[0], 3.1);
                    return;
                }

                const spread = vectors.reduce((widest, vector) => Math.max(widest, Math.acos(Math.max(-1, Math.min(1, centre.dot(vector))))), 0);
                const half = Math.min(1.35, Math.max(0.03, spread * 1.3));
                flyTo(centre, Math.cos(half) + Math.sin(half) / Math.tan(fieldOfView()));
            };

            // Real places that are always on the planet: where rovers and landers touched down, and the biggest features.
            const siteGroup = new THREE.Group();
            scene.add(siteGroup);
            const siteTargets = [];
            const drawSites = () =>
            {
                siteGroup.clear();
                siteTargets.length = 0;

                for (const site of MARS_SITES)
                {
                    const colour = SITE_TYPES[site.type].colour;
                    const position = surfaceAt(site.lat, site.lon, 0.006);
                    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 8), new THREE.MeshBasicMaterial({ color: colour }));
                    pin.position.copy(position);
                    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
                    halo.position.copy(position);
                    halo.scale.setScalar(0.06);
                    const target = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
                    target.position.copy(position);
                    target.userData.site = site;
                    siteGroup.add(pin, halo, target);
                    siteTargets.push(target);
                }
            };

            const raycaster = new THREE.Raycaster();
            const pointerAt = event =>
            {
                const box = renderer.domElement.getBoundingClientRect();
                raycaster.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1), camera);
            };
            const planetSphere = new THREE.Sphere(new THREE.Vector3(), 1);
            const planetHit = () => raycaster.ray.intersectSphere(planetSphere, new THREE.Vector3());
            const siteAt = event =>
            {
                pointerAt(event);
                const hit = raycaster.intersectObjects(siteTargets, false)[0];

                if (!hit) return null;

                // A site on the far side is hidden by the planet.
                const front = planetHit();
                return !front || hit.distance <= raycaster.ray.origin.distanceTo(front) + 0.04 ? hit.object.userData.site : null;
            };

            const tip = layer.querySelector(".map-3d-tip");
            const photos = new Map();
            let openSiteId = null;

            const showPhotos = async site =>
            {
                const box = get("site-photos");
                box.replaceChildren();
                const search = "https://images.nasa.gov/search?q=" + encodeURIComponent(site.query);

                try
                {
                    if (!photos.has(site.id))
                    {
                        box.textContent = "Loading photos from NASA…";
                        const response = await fetch("https://images-api.nasa.gov/search?media_type=image&page_size=6&q=" + encodeURIComponent(site.query));

                        if (!response.ok) throw new Error("NASA image search unavailable");

                        const json = await response.json();
                        photos.set(site.id, (json.collection?.items || []).filter(item => item.links?.[0]?.href && item.data?.[0]?.nasa_id).slice(0, 6));
                    }

                    if (openSiteId !== site.id) return;

                    box.replaceChildren();
                    const items = photos.get(site.id);

                    for (const item of items)
                    {
                        const link = document.createElement("a");
                        link.href = "https://images.nasa.gov/details/" + encodeURIComponent(item.data[0].nasa_id);
                        link.target = "_blank";
                        link.rel = "noopener";
                        link.title = item.data[0].title || site.name;
                        const image = document.createElement("img");
                        image.src = item.links[0].href;
                        image.alt = item.data[0].title || site.name;
                        image.loading = "lazy";
                        link.append(image);
                        box.append(link);
                    }

                    if (!items.length) box.textContent = "No photos found.";
                }
                catch
                {
                    if (openSiteId !== site.id) return;
                    box.replaceChildren();
                    const link = document.createElement("a");
                    link.href = search;
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.textContent = "Photos could not be loaded. Search the NASA library for " + site.name + " →";
                    box.append(link);
                }
            };

            const openSite = site =>
            {
                openSiteId = site.id;
                const panel = get("site");
                panel.hidden = false;
                get("site-type").textContent = SITE_TYPES[site.type].label.toUpperCase();
                get("site-name").textContent = site.name;
                get("site-coords").textContent = `${Math.abs(site.lat).toFixed(2)}° ${site.lat >= 0 ? "N" : "S"} · ${Math.abs(site.lon).toFixed(2)}° ${site.lon >= 0 ? "E" : "W"}`;
                get("site-summary").textContent = site.summary;
                get("site-facts").replaceChildren(...site.facts.map(fact => { const item = document.createElement("li"); item.textContent = fact; return item; }));
                panel.dataset.site = site.id;
                showPhotos(site);
                flyTo(toVector(site.lat, site.lon), 1.45);
            };
            get("site-close").addEventListener("click", () => { openSiteId = null; get("site").hidden = true; });
            get("site-fly").addEventListener("click", () => { const site = MARS_SITES.find(item => item.id === openSiteId); if (site) flyTo(toVector(site.lat, site.lon), 1.2); });
            get("site-add").addEventListener("click", () =>
            {
                const site = MARS_SITES.find(item => item.id === openSiteId);

                if (!site || !onAddWaypoint) return;

                const added = onAddWaypoint({ lat: site.lat, lon: site.lon, name: site.name, description: site.summary, category: site.type === "landing" ? "landmark" : "science", icon: site.type === "landing" ? "star" : "triangle" });
                status.textContent = added ? site.name + " added to your route." : "The route is full or the place could not be added.";
            });

            // The same tools as the 2D map: Explore, Draw, Move and Note. Click a place to read about it.
            const modeNow = () => getMode ? getMode() : "pan";
            const canvas = renderer.domElement;
            const hitAt = (event, list) =>
            {
                pointerAt(event);
                const hit = raycaster.intersectObjects(list, false)[0];

                if (!hit) return null;

                // Anything on the far side is hidden by the planet.
                const front = planetHit();
                return !front || hit.distance <= raycaster.ray.origin.distanceTo(front) + 0.05 ? hit.object : null;
            };
            const placeAt = event =>
            {
                pointerAt(event);
                const point = planetHit();
                return point ? toLatLon(point) : null;
            };
            let downAt = null;
            let drag = null;
            let dragDrawn = 0;
            canvas.addEventListener("pointerdown", event =>
            {
                downAt = { x: event.clientX, y: event.clientY };

                if (modeNow() === "edit" && event.button === 0)
                {
                    const target = hitAt(event, waypointTargets);

                    if (target)
                    {
                        drag = { id: target.userData.waypointId, place: null };
                        controls.enabled = false;
                        canvas.setPointerCapture(event.pointerId);
                    }
                }
            });
            canvas.addEventListener("pointerup", event =>
            {
                if (drag)
                {
                    if (drag.place) onMovePoint?.(drag.id, { lat: Number(drag.place.lat.toFixed(5)), lon: Number(drag.place.lon.toFixed(5)) }, true);

                    drag = null;
                    controls.enabled = true;
                    downAt = null;
                    drawRoute();
                    return;
                }

                if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;

                downAt = null;
                const waypoint = hitAt(event, waypointTargets)?.userData.waypointId;

                if (waypoint) { if (modeNow() === "draw" && onNodeClick) onNodeClick(waypoint); else onSelectWaypoint?.(waypoint); return; }

                const note = hitAt(event, noteTargets)?.userData.observationId;

                if (note) { onSelectObservation?.(note); return; }

                const site = hitAt(event, siteTargets)?.userData.site;

                if (site) { openSite(site); return; }

                const mode = modeNow();

                if (mode !== "draw" && mode !== "observe") return;

                const place = placeAt(event);

                if (!place) return;

                const coordinate = { lat: Number(place.lat.toFixed(5)), lon: Number(place.lon.toFixed(5)) };

                if (mode === "draw")
                {
                    const added = onAddWaypoint?.(coordinate);
                    status.textContent = added ? "Waypoint placed." : "The route is full.";
                }
                else
                {
                    onObserve?.(coordinate);
                }
            });
            const pointerReadout = get("pointer");
            let hoverTimer = 0;
            canvas.addEventListener("pointermove", event =>
            {
                if (drag)
                {
                    const place = placeAt(event);

                    if (place && performance.now() - dragDrawn > 40)
                    {
                        dragDrawn = performance.now();
                        drag.place = place;
                        onMovePoint?.(drag.id, { lat: Number(place.lat.toFixed(5)), lon: Number(place.lon.toFixed(5)) }, false);
                        drawRoute();
                    }

                    return;
                }

                if (event.buttons || performance.now() - hoverTimer < 60) return;

                hoverTimer = performance.now();
                const site = hitAt(event, siteTargets)?.userData.site;
                const overWaypoint = !site && hitAt(event, waypointTargets);
                const overNote = !site && !overWaypoint && hitAt(event, noteTargets);
                const mode = modeNow();
                canvas.style.cursor = site || overNote ? "pointer" : overWaypoint ? (mode === "edit" ? "grab" : "pointer") : mode === "draw" || mode === "observe" ? "crosshair" : "";
                tip.hidden = !site;

                if (site)
                {
                    tip.textContent = site.name;
                    const box = layer.getBoundingClientRect();
                    tip.style.left = event.clientX - box.left + 14 + "px";
                    tip.style.top = event.clientY - box.top + 14 + "px";
                }

                const place = placeAt(event);
                pointerReadout.textContent = place ? `Pointer ${Math.abs(place.lat).toFixed(3)}° ${place.lat >= 0 ? "N" : "S"} ${Math.abs(place.lon).toFixed(3)}° ${place.lon >= 0 ? "E" : "W"}` : "";
            });
            get("fit").addEventListener("click", fitRoute);

            // Tool buttons and undo/redo mirror the 2D map and stay in step with it.
            const paintTools = () =>
            {
                const mode = modeNow();
                layer.querySelectorAll("[data-3d-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset["3dMode"] === mode)));
                get("undo").disabled = !canUndo?.();
                get("redo").disabled = !canRedo?.();
                canvas.style.cursor = mode === "draw" || mode === "observe" ? "crosshair" : "";
            };
            layer.querySelectorAll("[data-3d-mode]").forEach(button => button.addEventListener("click", () => { setMode?.(button.dataset["3dMode"]); paintTools(); }));
            get("undo").addEventListener("click", () => { onUndo?.(); paintTools(); });
            get("redo").addEventListener("click", () => { onRedo?.(); paintTools(); });
            window.addEventListener("mars-mode", paintTools);
            stopTools = () => window.removeEventListener("mars-mode", paintTools);
            paintTools();

            // Compass and readout, in the spirit of a planetarium: which way is north, how high you are and what is below you.
            const needle = get("needle");
            const readout = get("readout");
            let readoutAt = 0;
            const ndcA = new THREE.Vector3(), ndcB = new THREE.Vector3(), tangent = new THREE.Vector3(), below = new THREE.Vector3();
            tickers.add(now =>
            {
                if (now - readoutAt < 120) return;

                readoutAt = now;
                const distance = camera.position.length();
                below.copy(camera.position).normalize();
                const place = toLatLon(below);
                const altitude = (distance - 1) * 3396.19;
                readout.textContent = `${altitude >= 100 ? Math.round(altitude).toLocaleString("en-US") + " km" : altitude.toFixed(1) + " km"} above the surface · ${Math.abs(place.lat).toFixed(2)}° ${place.lat >= 0 ? "N" : "S"} ${Math.abs(place.lon).toFixed(2)}° ${place.lon >= 0 ? "E" : "W"}`;
                tangent.set(0, 1, 0).addScaledVector(below, -below.y);

                if (tangent.lengthSq() < 1e-6)
                {
                    needle.style.transform = "rotate(0deg)";
                    return;
                }

                tangent.normalize().multiplyScalar(0.05).add(below);
                ndcA.copy(below).project(camera);
                ndcB.copy(tangent).project(camera);
                needle.style.transform = `rotate(${Math.atan2(ndcB.x - ndcA.x, ndcB.y - ndcA.y) * 180 / Math.PI}deg)`;
            });
            get("north").addEventListener("click", () => flyTo(new THREE.Vector3(0, 1, 0), 2.6));
            get("south").addEventListener("click", () => flyTo(new THREE.Vector3(0, -1, 0), 2.6));
            get("compass").addEventListener("click", () => flyTo(defaultDirection, 3.1));
            get("fold").addEventListener("click", event =>
            {
                const folded = layer.querySelector(".map-3d-panel").classList.toggle("is-folded");
                event.currentTarget.setAttribute("aria-expanded", String(!folded));
                event.currentTarget.textContent = folded ? "+" : "−";
            });

            const updateRouteText = () =>
            {
                readPoints();
                let total = 0;
                for (let i = 1; i < valid.length; i++) total += analyzeRoute([valid[i - 1], valid[i]]).totalDistance;
                get("route").textContent = valid.length >= 2
                    ? `Your route: ${valid.length} waypoints, ${formatDistance(total)} along the surface of Mars, anywhere on the planet.`
                    : valid.length === 1 ? "One waypoint placed. Add another to make a route." : "No route yet. Switch on Add waypoint and click the planet, or open a place and add it.";
            };

            applyFactor = () =>
            {
                applyRelief();
                drawRoute();
                drawSites();
                updateRouteText();
                controls.minDistance = minimumDistance();
            };

            // Changes made anywhere else (the 2D map, the editors, undo) show here at once.
            stopListening?.();
            const stopStore = subscribe ? subscribe(() => { drawRoute(); updateRouteText(); }) : null;
            const onLineStyle = () => drawRoute();
            window.addEventListener("mars-line-style", onLineStyle);
            stopListening = () => { stopStore?.(); stopTools?.(); window.removeEventListener("mars-line-style", onLineStyle); };
            mountLineControls(get("lines"), routeControls);
            controls.zoomSpeed = 1.3;
            camera.near = 0.002;
            camera.updateProjectionMatrix();

            flyIn = () =>
            {
                readPoints();
                const centre = vectors.length ? vectors.reduce((sum, vector) => sum.add(vector), new THREE.Vector3()).normalize() : defaultDirection;
                const direction = centre.lengthSq() > 0.25 ? centre : defaultDirection;
                controls.target.set(0, 0, 0);
                camera.position.copy(direction.clone().multiplyScalar(10));
                flyTo(direction, 3.1);
            };

            applyFactor();
            flyIn();
            globalMosaic(MOLA_DEM_URL, light ? 1 : 2, "png", "#000000").then(heights =>
            {
                if (disposed || id !== session) return;
                relief.width = heights.width;
                relief.height = heights.height;
                relief.data = heights.getContext("2d").getImageData(0, 0, heights.width, heights.height).data;
                applyFactor();
                status.textContent = "NASA 3D model of Mars · MOLA relief, exaggerated";
            }).catch(() => { if (!disposed && id === session) status.textContent = "Whole planet · imagery unavailable"; });
        };

        const build = async which =>
        {
            const id = ++session;
            mode = which;
            hud = which === "planet" ? null : hudKeep;
            controls.maxPolarAngle = which === "planet" ? Math.PI : Math.PI * 0.47;
            // A 1.2 km deep crater 50 km wide looks flat at true scale; the delta clip reads well at x3.
            factor = 6;
            get("ex").value = String(factor);
            get("ex-value").textContent = factor;
            get("eyebrow").textContent = COPY[which].eyebrow;
            get("title").textContent = COPY[which].title;
            get("copy").textContent = COPY[which].text;
            get("switch").textContent = COPY[which].switchLabel;
            if (which === "planet")
            {
                await buildPlanet(id);
                return;
            }

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
            // The whole planet is raised by the global MOLA heights (exaggerated). The detailed map starts from the planet's own
            // height at its edge and blends into its own relief over the outer 22%, so it melts into the planet instead of ending in a cliff.
            const relief = { data: null, width: 0, height: 0 };
            const reliefMax = () => radius * 0.09 * (factor / 3);
            const bodyDisp = (lat, lon) =>
            {
                if (!relief.data) return 0;

                const x = Math.min(relief.width - 1, Math.max(0, (lon + 180) / 360 * relief.width)), y = Math.min(relief.height - 1, Math.max(0, (90 - lat) / 180 * relief.height));
                const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(relief.width - 1, x0 + 1), y1 = Math.min(relief.height - 1, y0 + 1), tx = x - x0, ty = y - y0;
                const grey = (cx, cy) => relief.data[(cy * relief.width + cx) * 4];
                const value = grey(x0, y0) * (1 - tx) * (1 - ty) + grey(x1, y0) * tx * (1 - ty) + grey(x0, y1) * (1 - tx) * ty + grey(x1, y1) * tx * ty;
                return value / 255 * reliefMax();
            };
            const edgeWeight = (u, v) => { const t = Math.max(0, Math.min(1, Math.min(u, 1 - u, v, 1 - v) / 0.22)); return t * t * (3 - 2 * t); };
            const patchHeight = (elevation, u, v, lat, lon) =>
            {
                const w = edgeWeight(u, v);
                return bodyDisp(lat, lon) * (1 - w) + (bodyDisp(midLat, (bounds.west + bounds.east) / 2) + (elevation - minZ) * factor) * w;
            };
            const toScene = (point, elevation) =>
            {
                const u = (point.lon - bounds.west) / (bounds.east - bounds.west), v = (bounds.north - point.lat) / (bounds.north - bounds.south);
                return bend((u - 0.5) * spanX, patchHeight(elevation, u, v, point.lat, point.lon), (v - 0.5) * spanY);
            };

            if (scene) disposeTree(scene);
            scene = new THREE.Scene();
            tickers.clear();
            scene.background = new THREE.Color(0x0b1118);
            scene.fog = new THREE.Fog(0x0b1118, spanX * 2.2, spanX * 6);
            scene.add(new THREE.HemisphereLight(0xffe2cf, 0x1b2430, 0.9));
            const sun = new THREE.DirectionalLight(0xfff1e0, 1.6);
            sun.position.set(-spanX, spanX * 0.8, spanY * 0.6);
            scene.add(sun);
            camera.near = spanX / 2000;
            camera.far = spanX * 20;
            camera.updateProjectionMatrix();
            controls.minDistance = spanX * 0.15;
            controls.maxDistance = spanX * 3;

            // Faded space around the little planet: stars, other planets, shooting stars, satellites and a rocket.
            if (!light)
            {
                decorHandle = addSpaceDecor(THREE, scene, { radius: spanX, center: new THREE.Vector3(0, -spanX, 0), reduced: reducedMotion() });
                tickers.add(now => decorHandle.update(now));
            }

            // The Sun and two moons, plus dust on the wind.
            const sunDirection = sun.position.clone().normalize();
            const skySun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.1, "rgba(255,236,190,.95)"], [0.3, "rgba(255,170,90,.35)"], [1, "rgba(255,110,50,0)"]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
            skySun.position.copy(sunDirection).multiplyScalar(spanX * 9);
            skySun.scale.setScalar(spanX * 2.2);
            scene.add(skySun);
            const moons = [[0.045, 0.034, 0.0, 0x8a7a6c], [0.03, 0.012, 0.5, 0x7d6a5c]].map(([size, speed, phase, colour]) =>
            {
                const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(spanX * size, 2), new THREE.MeshStandardMaterial({ color: colour, roughness: 1, flatShading: true, fog: false, transparent: true, opacity: 0.7 }));
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
            const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 1 });
            const bodyGeometry = new THREE.SphereGeometry(radius - spanX * 0.003, 256, 128);
            const bodyBase = Float32Array.from(bodyGeometry.attributes.position.array);
            const bodyUv = bodyGeometry.attributes.uv;
            const applyBody = () =>
            {
                const position = bodyGeometry.attributes.position;

                for (let i = 0; i < position.count; i++)
                {
                    const x = bodyBase[i * 3], y = bodyBase[i * 3 + 1], z = bodyBase[i * 3 + 2];
                    const length = Math.hypot(x, y, z);
                    const scale = (length + bodyDisp(90 - (1 - bodyUv.getY(i)) * 180, bodyUv.getX(i) * 360 - 180)) / length;
                    position.setXYZ(i, x * scale, y * scale, z * scale);
                }

                position.needsUpdate = true;
                bodyGeometry.computeVertexNormals();
            };
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -radius;
            // Turn the sphere so the map's centre is on top, east to the right and north away from the camera.
            {
                const phi = ((bounds.west + bounds.east) / 2 + 180) / 360 * Math.PI * 2, theta = (90 - midLat) / 180 * Math.PI;
                const east = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
                const up = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
                const north = new THREE.Vector3(Math.cos(phi) * Math.cos(theta), Math.sin(theta), -Math.sin(phi) * Math.cos(theta));
                const local = new THREE.Matrix4().makeBasis(east, up, north);
                const target = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
                body.quaternion.setFromRotationMatrix(target.multiply(local.transpose()));
            }
            // Real Viking colour for the whole planet, and the real MOLA heights raised as relief all over it.
            globalMosaic(VIKING_URL, light ? 2 : 3).then(colour =>
            {
                if (disposed || id !== session) return;
                const map = new THREE.CanvasTexture(colour);
                map.colorSpace = THREE.SRGBColorSpace;
                map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                bodyMaterial.map = map;
                bodyMaterial.color.set(0xffffff);
                bodyMaterial.needsUpdate = true;
            }).catch(() => {});
            globalMosaic(MOLA_DEM_URL, light ? 1 : 2, "png", "#000000").then(canvas =>
            {
                if (disposed || id !== session) return;
                relief.width = canvas.width;
                relief.height = canvas.height;
                relief.data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
                applyFactor();
            }).catch(() => {});
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
                    const u = (i % width) / (width - 1), v = Math.floor(i / width) / (height - 1);
                    bend(flat[i * 3], patchHeight(elevations[i] ?? minZ, u, v, bounds.north - v * (bounds.north - bounds.south), bounds.west + u * (bounds.east - bounds.west)), flat[i * 3 + 2], scratch);
                    position.setXYZ(i, scratch.x, scratch.y, scratch.z);
                }

                position.needsUpdate = true;
                geometry.computeVertexNormals();
                applyBody();
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
            const sizeLabel = which === "crater" ? `${(spanX / 1000).toFixed(0)} × ${(spanY / 1000).toFixed(0)} km · illustrative MOLA relief (not meter-calibrated)` : `${Math.round(spanX)} × ${Math.round(spanY)} m · ${Math.round(maxZ - minZ)} m relief (CTX)`;
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
        get("switch").addEventListener("click", () => build({ crater: "delta", delta: "planet", planet: "crater" }[mode]).catch(() => { status.textContent = "3D terrain could not load. Check your connection."; }));
        await build(mode);
    }
    catch
    {
        status.textContent = "3D view could not load. Check your connection and try again.";
    }

    get("close").focus();
    return { close };
}
