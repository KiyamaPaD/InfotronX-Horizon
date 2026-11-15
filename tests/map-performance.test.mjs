import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MarsMap } from "../src/map.js";
import { MissionStore } from "../src/store.js";
import { JEZERO, JEZERO_CTX_CONTEXT, MAP_LAYERS } from "../src/constants.js";
import { project } from "../src/geo.js";

test("rapid wheel events result in one bounded zoom change", async () =>
{
    const map = Object.create(MarsMap.prototype);
    const changes = [];
    map.wheelDelta = 0;
    map.wheelTimer = null;
    map.changeZoom = delta => changes.push(delta);

    for (let i = 0; i < 35; i++)
    {
        map.onWheel({ deltaY: -90, preventDefault() {} });
    }

    await new Promise(resolve => setTimeout(resolve, 160));
    assert.equal(changes.length, 1);
    assert.ok(changes[0] >= 1 && changes[0] <= 2);
    assert.equal(map.wheelDelta, 0);
});

test("dozens of map renders share one animation frame", () =>
{
    const original = globalThis.requestAnimationFrame;
    const queued = [];
    globalThis.requestAnimationFrame = callback => queued.push(callback);

    try
    {
        const map = Object.create(MarsMap.prototype);
        let tileRenders = 0;
        let overlays = 0;
        map.frameScheduled = false;
        map.renderTiles = () => tileRenders++;
        map.renderOverlays = () => overlays++;

        for (let i = 0; i < 50; i++)
        {
            map.render();
        }

        assert.equal(queued.length, 1);
        queued[0]();
        assert.equal(tileRenders, 1);
        assert.equal(overlays, 1);
    }
    finally
    {
        globalThis.requestAnimationFrame = original;
    }
});

test("map reuses tiles on revisit rather than creating duplicate image requests", () =>
{
    const map = Object.create(MarsMap.prototype);
    let created = 0;
    map.center = { ...JEZERO };
    map.zoom = 5;
    map.layer = { id: "ctx" };
    map.tiles = new Map();
    map.activeTiles = new Set();
    map.tileCacheLimit = 72;
    map.container = { clientWidth: 600, clientHeight: 430 };
    map.tileContainer = { appendChild() {} };
    map.backgroundTileContainer = { style: {} };
    map.updateImageryStatus = () => {};
    map.createTile = () =>
    {
        created++;
        return { style: {}, dataset: { state: "loaded" }, naturalWidth: 256, remove() {}, removeAttribute() {} };
    };

    map.renderTiles();
    const first = created;
    map.renderTiles();
    assert.equal(created, first);

    map.zoom = 6;
    map.renderTiles();
    const second = created;
    assert.ok(second > first);

    map.zoom = 5;
    map.renderTiles();
    assert.equal(created, second);
});

test("inactive cached images cannot claim imagery is visible at new zoom", () =>
{
    const map = Object.create(MarsMap.prototype);
    const classes = new Map();
    map.container = { classList: { toggle(name, enabled) { classes.set(name, enabled); } } };
    map.notice = { hidden: true, textContent: "", classList: { toggle() {} } };
    map.activeTiles = new Set(["new"]);
    map.tiles = new Map([
        ["old", { dataset: { state: "loaded" }, naturalWidth: 256 }],
        ["new", { dataset: { state: "loading" }, naturalWidth: 0 }]
    ]);

    map.updateImageryStatus();
    assert.equal(classes.get("map-has-imagery"), false);
    assert.equal(map.notice.hidden, false);
    assert.match(map.notice.textContent, /Loading/);

    map.tiles.get("new").dataset.state = "loaded";
    map.tiles.get("new").naturalWidth = 256;
    map.updateImageryStatus();
    assert.equal(classes.get("map-has-imagery"), true);
    assert.equal(map.notice.hidden, true);
});

test("dragging a waypoint saves only when the drag ends", () =>
{
    const store = Object.create(MissionStore.prototype);
    const point = { id: "point1", lat: 18.44, lon: 77.45 };
    const route = { id: "route1", points: [point], terrainModel: {} };
    Object.defineProperty(store, "activeRoute", { get: () => route });
    let writes = 0;
    store.save = () => writes++;

    for (let i = 0; i < 30; i++)
    {
        store.movePoint("point1", { lat: 18.44 + i * 0.00001, lon: 77.45 }, false);
    }

    assert.equal(writes, 0);
    assert.equal(route.terrainModel, null);

    const map = Object.create(MarsMap.prototype);
    map.drag = { pointerId: 8, moved: true, pointId: "point1" };
    map.store = store;
    map.container = { classList: { remove() {} }, contains() { return true; } };
    map.onPointerUp({ pointerId: 8, target: {} });

    assert.equal(writes, 1);
    assert.equal(map.drag, null);
});

