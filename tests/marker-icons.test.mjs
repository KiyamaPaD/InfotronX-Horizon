import test from "node:test";
import assert from "node:assert/strict";
import { MARKER_ICONS, normalizeMarkerIcon, spreadNearbyMarkers, edgeFadeMask } from "../src/marker-icons.js";

test("marker shape identifiers are validated", () =>
{
    assert.equal(MARKER_ICONS.length, 5);
    assert.equal(normalizeMarkerIcon("star"), "star");
    assert.equal(normalizeMarkerIcon("<script>"), "circle");
});

test("nearby icons separate while source screen coordinates remain unchanged", () =>
{
    const input = [{ x: 120, y: 220 }, { x: 123, y: 223 }];
    const original = structuredClone(input);
    const display = spreadNearbyMarkers(input);
    assert.deepEqual(input, original);
    assert.ok(Math.hypot(display[0].x - display[1].x, display[0].y - display[1].y) >= 40);
    assert.ok(display.every(point => point.shifted));
});

test("distant icons remain geographically aligned", () =>
{
    const input = [{ x: 10, y: 20 }, { x: 300, y: 400 }];
    assert.deepEqual(spreadNearbyMarkers(input), input.map(point => ({ ...point, shifted: false })));
});

test("edge masks fade the exterior but leave loaded neighbor edges solid", () =>
{
    const mask = edgeFadeMask(true, false, false, true);
    assert.match(mask, /transparent 0px/);
    assert.match(mask, /transparent 100%/);
    assert.doesNotMatch(edgeFadeMask(false, false, false, false), /transparent/);
});

test("marker choices survive mission persistence, checkpoints and import validation", async () =>
{
    const { MissionStore, validateMission } = await import("../src/store.js");
    const memory = new Map();
    globalThis.localStorage = {
        getItem: key => memory.get(key) ?? null,
        setItem: (key, value) => memory.set(key, value)
    };

    const store = new MissionStore();
    store.addPoint({ lat: 18.44460, lon: 77.45090 });
    store.addObservation({ lat: 18.45160, lon: 77.45920 }, "User annotation", "Test point");
    const pointId = store.activeRoute.points[0].id;
    const noteId = store.current.observations[0].id;

    assert.equal(store.setPointIcon(pointId, "star"), true);
    assert.equal(store.setObservationIcon(noteId, "triangle"), true);
    assert.equal(store.setPointIcon(pointId, "bad-value"), false);

    const saved = new MissionStore();
    assert.equal(saved.activeRoute.points[0].icon, "star");
    assert.equal(saved.current.observations[0].icon, "triangle");

    saved.saveCheckpoint("Marker styles");
    const imported = validateMission(JSON.parse(JSON.stringify(saved.current)));
    assert.equal(imported.routes[0].points[0].icon, "star");
    assert.equal(imported.observations[0].icon, "triangle");
    assert.equal(imported.checkpoints[0].routes[0].points[0].icon, "star");
    assert.equal(imported.checkpoints[0].observations[0].icon, "triangle");
});
