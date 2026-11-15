// Welcome screen: a 3D Mars with its Sun, two moons and the Jezero landing site, then a short introduction.
// The globe is wrapped in the real Viking colour mosaic with MOLA relief shading from NASA Trek; a procedural surface is the offline fallback.
import { MAP_LAYERS } from "./constants.js";
import { addDeepSpace } from "./deep-space.js";
import { lowPower, createGovernor } from "./perf.js";

const VIKING_TILES = MAP_LAYERS.find(layer => layer.id === "viking").url + "/default/default028mm/";
const MOLA_TILES = MAP_LAYERS.find(layer => layer.id === "mola").url + "/default/default028mm/";
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const SKIP_KEY = "mars-home-skip";
const JEZERO = { lat: 18.44, lon: 77.45 };

const FACTS = [
    "Perseverance landed in Jezero Crater on 18 February 2021.",
    "A Martian year lasts 687 Earth days.",
    "Olympus Mons rises about 22 km, nearly 2.5 times the height of Everest.",
    "Jezero held a lake billions of years ago. Its river delta is still visible from orbit.",
    "A radio signal takes between 3 and 22 minutes to travel from Mars to Earth."
];

const STATS = [
    { html: `<span data-to="24">0</span> h <span data-to="39">0</span> min`, label: "One Martian day (a sol)" },
    { html: `<span data-to="3.71" data-dec="2">0</span> m/s²`, label: "Surface gravity, 38% of Earth's" },
    { html: `<span data-to="1.52" data-dec="2">0</span> AU`, label: "Average distance from the Sun" },
    { html: `−<span data-to="63">0</span> °C`, label: "Average surface temperature" }
];

const FEATURES = [
    { icon: "⌖", title: "Plan routes", text: "Click the map to place waypoints and drag them to adjust. Distances use the real radius of Mars." },
    { icon: "▲", title: "Read the terrain", text: "Slope and elevation profiles from USGS CTX heights, and a 3D view of Jezero Crater." },
    { icon: "⚖", title: "Compare and decide", text: "Put routes side by side and follow a step-by-step analysis. Every number says how it was made." }
];

const TECH = [["Claude","AI assistant for code and docs","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#d97757\"/><path d=\"M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z\" fill=\"#fff\"/></svg>"],["Codex","AI coding assistant","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#1f2937\"/><path d=\"M8 8 L4.5 12 L8 16 M16 8 L19.5 12 L16 16 M13 7 L11 17\" stroke=\"#fff\" stroke-width=\"1.8\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"],["HTML5","Structure of every page","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#e44d26\"/><path d=\"M5 4 L6.6 19 L12 20.5 L17.4 19 L19 4 Z\" fill=\"#fff\" opacity=\".95\"/><path d=\"M8 8 H16 M8.4 12 H15.6 M9 16 L12 17 L15 16 L15.3 13\" stroke=\"#e44d26\" stroke-width=\"1.4\" fill=\"none\"/></svg>"],["CSS3","Layout, themes and motion","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#1572b6\"/><path d=\"M5 4 L6.6 19 L12 20.5 L17.4 19 L19 4 Z\" fill=\"#fff\" opacity=\".95\"/><path d=\"M8 8 H16 M8.4 12 H15.6 M9 16 L12 17 L15 16 L15.3 13\" stroke=\"#1572b6\" stroke-width=\"1.4\" fill=\"none\"/></svg>"],["JavaScript","Every feature, no build step","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#f7df1e\"/><text x=\"12\" y=\"17\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"800\" fill=\"#000\" font-family=\"sans-serif\">JS</text></svg>"],["three.js","3D planet and globe","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#111827\"/><path d=\"M12 4 L19 18 H5 Z M12 4 V18 M8.5 11 H15.5\" stroke=\"#fff\" stroke-width=\"1.4\" fill=\"none\" stroke-linejoin=\"round\"/></svg>"],["WebGL","Graphics in the browser","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#990000\"/><circle cx=\"12\" cy=\"12\" r=\"6\" stroke=\"#fff\" stroke-width=\"1.6\" fill=\"none\"/><ellipse cx=\"12\" cy=\"12\" rx=\"6\" ry=\"2.4\" stroke=\"#fff\" stroke-width=\"1.2\" fill=\"none\"/></svg>"],["Supabase","Accounts and cloud missions","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#1c1c1c\"/><path d=\"M13.5 3 L5 13.5 H11 L10.5 21 L19 10.5 H13 Z\" fill=\"#3ecf8e\"/></svg>"],["GitHub","Code, tests and releases","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#24292f\"/><circle cx=\"12\" cy=\"12\" r=\"6.5\" fill=\"#fff\"/><path d=\"M10 17.5 V15 M14 17.5 V15\" stroke=\"#24292f\" stroke-width=\"1.6\"/></svg>"],["Vercel","Hosting","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#000\"/><path d=\"M12 6 L19 18 H5 Z\" fill=\"#fff\"/></svg>"],["Netlify","Hosting","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#0e1e25\"/><path d=\"M12 5 L19 12 L12 19 L5 12 Z\" fill=\"#00c7b7\"/></svg>"],["NASA Mars Trek","Maps and heights","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"24\" height=\"24\" rx=\"6\" fill=\"#0b3d91\"/><circle cx=\"12\" cy=\"12\" r=\"6.5\" fill=\"#fff\"/><path d=\"M5.5 12 Q12 4 18.5 12 Q12 20 5.5 12\" stroke=\"#e03c31\" stroke-width=\"1.6\" fill=\"none\"/></svg>"]];

const SOURCES = ["Viking MDIM 2.1 colour mosaic", "HiRISE Jezero orthomosaic · NASA / JPL / University of Arizona", "MOLA elevation · NASA / GSFC", "CTX DEM · USGS (Fergason et al., 2020)", "3D model of Mars · NASA/JPL-Caltech", "Photos · NASA Image and Video Library"];

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function hash3(x, y, z)
{
    const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return h - Math.floor(h);
}