test("Analytics has focused groups and keeps specialized tools accessible", () =>
{
    const js = readFileSync(new URL("../src/workspace-ux.js", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/workspace-polish.css", import.meta.url), "utf8");

    for (const label of ["Overview", "Terrain", "Models", "Mission", "DEM ROUTE LAB", "ADVANCED ALGORITHMS", "TERRAIN INTELLIGENCE"])
    {
        assert.ok(js.includes(label), label + " must remain accessible");
    }

    assert.match(js, /section.hidden = !visible/);
    assert.match(css, /\.analytics-collapsible\[hidden\]/);
    assert.match(js, /select\.append|select\.add/);
});


function withFakeTiles(run)
{
    const original = globalThis.document;
    const requests = [];

    globalThis.document = {
        createElement(name)
        {
            const element = {
                name,
                dataset: {},
                style: {},
                children: [],
                isConnected: true,
                naturalWidth: 256,
                naturalHeight: 256,
                append(...items) { this.children.push(...items); },
                remove() { this.isConnected = false; },
                removeAttribute(attribute) { if (attribute === "src") { this.url = undefined; } },
                set src(value) { this.url = value; requests.push({ name: this.className, url: value }); },
                get src() { return this.url; }
            };

            return element;
        }
    };

    try
    {
        return run(requests);
    }
    finally
    {
        globalThis.document = original;
    }
}

function testMap()
{
    const map = Object.create(MarsMap.prototype);
    map.layer = {
        id: "ctx",
        extensions: ["jpg", "png"],
        url: "https://trek.nasa.gov/tiles/Mars/EQ/example/1.0.0"
    };
    map.tileTemplates = new Map();
    map.preferredTileSuffix = new Map();
    map.imageErrors = 0;
    map.loadedImages = 0;
    map.updateImageryStatus = () => {};
    return map;
}

test("working NASA tile format is preferred but alternate paths remain available", () =>
{
    const map = testMap();
    map.preferredTileSuffix.set("ctx:4", { matrixSet: "default028mm", extension: "jpg" });
    const candidates = map.tileCandidates(1, 1, 4, map.layer);

    assert.match(candidates[0], /default028mm\/4\/1\/1\.jpg$/);
    assert.ok(candidates.some(url => url.endsWith(".png")));
    assert.ok(candidates.some(url => url.includes("/default/default/")));
    assert.equal(new Set(candidates).size, candidates.length);
});

test("low-resolution parent appears beneath missing detail and cropped correctly", () =>
{
    withFakeTiles(requests =>
    {
        const map = testMap();
        const tile = map.createTile(5, 6, 10, 0, 0);
        const [preview, detail] = tile.children;

        assert.equal(requests.length, 0, "Network begins only after the tile is attached");
        tile.startLoading();
        assert.equal(requests.length, 2);
        assert.match(detail.src, /\/10\/6\/5\.jpg$/);
        assert.match(preview.src, /\/9\/3\/2\.jpg$/);
        assert.equal(preview.style.left, "-256px");
        assert.equal(preview.style.top, "0px");
        assert.equal(preview.style.width, "512px");

        preview.onload();
        assert.equal(tile.dataset.preview, "loaded");
        assert.equal(preview.style.opacity, "1");

        detail.naturalWidth = 1;
        detail.onload();
        assert.equal(tile.dataset.state, "loading", "A tiny placeholder cannot be accepted as real imagery");
        assert.notEqual(detail.src, requests[0].url);

        detail.naturalWidth = 256;
        detail.onload();
        assert.equal(tile.dataset.state, "loaded");
        assert.equal(detail.style.opacity, "1");
        assert.equal(preview.style.opacity, "0");
    });
});

test("missing high resolution tiles retain parent context after all alternatives fail", () =>
{
    withFakeTiles(() =>
    {
        const map = testMap();
        const tile = map.createTile(9, 12, 10, 0, 0);
        tile.startLoading();
        const [preview, detail] = tile.children;
        preview.onload();

        for (let i = 0; i < 7 && tile.dataset.state !== "error"; i++)
        {
            detail.onerror();
        }

        assert.equal(tile.dataset.state, "error");
        assert.equal(tile.dataset.preview, "loaded");
        assert.equal(preview.style.opacity, "1");
        assert.equal(map.imageErrors, 1);
        tile.dispose();
        assert.equal(detail.onload, null);
        assert.equal(preview.onerror, null);
    });
});

test("current zoom only counts loaded parent previews, not stale cached tiles", () =>
{
    const map = Object.create(MarsMap.prototype);
    const classes = new Map();
    map.container = { classList: { toggle(name, enabled) { classes.set(name, enabled); } } };
    map.notice = { hidden: false, textContent: "", classList: { toggle(name, enabled) { classes.set(name, enabled); } } };
    map.activeTiles = new Set(["new"]);
    map.tiles = new Map([
        ["old", { dataset: { state: "loaded", preview: "loaded" } }],
        ["new", { dataset: { state: "error", preview: "loaded" } }]
    ]);

    map.updateImageryStatus();
    assert.equal(classes.get("map-has-imagery"), true);
    assert.equal(classes.get("map-preview-notice"), true);
    assert.match(map.notice.textContent, /Lower-resolution/);
});

test("native useful zoom limits avoid enlarging regional relief imagery", () =>
{
    const map = Object.create(MarsMap.prototype);
    map.layer = { id: "ctx", maxUsefulZoom: 10 };
    map.zoom = 10;
    map.tileTemplates = new Map();
    map.tiles = new Map();
    map.activeTiles = new Set();
    map.backgroundActiveTiles = new Set();
    map.activeContextTiles = new Set();
    map.capabilityRequest = 0;
    map.tileContainer = { replaceChildren() {} };
    map.notice = { hidden: false, textContent: "" };
    map.container = { classList: { remove() {} } };
    map.render = () => {};
    map.options = { onViewChange() {}, onLayerChange() {} };
    map.scheduleCapabilities = () => {};
    map.setLayer("mola");
    assert.ok(map.zoom <= 7);

    // Switching to Viking should never increase detail beyond its native limit.
    map.setLayer("viking");
    assert.ok(map.zoom <= 8);
});


test("HiRISE stops at native zoom 11 without requesting unsupported level 12", () =>
{
    const hirise = MAP_LAYERS.find(layer => layer.id === "hirise");
    assert.equal(hirise.maxUsefulZoom, 11);
    const map = Object.create(MarsMap.prototype);
    map.zoom = 11;
    map.layerMaxZoom = hirise.maxUsefulZoom;
    let renders = 0;
    map.render = () => renders++;
    map.options = { onViewChange() { throw new Error("Unexpected map update"); } };
    map.changeZoom(1);
    assert.equal(map.zoom, 11);
    assert.equal(renders, 0);
});


test("first visit waits for WMTS metadata instead of immediately guessing NASA tile URLs", () =>
{
    const map = Object.create(MarsMap.prototype);
    let downloads = 0;
    map.capabilitiesReady = false;
    map.container = { clientWidth: 900, clientHeight: 500 };
    map.createTile = () => { downloads++; };
    map.renderTiles();
    assert.equal(downloads, 0);
});

test("an unavailable parent tile falls back to its true grandparent location", () =>
{
    withFakeTiles(() =>
    {
        const map = testMap();
        const tile = map.createTile(13, 22, 10, 0, 0);
        const [preview] = tile.children;
        tile.startLoading();
        assert.match(preview.src, /\/9\/11\/6\.jpg$/);

        const firstCandidates = map.tileCandidates(6, 11, 9);
        for (let i = 0; i < firstCandidates.length; i++)
        {
            preview.onerror();
        }

        assert.match(preview.src, /\/8\/5\/3\.jpg$/);
        assert.equal(preview.style.width, "1024px");
        assert.equal(preview.style.height, "1024px");
        assert.equal(preview.style.left, "-256px");
        assert.equal(preview.style.top, "-512px");

        preview.onload();
        assert.equal(tile.dataset.preview, "loaded");
        assert.equal(preview.style.opacity, "1");
    });
});

test("partially available NASA map data is reported without disguising missing areas", () =>
{
    const map = Object.create(MarsMap.prototype);
    const classes = new Map();
    map.container = { classList: { toggle(name, enabled) { classes.set(name, enabled); } } };
    map.notice = { classList: { toggle(name, enabled) { classes.set(name, enabled); } }, textContent: "", hidden: false };
    map.activeTiles = new Set(["one", "two"]);
    map.tiles = new Map([
        ["one", { dataset: { state: "loaded", preview: "error" } }],
        ["two", { dataset: { state: "error", preview: "error" } }]
    ]);
    map.updateImageryStatus();
    assert.equal(classes.get("map-preview-notice"), true);
    assert.equal(map.notice.hidden, false);
    assert.match(map.notice.textContent, /unavailable/);
});


test("the default global basemap uses Viking imagery at all supported zooms", () =>
{
    const map = testMap();
    map.layer = MAP_LAYERS.find(layer => layer.id === "viking");

    for (const zoom of [3, 4, 5, 6, 7])
    {
        assert.equal(map.getImageryLayer(zoom).id, "viking");
        assert.match(map.tileCandidates(9, 3, zoom)[0], /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
    }

    assert.ok(!MAP_LAYERS.some(layer => layer.dataset.includes("CTX_beta01")));
});

test("HiRISE is shown only inside the controlled Jezero mosaic footprint", () =>
{
    const map = testMap();
    map.layer = MAP_LAYERS.find(layer => layer.id === "hirise");
    map.center = { ...JEZERO };

    assert.equal(map.getImageryLayer(8).id, "viking");
    assert.equal(map.getImageryLayer(9).id, "hirise");
    assert.equal(map.getImageryLayer(10).id, "hirise");
    assert.equal(map.getImageryLayer(11).id, "hirise");

    const x = Math.floor((JEZERO.lon + 180) / 360 * 2 ** 11);
    const y = Math.floor((90 - JEZERO.lat) / 180 * 2 ** 10);
    assert.equal(map.getImageryLayer(10, x, y).id, "hirise");

    map.center = { lat: 17.3, lon: 70.4 };
    assert.equal(map.getImageryLayer(10).id, "viking");

    map.layer = MAP_LAYERS.find(layer => layer.id === "mola");
    assert.equal(map.getImageryLayer(8).id, "mola");
});

test("HiRISE imagery and native Viking fallback use geographically aligned tiles", () =>
{
    withFakeTiles(requests =>
    {
        const map = testMap();
        map.layer = MAP_LAYERS.find(layer => layer.id === "viking");
        const low = map.createTile(9, 3, 3, 0, 0);
        low.startLoading();
        assert.equal(requests.length, 1);
        assert.match(requests[0].url, /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
        low.dispose();

        map.layer = MAP_LAYERS.find(layer => layer.id === "hirise");
        map.center = { ...JEZERO };
        const x = Math.floor((JEZERO.lon + 180) / 360 * 2 ** 11);
        const y = Math.floor((90 - JEZERO.lat) / 180 * 2 ** 10);
        const high = map.createTile(x, y, 10, 0, 0);
        high.startLoading();
        assert.match(requests.at(-2).url, /JEZ_hirise_soc_006_orthoMosaic/);
        assert.match(requests.at(-1).url, /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
        high.dispose();

        const outside = map.createTile(1000, 302, 10, 0, 0);
        outside.startLoading();
        const detail = outside.children[1];
        assert.match(detail.src, /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
        assert.match(detail.src, /\/7\/37\/125\./);
        assert.equal(detail.style.width, "2048px");
        assert.equal(detail.style.left, "0px");
        assert.equal(detail.style.top, "-1536px");
        outside.dispose();
    });
});


test("HiRISE transparent mosaic keeps Viking context beneath it in both load orders", () =>
{
    withFakeTiles(() =>
    {
        const map = testMap();
        map.layer = MAP_LAYERS.find(item => item.id === "hirise");
        map.center = { ...JEZERO };
        const x = Math.floor((JEZERO.lon + 180) / 360 * 2 ** 11);
        const y = Math.floor((90 - JEZERO.lat) / 180 * 2 ** 10);

        for (const previewFirst of [true, false])
        {
            const tile = map.createTile(x, y, 10, 0, 0);
            const [preview, detail] = tile.children;
            tile.startLoading();

            if (previewFirst)
            {
                preview.onload();
                detail.onload();
            }
            else
            {
                detail.onload();
                preview.onload();
            }

            assert.equal(tile.style.filter, "grayscale(1)");
            assert.equal(preview.style.opacity, "1");
            assert.equal(detail.style.opacity, "1");
            tile.dispose();
        }
    });
});

test("HiRISE outside coverage loads Viking without an extra parent request", () =>
{
    withFakeTiles(requests =>
    {
        const map = testMap();
        map.layer = MAP_LAYERS.find(item => item.id === "hirise");
        map.center = { lat: 15, lon: 70 };
        const tile = map.createTile(1000, 302, 10, 0, 0);
        tile.startLoading();
        assert.equal(requests.length, 1);
        assert.equal(tile.dataset.source, "viking");
        assert.match(requests[0].url, /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
        tile.dispose();
    });
});

test("the new MOLA / HRSC relief uses a verified monochrome JPEG layer", () =>
{
    const mola = MAP_LAYERS.find(layer => layer.id === "mola");
    assert.equal(mola.dataset, "Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw");
    assert.deepEqual(mola.extensions, ["jpg"]);
    assert.ok(!mola.dataset.includes("ClrShade"));
    const hirise = MAP_LAYERS.find(layer => layer.id === "hirise");
    assert.deepEqual(hirise.extensions, ["png"]);
});

test("NASA GetCapabilities URLs normalize doubled path separators", () =>
{
    const map = testMap();
    const hirise = MAP_LAYERS.find(layer => layer.id === "hirise");
    map.layer = hirise;
    map.tileTemplates.set("hirise", {
        template: hirise.url + "//{Style}/default028mm/{TileMatrix}/{TileRow}/{TileCol}.png",
        matrixLookup: new Map([["2048-1024", "10"]])
    });
    const candidates = map.tileCandidates(1464, 407, 10, hirise);
    assert.match(candidates[0], /\/1\.0\.0\/default\/default028mm\/10\/407\/1464\.png$/);
    assert.ok(!candidates[0].includes("/1.0.0//"));
    assert.ok(!candidates.some(url => url.endsWith(".jpg")));
});

test("partially overlapping HiRISE coverage is tested by tile extent", () =>
{
    const map = testMap();
    map.layer = MAP_LAYERS.find(layer => layer.id === "hirise");
    map.center = { ...JEZERO };
    const zoom = 10;
    const x = Math.floor((map.layer.coverage.west + 180) / 360 * 2 ** (zoom + 1));
    const y = Math.floor((90 - JEZERO.lat) / 180 * 2 ** zoom);
    assert.equal(map.getImageryLayer(zoom, x, y).id, "hirise");
    assert.equal(map.getImageryLayer(zoom, x - 2, y).id, "viking");
});


test("verified NASA HiRISE and MOLA layers begin loading without waiting for metadata timeout", () =>
{
    for (const id of ["hirise", "mola"])
    {
        const map = Object.create(MarsMap.prototype);
        map.layer = MAP_LAYERS.find(item => item.id === id);
        map.tileTemplates = new Map();
        map.capabilitiesTimer = null;
        let renders = 0;
        let capabilitiesRequests = 0;
        map.render = () => renders++;
        map.loadCapabilities = () => capabilitiesRequests++;
        map.scheduleCapabilities();

        assert.equal(map.capabilitiesReady, true);
        assert.equal(renders, 1);
        assert.equal(capabilitiesRequests, 1);
        assert.equal(map.capabilitiesTimer, null);
    }
});


test("zoom 11 requests genuine NASA HiRISE PNGs rather than enlarged zoom 10 tiles", () =>
{
    withFakeTiles(requests =>
    {
        const map = testMap();
        map.layer = MAP_LAYERS.find(layer => layer.id === "hirise");
        map.center = { ...JEZERO };
        const zoom = 11;
        const x = Math.floor((JEZERO.lon + 180) / 360 * 2 ** (zoom + 1));
        const y = Math.floor((90 - JEZERO.lat) / 180 * 2 ** zoom);
        const tile = map.createTile(x, y, zoom, 0, 0);
        const [preview, detail] = tile.children;
        tile.startLoading();

        assert.equal(tile.dataset.source, "hirise");
        assert.equal(tile.dataset.lowDetail, "false");
        assert.match(detail.src, /JEZ_hirise_soc_006_orthoMosaic_25cm/);
        assert.match(detail.src, /\/11\/\d+\/\d+\.png$/);
        assert.equal(detail.style.width, undefined);
        assert.match(preview.src, /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
        assert.match(preview.src, /\/7\/\d+\/\d+\.jpg$/);
        assert.equal(preview.style.width, "4096px");
        assert.equal(preview.style.left, -((x % 16) * 256) + "px");
        assert.equal(preview.style.top, -((y % 16) * 256) + "px");

        detail.onload();
        preview.onload();
        assert.equal(detail.style.opacity, "1");
        assert.equal(preview.style.opacity, "1", "Transparent HiRISE pixels retain Viking context");
        tile.dispose();
        assert.ok(requests.length >= 2);
    });
});

test("zoom 11 outside HiRISE coverage uses Viking context without 404 requests", () =>
{
    withFakeTiles(requests =>
    {
        const map = testMap();
        map.layer = MAP_LAYERS.find(layer => layer.id === "hirise");
        map.center = { lat: 15, lon: 70 };
        const tile = map.createTile(2000, 604, 11, 0, 0);
        tile.startLoading();

        assert.equal(tile.dataset.source, "viking");
        assert.equal(tile.dataset.lowDetail, "true");
        assert.equal(requests.length, 1);
        assert.match(requests[0].url, /Mars_Viking_MDIM21_ClrMosaic_global_232m/);
        assert.match(requests[0].url, /\/7\/37\/125\.jpg$/);
        tile.dispose();
    });
});


function activeHiRISEMap()
{
    const map = testMap();
    map.layer = MAP_LAYERS.find(layer => layer.id === "hirise");
    map.center = { ...JEZERO };
    map.zoom = 11;
    map.tiles = new Map();
    map.activeTiles = new Set();
    map.tileCacheLimit = 72;
    map.backgroundTiles = new Map();
    map.backgroundActiveTiles = new Set();
    map.backgroundTileCacheLimit = 24;
    map.backgroundTileContainer = { style: {}, appendChild() {} };
    map.contextTiles = new Map();
    map.activeContextTiles = new Set();
    map.contextTileCacheLimit = 84;
    map.contextTileContainer = { style: {}, appendChild() {} };
    map.tileContainer = { appendChild() {} };
    map.container = { classList: { toggle() {} } };
    map.notice = { classList: { remove() {} }, hidden: false, textContent: "" };
    return map;
}

test("HiRISE uses one shared Viking backdrop rather than a giant parent per detail tile", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        const width = 760;
        const height = 420;
        map.renderHiRISETiles(width, height, project(map.center, map.zoom));

        const backgroundRequests = requests.filter(item => item.name === "map-background-tile");
        const detailRequests = requests.filter(item => item.name === "map-hires-tile");

        assert.ok(backgroundRequests.length >= 1);
        assert.ok(backgroundRequests.length <= 4);
        assert.ok(detailRequests.length >= 6);
        assert.ok(detailRequests.every(item => /JEZ_hirise_soc_006_orthoMosaic/.test(item.url)));
        assert.ok(backgroundRequests.every(item => /\/7\/\d+\/\d+\.jpg$/.test(item.url)));
        assert.equal(new Set(backgroundRequests.map(item => item.url)).size, backgroundRequests.length);
        assert.ok(map.backgroundTiles.size < map.tiles.size);

        for (const tile of map.tiles.values())
        {
            assert.equal(tile.className, "map-hires-tile");
            assert.equal(tile.style.width, undefined, "HiRISE PNG is never scaled to 2,048px");
        }

        const oldRequests = requests.length;
        map.renderHiRISETiles(width, height, project(map.center, map.zoom));
        assert.equal(requests.length, oldRequests, "Second render must only reposition cached images");
    });
});

test("zoom 11 → 10 → 11 reuses the same Viking backdrop without new downloads", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        map.renderHiRISETiles(720, 380, project(map.center, map.zoom));
        const initialBackground = [...map.backgroundTiles.keys()];

        map.zoom = 10;
        map.renderHiRISETiles(720, 380, project(map.center, map.zoom));

        const beforeReturn = requests.filter(item => item.name === "map-background-tile").length;
        map.zoom = 11;
        map.renderHiRISETiles(720, 380, project(map.center, map.zoom));

        const afterReturn = requests.filter(item => item.name === "map-background-tile").length;
        assert.equal(afterReturn, beforeReturn);
        assert.ok(initialBackground.every(key => map.backgroundTiles.has(key)));
    });
});

test("HiRISE zoom 8 uses uniform Viking imagery without a sharp CTX patch", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        map.zoom = 8;
        map.renderHiRISETiles(770, 420, project(map.center, map.zoom));

        assert.equal(map.activeTiles.size, 0);
        assert.ok(map.backgroundActiveTiles.size > 0);
        assert.equal(map.activeContextTiles.size, 0);
        assert.ok(requests.every(item => item.name !== "map-hires-tile"));
        assert.ok(requests.filter(item => item.name === "map-background-tile").every(item => /\/7\/\d+\/\d+\.jpg$/.test(item.url)));
        assert.equal(requests.filter(item => item.name === "map-context-tile").length, 0);
    });
});

