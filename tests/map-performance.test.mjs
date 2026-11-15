import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MarsMap } from "../src/map.js";
import { MissionStore } from "../src/store.js";
import { JEZERO, MAP_LAYERS } from "../src/constants.js";

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


test("HiRISE stops at zoom 10 without requesting unsupported level 11", () =>
{
    const hirise = MAP_LAYERS.find(layer => layer.id === "hirise");
    assert.equal(hirise.maxUsefulZoom, 10);
    const map = Object.create(MarsMap.prototype);
    map.zoom = 10;
    map.layerMaxZoom = hirise.maxUsefulZoom;
    let renders = 0;
    map.render = () => renders++;
    map.options = { onViewChange() { throw new Error("Unexpected map update"); } };
    map.changeZoom(1);
    assert.equal(map.zoom, 10);
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

    for (const zoom of [3, 4, 5, 6, 7, 8])
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
        assert.match(detail.src, /\/8\/75\/250\./);
        assert.equal(detail.style.width, "1024px");
        assert.equal(detail.style.left, "0px");
        assert.equal(detail.style.top, "-512px");
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