function noise3(x, y, z)
{
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = (x - xi) ** 2 * (3 - 2 * (x - xi)), v = (y - yi) ** 2 * (3 - 2 * (y - yi)), w = (z - zi) ** 2 * (3 - 2 * (z - zi));
    const mix = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return mix(mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v), mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

function fbm(x, y, z, octaves)
{
    let sum = 0, amplitude = 0.5, frequency = 1;

    for (let i = 0; i < octaves; i++)
    {
        sum += noise3(x * frequency, y * frequency, z * frequency) * amplitude;
        frequency *= 2.03;
        amplitude *= 0.5;
    }

    return sum;
}

const RAMP = [[0, [58, 32, 24]], [0.32, [128, 62, 36]], [0.58, [186, 102, 58]], [0.8, [218, 156, 104]], [1, [238, 204, 160]]];

function ramp(t)
{
    for (let i = 1; i < RAMP.length; i++)
    {
        if (t <= RAMP[i][0])
        {
            const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i], k = (t - t0) / (t1 - t0);
            return c0.map((value, index) => value + (c1[index] - value) * k);
        }
    }

    return RAMP.at(-1)[1];
}

const smooth = (edge0, edge1, x) => { const t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); };
const VOLCANO = (() => { const length = Math.hypot(0.3, 0.15, -0.94); return [0.3 / length, 0.15 / length, -0.94 / length]; })();

// Bowl with a raised rim; every cell may hold one crater that stays inside the cell, so there are no cut-off edges.
function craters(x, y, z, scale)
{
    const sx = x * scale, sy = y * scale, sz = z * scale;
    const cx = Math.floor(sx), cy = Math.floor(sy), cz = Math.floor(sz);

    if (hash3(cx * 1.3 + 7, cy * 1.7, cz * 2.1) > 0.5) return 0;

    const dx = sx - cx - (0.36 + 0.28 * hash3(cx, cy + 3, cz)), dy = sy - cy - (0.36 + 0.28 * hash3(cx + 5, cy, cz)), dz = sz - cz - (0.36 + 0.28 * hash3(cx, cy, cz + 9));
    const radius = 0.1 + 0.2 * hash3(cx + 2, cy + 8, cz + 4);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;

    if (d > 1.4) return 0;

    return (d < 1 ? -(1 - d * d) * 0.85 : 0) + Math.exp(-((d - 1.05) ** 2) * 55) * 0.5;
}

// Rust terrain with dark basalt plains, impact craters, a long canyon, a large volcano and bright polar caps.
// Sampled in 3D (no seam or pole pinch) and built a few rows per frame so the page never freezes.
async function marsTextures(width, height)
{
    const colour = document.createElement("canvas"), bump = document.createElement("canvas");
    colour.width = bump.width = width;
    colour.height = bump.height = height;
    const colourContext = colour.getContext("2d"), bumpContext = bump.getContext("2d");
    const colourData = colourContext.createImageData(width, height), bumpData = bumpContext.createImageData(width, height);

    for (let py = 0; py < height; py++)
    {
        const theta = (py + 0.5) / height * Math.PI;

        for (let px = 0; px < width; px++)
        {
            const phi = (px + 0.5) / width * Math.PI * 2;
            const x = -Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
            const base = fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 5), detail = fbm(x * 8, y * 8, z * 8, 3), plains = fbm(x * 0.9 + 9, y * 0.9, z * 0.9, 3);
            const ridge = 1 - Math.abs(fbm(x * 3.2, y * 3.2 + 5, z * 3.2, 4) * 2 - 1);
            const hit = craters(x, y, z, 5) + craters(x, y, z, 12) * 0.7 + craters(x, y, z, 26) * 0.45;
            const centreLine = -0.2 + 0.05 * Math.sin(phi * 5), envelope = clamp(1 - Math.abs((phi - 4.15) / 0.62), 0, 1);
            const canyon = Math.exp(-((y - centreLine) ** 2) / 0.00035) * envelope;
            const angle = Math.acos(clamp(x * VOLCANO[0] + y * VOLCANO[1] + z * VOLCANO[2], -1, 1));
            const volcano = Math.exp(-((angle / 0.13) ** 2)) * 0.45 - (angle < 0.03 ? 0.12 : 0);
            const height01 = clamp(base * 0.55 + detail * 0.14 + ridge * 0.12 + hit * 0.22 + volcano - canyon * 0.45, 0, 1);
            let [r, g, b] = ramp(clamp((height01 - 0.2) * 1.85, 0, 1));
            const dark = (0.52 + 0.48 * smooth(0.42, 0.5, plains)) * (1 + Math.min(0, hit) * 0.35) * (1 - canyon * 0.5);
            r *= dark; g *= dark; b *= dark;
            const cap = clamp((Math.abs(y) - 0.9) * 22 + (detail - 0.5) * 3, 0, 1);
            r += (244 - r) * cap; g += (236 - g) * cap; b += (232 - b) * cap;
            const index = (py * width + px) * 4;
            colourData.data[index] = r; colourData.data[index + 1] = g; colourData.data[index + 2] = b; colourData.data[index + 3] = 255;
            const grey = clamp(height01 + hit * 0.25, 0, 1) * 255;
            bumpData.data[index] = bumpData.data[index + 1] = bumpData.data[index + 2] = grey; bumpData.data[index + 3] = 255;
        }

        if (py % 24 === 23) await new Promise(requestAnimationFrame);
    }

    colourContext.putImageData(colourData, 0, 0);
    bumpContext.putImageData(bumpData, 0, 0);
    return { colour, bump };
}