test("visible Viking imagery hides the unavailable warning during HiRISE loading", () =>
{
    withFakeTiles(() =>
    {
        const map = activeHiRISEMap();
        map.renderHiRISETiles(720, 380, project(map.center, map.zoom));
        const tile = [...map.backgroundTiles.values()][0];
        tile.onload();

        assert.equal(map.notice.hidden, true);
        assert.equal(tile.style.opacity, "1");
        assert.match(map.notice.textContent, /Loading/);
    });
});


test("Viking stops at confirmed native zoom 7; HiRISE never requests missing Viking zoom 8", () =>
{
    const viking = MAP_LAYERS.find(layer => layer.id === "viking");
    assert.equal(viking.maxUsefulZoom, 7);
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();

        for (const zoom of [8, 9, 10, 11])
        {
            map.zoom = zoom;
            map.renderHiRISETiles(740, 410, project(map.center, zoom));
        }

        const vikingRequests = requests.filter(item => item.name === "map-background-tile");
        assert.ok(vikingRequests.length > 0);
        assert.ok(vikingRequests.every(item => /\/7\/\d+\/\d+\.jpg$/.test(item.url)));
    });
});


test("NASA controlled CTX native context is available at both screenshot coordinates and all high zooms", () =>
{
    const layer = JEZERO_CTX_CONTEXT;
    const map = activeHiRISEMap();
    assert.deepEqual(layer.extensions, ["png"]);
    assert.equal(layer.maxUsefulZoom, 11);
    assert.ok(!MAP_LAYERS.some(item => item.id === layer.id));

    for (const zoom of [8, 9, 10, 11])
    {
        const point = { lat: 18.39862, lon: 77.57575 };
        const x = Math.floor((point.lon + 180) / 360 * 2 ** (zoom + 1));
        const y = Math.floor((90 - point.lat) / 180 * 2 ** zoom);

        assert.equal(map.tileIntersectsCoverage(layer.coverage, zoom, x, y), true);
        assert.match(map.tileCandidates(x, y, zoom, layer)[0], new RegExp("/" + zoom + "/\\d+/\\d+\\.png$"));
    }
});

