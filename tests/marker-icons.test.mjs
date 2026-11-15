import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MARKER_ICONS, markerRadiusForZoom, normalizeMarkerIcon } from "../src/marker-icons.js";

test("marker shape identifiers are validated", () =>
{
    assert.equal(MARKER_ICONS.length, 5);
    assert.equal(normalizeMarkerIcon("star"), "star");
    assert.equal(normalizeMarkerIcon("<script>"), "circle");
});

test("zooming out shrinks markers while keeping them at real projected coordinates", () =>
{
    assert.ok(markerRadiusForZoom(3) < markerRadiusForZoom(8));
    assert.ok(markerRadiusForZoom(8) < markerRadiusForZoom(11));
    const renderer = readFileSync(new URL("../src/map.js", import.meta.url), "utf8");
    assert.doesNotMatch(renderer, /spreadNearbyMarkers|position\.shifted/);
    assert.match(renderer, /const displayed = coordinates;/);
});

test("marker choices survive mission persistence, checkpoints and import validation", async () =>
{
    const { MissionStore, validateMission } = await import("../src/store.js");
    const memory = new Map();
    globalThis.localStorage = {
        getItem: key => memory.get(key) ?? null,
        setItem: (key, value) => memory.set(key, value)
    };

    const store = new MissionStore({ userId: "test-user" });
    store.addPoint({ lat: 18.44460, lon: 77.45090 });
    store.addObservation({ lat: 18.45160, lon: 77.45920 }, "User annotation", "Test point");
    const pointId = store.activeRoute.points[0].id;
    const noteId = store.current.observations[0].id;

    assert.equal(store.setPointIcon(pointId, "star"), true);
    assert.equal(store.setObservationIcon(noteId, "triangle"), true);
    assert.equal(store.setPointIcon(pointId, "bad-value"), false);

    const saved = new MissionStore({ userId: "test-user" });
    assert.equal(saved.activeRoute.points[0].icon, "star");
    assert.equal(saved.current.observations[0].icon, "triangle");

    saved.saveCheckpoint("Marker styles");
    const imported = validateMission(JSON.parse(JSON.stringify(saved.current)));
    assert.equal(imported.routes[0].points[0].icon, "star");
    assert.equal(imported.observations[0].icon, "triangle");
    assert.equal(imported.checkpoints[0].routes[0].points[0].icon, "star");
    assert.equal(imported.checkpoints[0].observations[0].icon, "triangle");
});