// Thin water-ice clouds: white with an alpha channel.
function cloudCanvas(width = 512, height = 256)
{
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d"), data = context.createImageData(width, height);

    for (let py = 0; py < height; py++)
    {
        const theta = (py + 0.5) / height * Math.PI;

        for (let px = 0; px < width; px++)
        {
            const phi = (px + 0.5) / width * Math.PI * 2;
            const x = -Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
            const alpha = smooth(0.52, 0.78, fbm(x * 2.4 + 20, y * 4.2, z * 2.4, 4)) * 0.55;
            const index = (py * width + px) * 4;
            data.data[index] = 255; data.data[index + 1] = 240; data.data[index + 2] = 232; data.data[index + 3] = alpha * 255;
        }
    }

    context.putImageData(data, 0, 0);
    return canvas;
}

function raysTexture(THREE)
{
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    context.translate(256, 256);

    for (let i = 0; i < 14; i++)
    {
        context.rotate(Math.PI * 2 / 14);
        const gradient = context.createLinearGradient(0, 0, 0, -250);
        gradient.addColorStop(0, "rgba(255,210,150,.55)");
        gradient.addColorStop(1, "rgba(255,150,80,0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(-5 - (i % 3) * 3, 0);
        context.lineTo(0, -250 + (i % 4) * 40);
        context.lineTo(5 + (i % 3) * 3, 0);
        context.fill();
    }

    return new THREE.CanvasTexture(canvas);
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

// Global equirectangular mosaic: 2^(zoom+1) columns by 2^zoom rows of 256 px tiles, longitude -180 at the left edge.
async function tileMosaic(base, zoom, extension = "jpg")
{
    const columns = 2 ** (zoom + 1), rows = 2 ** zoom;
    const canvas = document.createElement("canvas");
    canvas.width = columns * 256;
    canvas.height = rows * 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "#8a4a2c";
    context.fillRect(0, 0, canvas.width, canvas.height);
    let loaded = 0;
    const jobs = [];

    for (let y = 0; y < rows; y++)
    {
        for (let x = 0; x < columns; x++)
        {
            jobs.push(loadImage(base + zoom + "/" + y + "/" + x + "." + extension).then(image => { context.drawImage(image, x * 256, y * 256); loaded++; }, () => {}));
        }
    }

    await Promise.all(jobs);

    if (!loaded) throw new Error("no tiles");

    return canvas;
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

function lumpyMoon(THREE, radius, seed)
{
    const geometry = new THREE.IcosahedronGeometry(radius, 3);
    const position = geometry.attributes.position;

    for (let i = 0; i < position.count; i++)
    {
        const v = new THREE.Vector3().fromBufferAttribute(position, i);
        v.multiplyScalar(1 + (noise3(v.x * 9 + seed, v.y * 9, v.z * 9) - 0.5) * 0.45);
        position.setXYZ(i, v.x, v.y, v.z);
    }

    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x7d6a5c, roughness: 1, flatShading: true }));
}

function directionFor(lat, lon)
{
    const phi = (lon + 180) / 360 * Math.PI * 2, theta = (90 - lat) / 180 * Math.PI;
    return { x: -Math.cos(phi) * Math.sin(theta), y: Math.cos(theta), z: Math.sin(phi) * Math.sin(theta) };
}

function pageMarkup()
{
    return `
        <div class="home-canvas" aria-hidden="true"><div class="home-fallback-mars"></div></div>
        <div class="home-vignette" aria-hidden="true"></div><div class="home-glow" aria-hidden="true"></div>
        <header class="home-top">
            <div class="home-brand"><span class="home-brand-mark" aria-hidden="true"></span><span>MARS <strong>ATLAS</strong></span></div>
            <button type="button" class="home-skip" data-home="skip">Skip intro <span aria-hidden="true">→</span></button>
        </header>
        <section class="home-hero">
            <div class="home-copy">
                <span class="home-eyebrow"><i></i> NASA SPACE APPS 2026 · JEZERO CRATER</span>
                <h1 id="home-title"><span class="line">Plan a walk</span><span class="line">on <em>Mars</em>.</span></h1>
                <p class="home-lede">Draw a route across Jezero Crater, read its slopes and heights, and see it in 3D. Built on public NASA and USGS data.</p>
                <div class="home-cta">
                    <button type="button" class="home-btn home-btn-primary" data-home="start">Start exploring <span aria-hidden="true">→</span></button>
                    <button type="button" class="home-btn" data-home="demo">Open the example mission</button>
                    <button type="button" class="home-btn home-btn-ghost" data-home="tour">Take the tour</button>
                </div>
                <p class="home-fact" aria-live="polite"><span>DID YOU KNOW</span><b id="home-fact-text">${FACTS[0]}</b></p>
            </div>
            <div class="home-label" hidden><span class="home-label-dot"></span><div><strong>JEZERO CRATER</strong><small>18.4° N · 77.5° E · Perseverance landing site</small></div></div>
            <div class="home-scroll" aria-hidden="true"><span>Scroll</span><i></i></div>
        </section>
        <section class="home-section">
            <div class="home-stats">${STATS.map(stat => `<div class="home-stat reveal"><strong>${stat.html}</strong><span>${stat.label}</span></div>`).join("")}</div>
        </section>
        <section class="home-section">
            <h2 class="home-h2 reveal">Everything for a first plan</h2>
            <div class="home-features">${FEATURES.map((item, index) => `<article class="home-card reveal" style="--i:${index}"><span class="home-card-icon" aria-hidden="true">${item.icon}</span><h3>${item.title}</h3><p>${item.text}</p></article>`).join("")}</div>
        </section>
        <section class="home-section home-tech reveal" aria-label="Tools used to build Mars Atlas">
            <h2 class="home-h2">Built with</h2>
            <div class="home-marquee"><div class="home-marquee-track">${[...TECH, ...TECH].map(([name, note, svg]) => `<span class="home-tool" title="${note}">${svg}<b>${name}</b><small>${note}</small></span>`).join("")}</div></div>
            <p class="home-tech-note">Logos are simplified marks used only to name the tools; they belong to their owners.</p>
        </section>
        <section class="home-section">
            <h2 class="home-h2 reveal">Built on real data</h2>
            <ul class="home-sources reveal">${SOURCES.map(text => `<li>${text}</li>`).join("")}</ul>
            <p class="home-disclaimer reveal">Mars Atlas is an independent project. It is not certified or approved by NASA, and it is a planning aid, not for real navigation. The globe above uses NASA Viking and MOLA imagery. <a href="./legal.html#terms">Terms</a> · <a href="./legal.html#privacy">Privacy</a> · <a href="./legal.html#cookies">Cookies</a> · <a href="./legal.html#credits">Credits</a> Built with AI assistance (Claude by Anthropic) for code and documentation.</p>
        </section>
        <footer class="home-footer reveal">
            <button type="button" class="home-btn home-btn-primary" data-home="start">Start exploring <span aria-hidden="true">→</span></button>
            <label class="home-remember"><input type="checkbox" data-home="remember"> Skip this intro next time</label>
        </footer>`;
}