test("the CTX grid is cached independently, aligned and not re-downloaded on rerenders", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        map.renderHiRISETiles(760, 420, project(map.center, 11));

        const viking = requests.filter(item => item.name === "map-background-tile");
        const context = requests.filter(item => item.name === "map-context-tile");
        const hirise = requests.filter(item => item.name === "map-hires-tile");

        assert.ok(viking.length >= 1 && viking.length <= 4);
        assert.ok(context.length >= 6);
        assert.ok(hirise.length >= 6);
        assert.ok(context.every(item => /JEZ_ctx_B_soc_008_orthoMosaic_6m/.test(item.url)));
        assert.ok(context.every(item => /\/11\/\d+\/\d+\.png$/.test(item.url)));

        const count = requests.length;
        map.renderHiRISETiles(760, 420, project(map.center, 11));
        assert.equal(requests.length, count);
        assert.ok([...map.contextTiles.values()].every(tile => tile.style.width === undefined));
    });
});

test("CTX and HiRISE don't trigger image requests outside their geographic footprints", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        map.center = { lat: 18.4, lon: 76.8 };
        map.zoom = 10;
        map.renderHiRISETiles(720, 400, project(map.center, map.zoom));

        assert.equal(map.activeContextTiles.size, 0);
        assert.equal(map.activeTiles.size, 0);
        assert.ok(requests.length > 0);
        assert.ok(requests.every(item => item.name === "map-background-tile"));
    });
});

