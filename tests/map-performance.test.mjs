import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MarsMap } from "../src/map.js";
import { MissionStore } from "../src/store.js";
import { JEZERO } from "../src/constants.js";

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
    map.notice = { hidden: true, textContent: "" };
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


test("once a NASA tile format works, other tiles avoid duplicate format requests", () =>
{
    const original = globalThis.document;
    const requested = [];
    let image;

    globalThis.document = {
        createElement(name)
        {
            assert.equal(name, "img");
            image = {
                dataset: {},
                style: {},
                isConnected: true,
                set src(value) { requested.push(value); },
                get src() { return requested.at(-1); }
            };
            return image;
        }
    };

    try
    {
        const map = Object.create(MarsMap.prototype);
        map.layer = {
            id: "ctx",
            extensions: ["jpg", "png"],
            url: "https://trek.nasa.gov/tiles/Mars/EQ/example/1.0.0"
        };
        map.tileTemplates = new Map();
        map.preferredTileSuffix = new Map([["ctx", { matrixSet: "default028mm", extension: "jpg" }]]);
        map.updateImageryStatus = () => {};
        map.createTile(1, 1, 4, 0, 0);
        assert.equal(requested.length, 1);
        assert.match(requested[0], /default028mm\/4\/1\/1\.jpg$/);

        image.onerror();
        assert.equal(requested.length, 1);
        assert.equal(image.dataset.state, "error");
    }
    finally
    {
        globalThis.document = original;
    }
});


test("Mars imagery does not stretch 1-pixel placeholders into huge map blocks", () =>
{
    const previous = globalThis.document;
    let image;
    globalThis.document = {
        createElement()
        {
            image = { dataset: {}, style: {}, isConnected: true, naturalWidth: 1, naturalHeight: 1, set src(value) { this.lastSrc = value; } };
            return image;
        }
    };

    try
    {
        const map = Object.create(MarsMap.prototype);
        map.layer = { id: "ctx", url: "https://example.invalid/1.0.0", extensions: ["jpg"] };
        map.tiles = new Map();
        map.tileTemplates = new Map();
        map.preferredTileSuffix = new Map([["ctx", { matrixSet: "default028mm", extension: "jpg" }]]);
        map.imageErrors = 0;
        map.updateImageryStatus = () => {};
        map.createTile(5, 6, 11, 0, 0);
        image.onload();

        assert.equal(image.dataset.state, "error");
        assert.equal(image.style.opacity, "0");
        assert.equal(map.imageErrors, 1);
    }
    finally
    {
        globalThis.document = previous;
    }
});

test("native useful zoom limits avoid enlarging regional relief imagery", () =>
{
    const map = Object.create(MarsMap.prototype);
    map.layer = { id: "mola", maxUsefulZoom: 7 };
    map.zoom = 11;
    map.tileTemplates = new Map();
    map.tiles = new Map();
    map.activeTiles = new Set();
    map.capabilityRequest = 0;
    map.tileContainer = { replaceChildren() {} };
    map.notice = { hidden: false, textContent: "" };
    map.container = { classList: { remove() {} } };
    map.render = () => {};
    map.options = { onViewChange() {}, onLayerChange() {} };
    map.loadCapabilities = () => {};
    map.setLayer("mola");
    assert.equal(map.zoom, 11);

    // Switching from a detailed layer clamps to the selected basemap's native detail.
    map.setLayer("viking");
    assert.ok(map.zoom <= 8);
});