export function mountHome({ onStart, onDemo, onTour, force = false } = {})
{
    try
    {
        if (!force && localStorage.getItem(SKIP_KEY) === "1") return null;
    }
    catch { /* storage blocked: show the intro */ }

    const root = document.createElement("div");
    root.className = "home";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "home-title");
    root.innerHTML = pageMarkup();
    document.body.appendChild(root);
    const app = document.getElementById("app");
    if (app) app.inert = true;
    root.querySelector('[data-home="start"]').focus({ preventScroll: true });
    try { root.querySelector('[data-home="remember"]').checked = localStorage.getItem(SKIP_KEY) === "1"; } catch { /* storage blocked */ }

    const state = { closing: false, disposed: false, dive: null, after: null };
    const parts = {};
    const canvasHost = root.querySelector(".home-canvas");
    const label = root.querySelector(".home-label");

    function finish()
    {
        if (state.disposed) return;
        state.disposed = true;
        // Free the GPU memory of the intro; the planner needs it.
        parts.scene?.traverse(object =>
        {
            object.geometry?.dispose();

            for (const material of [].concat(object.material || []))
            {
                material.map?.dispose();
                material.bumpMap?.dispose();
                material.dispose();
            }
        });
        parts.renderer?.dispose();
        parts.renderer?.forceContextLoss();
        root.classList.add("is-leaving");
        if (app) app.inert = false;
        const remove = () => { root.remove(); window.dispatchEvent(new Event("mars-home-closed")); state.after?.(); };
        setTimeout(remove, reducedMotion() ? 0 : 520);
        removeEventListener("keydown", onKey);
    }

    function close(afterwards, dive = true)
    {
        if (state.closing) return;
        state.closing = true;
        state.after = afterwards;

        try { localStorage.setItem(SKIP_KEY, root.querySelector('[data-home="remember"]').checked ? "1" : "0"); } catch { /* storage blocked */ }

        if (dive && parts.camera && !reducedMotion())
        {
            // The flight is drawn by the render loop, which pauses when scrolled down, so return to the top first.
            root.scrollTo({ top: 0, behavior: "instant" });
            scrollProgress = 0;
            canvasHost.style.opacity = "1";
            root.classList.add("is-diving");
            state.dive = { start: performance.now(), duration: 2100 };
        }
        else
        {
            finish();
        }
    }

    const onKey = event => { if (event.key === "Escape") close(null, false); };
    addEventListener("keydown", onKey);
    root.addEventListener("click", event =>
    {
        const action = event.target.closest("[data-home]")?.dataset.home;

        if (action === "start") close(onStart);
        else if (action === "demo") close(onDemo);
        else if (action === "tour") close(onTour, false);
        else if (action === "skip") close(null, false);
    });

    // Scroll-linked fade of the globe, reveal of sections and counting numbers.
    let scrollProgress = 0;
    root.addEventListener("scroll", () =>
    {
        scrollProgress = clamp(root.scrollTop / (innerHeight * 0.9), 0, 1);
        canvasHost.style.opacity = String(1 - scrollProgress * 0.7);
    }, { passive: true });

    const observer = new IntersectionObserver(entries =>
    {
        for (const entry of entries)
        {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("in");
            entry.target.querySelectorAll("[data-to]").forEach(countUp);
            observer.unobserve(entry.target);
        }
    }, { root, threshold: 0.25 });
    root.querySelectorAll(".reveal").forEach(element => observer.observe(element));

    function countUp(element)
    {
        const target = Number(element.dataset.to), decimals = Number(element.dataset.dec || 0), start = performance.now();
        if (reducedMotion()) { element.textContent = target.toFixed(decimals); return; }
        const step = now =>
        {
            const t = clamp((now - start) / 1400, 0, 1);
            element.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
            if (t < 1 && !state.disposed) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    let factIndex = 0;
    const factText = root.querySelector("#home-fact-text");
    const factTimer = setInterval(() =>
    {
        if (state.disposed) { clearInterval(factTimer); return; }
        factText.classList.add("is-out");
        setTimeout(() => { factIndex = (factIndex + 1) % FACTS.length; factText.textContent = FACTS[factIndex]; factText.classList.remove("is-out"); }, 380);
    }, 5200);

    import(THREE_URL).then(THREE => buildScene(THREE)).catch(() => root.classList.add("no-webgl"));

    function buildScene(THREE)
    {
        if (state.disposed) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const light = lowPower();
        renderer.setPixelRatio(light ? 1 : Math.min(devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        canvasHost.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
        camera.position.set(0, 0, 7.4);
        Object.assign(parts, { renderer, camera, scene });

        const stage = new THREE.Group();
        const tilt = new THREE.Group();
        tilt.rotation.z = THREE.MathUtils.degToRad(25.2);
        stage.add(tilt);
        scene.add(stage);

        const marsMaterial = new THREE.MeshStandardMaterial({ color: 0x8a4a2c, bumpScale: 0.1, roughness: 1, metalness: 0 });
        const mars = new THREE.Mesh(new THREE.SphereGeometry(2, 128, 96), marsMaterial);
        const surface = { map: null, bump: null };
        const applySurface = (colour, bump, bumpScale) =>
        {
            if (state.disposed) return;
            surface.map?.dispose();
            surface.bump?.dispose();
            surface.map = new THREE.CanvasTexture(colour);
            surface.map.colorSpace = THREE.SRGBColorSpace;
            surface.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
            surface.bump = bump ? new THREE.CanvasTexture(bump) : null;
            marsMaterial.map = surface.map;
            marsMaterial.bumpMap = surface.bump;
            marsMaterial.bumpScale = bumpScale;
            marsMaterial.color.set(0xffffff);
            marsMaterial.needsUpdate = true;
            root.classList.add("surface-ready");
        };
        // Quick low-resolution globe first, then the sharp one; if NASA Trek cannot be reached, a painted surface is used.
        tileMosaic(VIKING_TILES, 1)
            .then(preview => { applySurface(preview, null, 0); return Promise.all([tileMosaic(VIKING_TILES, light ? 2 : 3), tileMosaic(MOLA_TILES, light ? 1 : 2)]); })
            .then(([colour, relief]) => applySurface(colour, relief, 0.05))
            .catch(() => marsTextures(light ? 768 : 1280, light ? 384 : 640).then(({ colour, bump }) => applySurface(colour, bump, 0.1)));
        tilt.add(mars);

        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.22, 96, 64), new THREE.ShaderMaterial({
            transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
            vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
            fragmentShader: "varying vec3 n; void main(){ float i = pow(0.74 - dot(n, vec3(0.0, 0.0, 1.0)), 3.2); gl_FragColor = vec4(1.0, 0.52, 0.32, 1.0) * i * 1.7; }"
        }));
        stage.add(atmosphere);

        // Jezero: pulsing ring on the surface and a label that follows it.
        const direction = directionFor(JEZERO.lat, JEZERO.lon);
        const normal = new THREE.Vector3(direction.x, direction.y, direction.z);
        const pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd3a8 }));
        pin.position.copy(normal).multiplyScalar(2.02);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffa070, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 48), ringMaterial);
        ring.position.copy(normal).multiplyScalar(2.02);
        ring.lookAt(normal.clone().multiplyScalar(4));
        mars.add(pin, ring);
        const faceJezero = -Math.atan2(direction.x, direction.z) - 0.35;
        mars.rotation.y = faceJezero;

        // Sun: a glowing disc behind the planet with soft flares, plus warm light on Mars.
        const sunPosition = new THREE.Vector3(-4.6, 2.5, -8);
        const sunMaterial = new THREE.SpriteMaterial({ map: glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.12, "rgba(255,236,190,.95)"], [0.3, "rgba(255,170,90,.38)"], [0.6, "rgba(255,110,50,.12)"], [1, "rgba(255,90,40,0)"]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
        const sun = new THREE.Sprite(sunMaterial);
        sun.position.copy(sunPosition);
        sun.scale.setScalar(9);
        scene.add(sun);
        const flareTexture = glowTexture(THREE, [[0, "rgba(255,200,140,.0)"], [0.7, "rgba(255,190,130,.22)"], [0.85, "rgba(255,160,100,.35)"], [1, "rgba(255,140,80,0)"]]);
        const flares = [0.35, 0.62, 0.9].map((k, index) =>
        {
            const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.55 - index * 0.12 }));
            flare.position.lerpVectors(sunPosition, new THREE.Vector3(0, 0, 3), k);
            flare.scale.setScalar(1.1 + index * 0.6);
            flare.renderOrder = 5;
            scene.add(flare);
            return flare;
        });
        const sunLight = new THREE.DirectionalLight(0xffe2c4, 3.1);
        sunLight.position.set(-6, 2.6, 5);
        scene.add(sunLight);
        const rim = new THREE.DirectionalLight(0xff9a60, 1.4);
        rim.position.copy(sunPosition);
        scene.add(rim);
        scene.add(new THREE.HemisphereLight(0x8fa8d0, 0x2a1810, 0.28));

        // Stars, with the nearer ones twinkling.
        const makeStars = (count, size, spread) =>
        {
            const positions = new Float32Array(count * 3);

            for (let i = 0; i < count; i++)
            {
                const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), radius = spread * (0.8 + Math.random() * 0.4);
                positions.set([radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)], i * 3);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdfe8ff, size, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
        };
        const farStars = makeStars(2600, 0.16, 90), nearStars = makeStars(420, 0.34, 60);
        scene.add(farStars, nearStars);
        // The Milky Way, Andromeda, nebulae, comets, the asteroid belt and every planet, far behind Mars.
        const deep = addDeepSpace(THREE, scene, { reduced: reducedMotion(), light });

        // Phobos and Deimos on faint orbit lines.
        const orbit = (radius, tiltAngle) =>
        {
            const points = Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * Math.PI * 2) * radius, 0, Math.sin(i / 160 * Math.PI * 2) * radius));
            const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffb890, transparent: true, opacity: 0.13 }));
            const group = new THREE.Group();
            group.rotation.set(tiltAngle, 0, 0.1);
            group.add(line);
            stage.add(group);
            return group;
        };
        const phobosOrbit = orbit(3.1, 0.18), deimosOrbit = orbit(4.3, -0.12);
        const phobos = lumpyMoon(THREE, 0.1, 1), deimos = lumpyMoon(THREE, 0.07, 7);
        phobosOrbit.add(phobos);
        deimosOrbit.add(deimos);

        // Orbiter with solar panels and a blinking light, circling low over the poles.
        const orbiterOrbit = new THREE.Group();
        orbiterOrbit.rotation.set(1.2, 0.5, 0);
        const orbiter = new THREE.Group();
        orbiter.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.08), new THREE.MeshStandardMaterial({ color: 0xc9b27a, metalness: 0.6, roughness: 0.4 })));

        for (const side of [-1, 1])
        {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.004, 0.055), new THREE.MeshStandardMaterial({ color: 0x2c4a7a, metalness: 0.8, roughness: 0.3 }));
            panel.position.x = side * 0.11;
            orbiter.add(panel);
        }

        const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,120,90,.8)"], [1, "rgba(255,80,60,0)"]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        blink.scale.setScalar(0.18);
        blink.position.y = 0.04;
        orbiter.add(blink);
        orbiter.position.set(2.5, 0, 0);
        orbiterOrbit.add(orbiter);
        stage.add(orbiterOrbit);

        // Thin clouds that drift slightly faster than the ground.
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(2.035, 96, 64), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cloudCanvas()), transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 }));
        tilt.add(clouds);

        // Sun corona: slowly turning rays behind the disc.
        const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTexture(THREE), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
        corona.position.copy(sunPosition);
        corona.scale.setScalar(17);
        scene.add(corona);

        // Dust blowing across the view.
        const dustCount = 240;
        const dustPositions = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) dustPositions.set([(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 9, Math.random() * 6 - 1], i * 3);
        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
        const dustPoints = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xffb890, size: 0.035, transparent: true, opacity: 0.38, depthWrite: false }));
        scene.add(dustPoints);

        // Occasional shooting stars.
        const meteors = Array.from({ length: 2 }, () =>
        {
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
            const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
            line.frustumCulled = false;
            scene.add(line);
            return { line, geometry, life: 0, wait: 1.5 + Math.random() * 4, start: new THREE.Vector3(), direction: new THREE.Vector3() };
        });

        // Satellites: a ring of six, one relay station, and a few small ones on their own orbits.
        const sharedGlow = glowTexture(THREE, [[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]);
        const glowSprite = (colour, size, opacity = 1) =>
        {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sharedGlow, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
            sprite.scale.setScalar(size);
            return sprite;
        };
        const makeSatellite = (size, blinkColour = 0xff7a5c) =>
        {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.07), new THREE.MeshStandardMaterial({ color: 0xd8c690, metalness: 0.7, roughness: 0.35 })));

            for (const side of [-1, 1])
            {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.05), new THREE.MeshStandardMaterial({ color: 0x2e4f86, metalness: 0.8, roughness: 0.3 }));
                panel.position.x = side * 0.095;
                group.add(panel);
            }

            const dish = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.5, roughness: 0.4 }));
            dish.position.set(0, 0.035, 0);
            group.add(dish);
            const light = glowSprite(blinkColour, 0.16);
            light.position.y = 0.05;
            group.add(light);
            group.scale.setScalar(size);
            group.userData.light = light;
            return group;
        };

        const satelliteRing = orbit(2.9, 0.6);
        const ringSatellites = Array.from({ length: 6 }, (_, index) =>
        {
            const satellite = makeSatellite(0.8);
            const angle = index / 6 * Math.PI * 2;
            satellite.position.set(Math.cos(angle) * 2.9, 0, Math.sin(angle) * 2.9);
            satellite.rotation.y = -angle;
            satelliteRing.add(satellite);
            return satellite;
        });
        const relayOrbit = orbit(3.75, -0.38);
        const relay = makeSatellite(2.1, 0x75d1c8);
        relay.position.set(3.75, 0, 0);
        relayOrbit.add(relay);
        const smallOrbits = [[2.45, 0.9, 1.05], [3.35, -0.7, 0.8], [2.7, 1.45, 0.6]].map(([radius, inclination, speed], index) =>
        {
            const holder = orbit(radius, inclination);
            const small = makeSatellite(0.55, index === 1 ? 0xffd27a : 0xff7a5c);
            small.position.set(radius, 0, 0);
            holder.add(small);
            return { holder, small, speed, phase: index * 2.1 };
        });

        // A link from the relay down to Jezero, with a pulse travelling along it.
        const beamGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const beam = new THREE.Line(beamGeometry, new THREE.LineBasicMaterial({ color: 0x75d1c8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.frustumCulled = false;
        const linkPulse = glowSprite(0xb6fff4, 0.2);
        scene.add(beam, linkPulse);

        // A rocket crossing from Earth's side, with a flickering flame and a fading trail.
        const rocket = new THREE.Group();
        const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf1f1f1, metalness: 0.3, roughness: 0.35 }));
        const rocketNose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd2463a, roughness: 0.4 }));
        rocketNose.position.z = 0.235;
        const rocketBell = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x555a63, metalness: 0.8, roughness: 0.4 }));
        rocketBell.position.z = -0.2;
        rocket.add(rocketBody, rocketNose, rocketBell);

        for (let i = 0; i < 3; i++)
        {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.09, 0.09), new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.5 }));
            const holder = new THREE.Group();
            fin.position.set(0, 0.07, -0.12);
            holder.add(fin);
            holder.rotation.z = i / 3 * Math.PI * 2;
            rocket.add(holder);
        }

        const flame = glowSprite(0xffa050, 0.34);
        flame.position.z = -0.3;
        const flameCore = glowSprite(0xfff1c8, 0.16);
        flameCore.position.z = -0.26;
        rocket.add(flame, flameCore);
        rocket.scale.setScalar(0.9);
        rocket.visible = false;
        scene.add(rocket);
        const trail = Array.from({ length: 42 }, () => { const sprite = glowSprite(0xffb070, 0.1, 0); sprite.visible = false; scene.add(sprite); return { sprite, life: 0 }; });
        const flight = { t: -1, wait: 2.5, origin: new THREE.Vector3(), emitted: 0, next: 0 };
        const flightPoint = (t, target) =>
        {
            const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
            return target.set(-11 * a - 2 * b + 6 * c, -3.5 * a - 4.2 * b + 2.2 * c, -2 * a + 4.2 * b + 2.5 * c).add(flight.origin);
        };
        const rocketAhead = new THREE.Vector3(), tailPoint = new THREE.Vector3();

        // Dragging spins the planet; it keeps a little momentum.
        let spin = 0, dragging = false, lastX = 0;
        const pointer = { x: 0, y: 0 };
        canvasHost.style.pointerEvents = "auto";
        canvasHost.addEventListener("pointerdown", event => { dragging = true; lastX = event.clientX; canvasHost.setPointerCapture(event.pointerId); });
        canvasHost.addEventListener("pointerup", () => { dragging = false; });
        canvasHost.addEventListener("pointermove", event =>
        {
            if (dragging) { spin += (event.clientX - lastX) * 0.0022; lastX = event.clientX; }
        });
        root.addEventListener("pointermove", event => { root.style.setProperty("--mx", event.clientX + "px"); root.style.setProperty("--my", event.clientY + "px"); pointer.x = event.clientX / innerWidth - 0.5; pointer.y = event.clientY / innerHeight - 0.5; });

        let layout = { x: 1.75, y: 0, scale: 1 };
        const resize = () =>
        {
            const width = canvasHost.clientWidth, height = canvasHost.clientHeight;
            renderer.setSize(width, height, false);
            camera.aspect = width / Math.max(1, height);
            camera.updateProjectionMatrix();
            layout = width > 900 ? { x: 1.75, y: 0, scale: 1 } : { x: 0, y: 1.15, scale: width > 520 ? 0.85 : 0.68 };
        };
        addEventListener("resize", resize);
        resize();
        stage.position.set(layout.x, layout.y, 0);

        const world = new THREE.Vector3(), toCamera = new THREE.Vector3(), centre = new THREE.Vector3();
        const clock = new THREE.Clock();
        root.classList.add("has-webgl");
        let last = performance.now();
        // On a slow computer the extras go first: clouds, dust, satellites, shooting stars and the rocket.
        const lighten = () =>
        {
            renderer.setPixelRatio(1);
            resize();
            clouds.visible = false;
            deep.setVisible(false);
            dustPoints.visible = false;
            [orbiterOrbit, satelliteRing, relayOrbit, ...smallOrbits.map(item => item.holder)].forEach(group => { group.visible = false; });
            meteors.forEach(meteor => { meteor.wait = 1e9; meteor.line.visible = false; });
            flight.wait = 1e9;
            rocket.visible = false;
        };
        if (light) lighten();
        const governor = createGovernor(() => lighten());

        const frame = now =>
        {
            if (state.disposed) return;
            requestAnimationFrame(frame);
            if (document.hidden || (scrollProgress > 0.97 && !state.dive)) return;
            governor.tick(now);
            deep.update(now);
            const delta = Math.min(0.05, (now - last) / 1000);
            last = now;
            const time = clock.getElapsedTime();
            const motion = reducedMotion() ? 0 : 1;

            spin *= dragging ? 0.8 : 0.94;
            mars.rotation.y += state.dive ? 0 : 0.05 * motion * delta + spin;

            phobosOrbit.rotation.y = time * 0.9 * motion;
            deimosOrbit.rotation.y = time * 0.38 * motion + 2;
            phobos.position.set(3.1, 0, 0);
            deimos.position.set(4.3, 0, 0);
            phobos.rotation.y = time; deimos.rotation.y = time * 0.5;
            farStars.rotation.y = time * 0.004 * motion;
            nearStars.rotation.y = time * 0.007 * motion;
            nearStars.material.opacity = 0.65 + Math.sin(time * 2.2) * 0.2;
            sun.scale.setScalar(9 + Math.sin(time * 0.9) * 0.45);
            const pulse = (time * 0.7) % 1;
            ring.scale.setScalar(1 + pulse * 2.6);
            ringMaterial.opacity = (1 - pulse) * 0.9;

            orbiterOrbit.rotation.y = 0.5 + time * 0.55 * motion;
            blink.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(time * 5));
            clouds.rotation.y += 0.012 * motion * delta;
            corona.material.rotation = time * 0.05 * motion;
            corona.scale.setScalar(17 + Math.sin(time * 0.6) * 0.8);
            atmosphere.scale.setScalar(1 + Math.sin(time * 0.8) * 0.006);

            for (let i = 0; i < dustCount; i++)
            {
                const index = i * 3;
                dustPositions[index] += (0.22 + (i % 5) * 0.06) * delta * motion;
                dustPositions[index + 1] += Math.sin(time * 0.6 + i) * 0.03 * delta * motion;
                if (dustPositions[index] > 9) dustPositions[index] = -9;
            }

            dustGeometry.attributes.position.needsUpdate = true;

            for (const meteor of meteors)
            {
                if (meteor.life <= 0)
                {
                    meteor.wait -= delta;
                    if (meteor.wait > 0 || !motion) continue;
                    meteor.start.set(-14 + Math.random() * 22, 3 + Math.random() * 6, -22);
                    meteor.direction.set(-(0.8 + Math.random() * 0.5), -(0.25 + Math.random() * 0.2), 0).multiplyScalar(14);
                    meteor.life = 1;
                    meteor.wait = 3 + Math.random() * 5;
                    continue;
                }

                meteor.life -= delta * 1.3;
                const head = meteor.start.clone().addScaledVector(meteor.direction, 1 - Math.max(0, meteor.life));
                const tail = head.clone().addScaledVector(meteor.direction, -0.22);
                meteor.geometry.attributes.position.setXYZ(0, head.x, head.y, head.z);
                meteor.geometry.attributes.position.setXYZ(1, tail.x, tail.y, tail.z);
                meteor.geometry.attributes.position.needsUpdate = true;
                meteor.line.material.opacity = Math.max(0, Math.sin(Math.max(0, meteor.life) * Math.PI)) * 0.9;
            }

            satelliteRing.rotation.y = time * 0.32 * motion;
            relayOrbit.rotation.y = time * 0.16 * motion + 1;
            ringSatellites.forEach((satellite, index) => { satellite.userData.light.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(time * 4 + index * 1.7)); });
            relay.userData.light.material.opacity = 0.5 + 0.5 * Math.sin(time * 2.4);
            for (const item of smallOrbits)
            {
                item.holder.rotation.y = time * item.speed * motion + item.phase;
                item.small.userData.light.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(time * 6 + item.phase));
            }

            // Relay to Jezero link; the planet hides it when it passes behind.
            relay.getWorldPosition(rocketAhead);
            pin.getWorldPosition(tailPoint);
            beamGeometry.attributes.position.setXYZ(0, rocketAhead.x, rocketAhead.y, rocketAhead.z);
            beamGeometry.attributes.position.setXYZ(1, tailPoint.x, tailPoint.y, tailPoint.z);
            beamGeometry.attributes.position.needsUpdate = true;
            beam.material.opacity = 0.25 + 0.2 * Math.sin(time * 3);
            linkPulse.position.lerpVectors(rocketAhead, tailPoint, (time * 0.55) % 1);

            if (flight.t < 0)
            {
                flight.wait -= delta;

                if (flight.wait <= 0 && motion && !state.closing)
                {
                    flight.t = 0;
                    flight.origin.copy(stage.position);
                    rocket.visible = true;
                }
            }
            else
            {
                flight.t += delta / 15;
                flightPoint(flight.t, rocket.position);
                rocket.lookAt(flightPoint(Math.min(1, flight.t + 0.012), rocketAhead));
                flame.scale.setScalar(0.3 + Math.random() * 0.1);
                flameCore.scale.setScalar(0.14 + Math.random() * 0.05);
                flight.emitted += delta;

                if (flight.emitted > 0.045)
                {
                    flight.emitted = 0;
                    const puff = trail[flight.next++ % trail.length];
                    puff.sprite.position.copy(rocket.position).addScaledVector(rocketAhead.sub(rocket.position).normalize(), -0.28);
                    puff.life = 1;
                    puff.sprite.visible = true;
                }

                if (flight.t >= 1)
                {
                    flight.t = -1;
                    flight.wait = 9 + Math.random() * 7;
                    rocket.visible = false;
                }
            }

            for (const puff of trail)
            {
                if (puff.life <= 0) continue;
                puff.life -= delta * 0.9;
                puff.sprite.material.opacity = Math.max(0, puff.life) * 0.55;
                puff.sprite.scale.setScalar(0.08 + (1 - puff.life) * 0.34);
                if (puff.life <= 0) puff.sprite.visible = false;
            }

            const targetX = layout.x * (1 - scrollProgress * 0.4), targetY = layout.y;
            stage.position.x += (targetX - stage.position.x) * 0.08;
            stage.position.y += (targetY - stage.position.y) * 0.08;
            const targetScale = layout.scale * (1 - scrollProgress * 0.18);
            stage.scale.setScalar(stage.scale.x + (targetScale - stage.scale.x) * 0.08);

            if (state.dive)
            {
                // Fly toward Jezero: centre the planet, turn it to face us and move the camera in.
                const t = clamp((now - state.dive.start) / state.dive.duration, 0, 1), e = ease(t);
                camera.position.set(0, 0, 7.4 + (2.55 - 7.4) * e);
                stage.position.x *= 1 - e * 0.2;
                let delta2 = (faceJezero - mars.rotation.y) % (Math.PI * 2);
                if (delta2 > Math.PI) delta2 -= Math.PI * 2;
                if (delta2 < -Math.PI) delta2 += Math.PI * 2;
                mars.rotation.y += delta2 * 0.08;
                sun.material.opacity = 1 - e;
                if (t >= 1) { state.dive = null; finish(); return; }
            }
            else
            {
                camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.04;
                camera.position.y += (-pointer.y * 0.3 - camera.position.y) * 0.04;
                camera.position.z += ((7.4 + Math.sin(time * 0.35) * 0.14 * motion - scrollProgress * 1.4) - camera.position.z) * 0.06;
            }

            camera.lookAt(centre.set(layout.x * 0.12, 0, 0));

            // Keep the Jezero label on the planet, and hide it when that side faces away.
            pin.getWorldPosition(world);
            toCamera.copy(camera.position).sub(world).normalize();
            const outward = world.clone().sub(mars.getWorldPosition(new THREE.Vector3())).normalize();
            const visible = outward.dot(toCamera) > 0.25 && !state.closing && scrollProgress < 0.35;
            const screen = world.clone().project(camera);
            label.hidden = !visible;

            if (visible)
            {
                label.style.left = ((screen.x * 0.5 + 0.5) * canvasHost.clientWidth) + "px";
                label.style.top = ((-screen.y * 0.5 + 0.5) * canvasHost.clientHeight) + "px";
            }

            renderer.render(scene, camera);
        };

        requestAnimationFrame(frame);
    }

    return { close: () => close(null, false) };
}