test("Viking, controlled CTX and HiRISE layers render in scientific-resolution order", () =>
{
    const source = readFileSync(new URL("../src/map.js", import.meta.url), "utf8");
    const viking = source.indexOf('<div class="map-background-tiles"></div>');
    const context = source.indexOf('<div class="map-context-tiles"></div>');
    const hirise = source.indexOf('<div class="map-tiles"></div>');
    const routes = source.indexOf('<svg class="map-overlays"');

    assert.ok(viking >= 0 && viking < context && context < hirise && hirise < routes);
});

test("HiRISE center tile starts before neighboring detail and CTX requests at zoom 11", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        const center = project(map.center, map.zoom);
        const centerX = Math.floor(center.x / 256);
        const centerY = Math.floor(center.y / 256);
        map.renderHiRISETiles(760, 420, center);
        const high = requests.filter(item => item.name === "map-hires-tile");
        const context = requests.filter(item => item.name === "map-context-tile");

        assert.ok(high.length > 0 && context.length > 0);
        assert.match(high[0].url, new RegExp("/11/" + centerY + "/" + centerX + "\\.png$"));
        const highIndex = requests.findIndex(item => item.name === "map-hires-tile");
        const contextIndex = requests.findIndex(item => item.name === "map-context-tile");
        assert.ok(highIndex >= 0 && highIndex < contextIndex,
            "HiRISE must be requested before CTX; actual layer stacking is unchanged");
    });
});

test("high detail retry budgets prevent endless requests for permanently unavailable NASA tiles", () =>
{
    withFakeTiles(requests =>
    {
        const map = activeHiRISEMap();
        map.highDetailFailures = new Map();
        const center = project(map.center, map.zoom);
        map.renderHiRISETiles(650, 350, center);
        const key = [...map.activeTiles][0];
        const tile = map.tiles.get(key);
        const first = requests.length;
        tile.dataset.state = "error";
        tile.dataset.failedAt = "0";
        map.highDetailFailures.set(key, 3);
        map.renderHiRISETiles(650, 350, center);
        assert.equal(map.tiles.get(key), tile);
        assert.equal(requests.length, first);

        map.highDetailFailures.set(key, 1);
        map.renderHiRISETiles(650, 350, center);
        assert.notEqual(map.tiles.get(key), tile);
        assert.ok(requests.length > first);
    });
});

test("a hung high-resolution NASA request advances to an alternate candidate and is canceled on disposal", () =>
{
    withFakeTiles(requests =>
    {
        const original = globalThis.window;
        const timers = new Map();
        let sequence = 0;
        globalThis.window = {
            setTimeout(callback, delay)
            {
                const id = ++sequence;
                timers.set(id, { callback, delay });
                return id;
            },
            clearTimeout(id) { timers.delete(id); }
        };
        const nativeSetTimeout = globalThis.setTimeout;
        const nativeClearTimeout = globalThis.clearTimeout;
        globalThis.setTimeout = (...args) => globalThis.window.setTimeout(...args);
        globalThis.clearTimeout = id => globalThis.window.clearTimeout(id);

        try
        {
            const map = activeHiRISEMap();
            map.onTileOutcome = () => {};
            map.scheduleHighDetailRecovery = () => {};
            const tile = map.createHiRISETile(2928, 814, 11);
            tile.startLoading();
            assert.equal(requests.length, 1);
            const [timerId, timer] = [...timers.entries()][0];
            assert.equal(timer.delay, 15000);
            timers.delete(timerId); // Simulate the browser removing a fired one-shot timer.
            timer.callback();
            assert.equal(requests.length, 2, "Stalled PNG must try alternate NASA URL");
            tile.dispose();
            assert.equal(timers.size, 0, "Disposing a tile must cancel its watchdog timer");
        }
        finally
        {
            globalThis.window = original;
            globalThis.setTimeout = nativeSetTimeout;
            globalThis.clearTimeout = nativeClearTimeout;
        }
    });
});
