import test from "node:test";
import assert from "node:assert/strict";
import { MissionStore, validateMission } from "../src/store.js";
import { analyzeRoute } from "../src/geo.js";

function memoryStorage()
{
    const data = new Map();

    return {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value)
    };
}

test("checkpoint captures independent route and observation data", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    const before = store.activeRoute.points.length;
    const snapshot = store.saveCheckpoint("Before route changes");
    assert.ok(snapshot);
    store.addPoint({ lat: 18.48, lon: 77.52 });
    assert.equal(store.activeRoute.points.length, before + 1);
    assert.equal(snapshot.routes[0].points.length, before);
    assert.equal(store.restoreCheckpoint(snapshot.id), true);
    assert.equal(store.activeRoute.points.length, before);
    assert.equal(store.current.checkpoints.length, 1);
});

test("checkpoint persists across reload and JSON validation", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    store.saveCheckpoint("Saved state");
    assert.equal(new MissionStore().current.checkpoints[0].label, "Saved state");
    const exported = JSON.parse(JSON.stringify(store.current));
    assert.equal(validateMission(exported).checkpoints.length, 1);
});

test("malformed and oversized checkpoints do not bypass bounds", () =>
{
    const mission = validateMission({ routes: [{ points: [] }], checkpoints: [null, { routes: [] }, ...Array.from({ length: 20 }, (_, i) => ({ id: String(i), routes: [{ points: [{ lat: 92, lon: 1 }, { lat: 18, lon: 77 }] }] }))] });
    assert.ok(mission);
    assert.ok(mission.checkpoints.length <= 8);
    assert.ok(mission.checkpoints.every(checkpoint => checkpoint.routes[0].points.length === 1));
});

test("checkpoint limit blocks unbounded local growth", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();

    for (let i = 0; i < 8; i++)
    {
        assert.ok(store.saveCheckpoint(`Snapshot ${i}`));
    }

    assert.equal(store.saveCheckpoint("Overflow"), null);
    assert.equal(store.current.checkpoints.length, 8);
    assert.equal(store.deleteCheckpoint(store.current.checkpoints[0].id), true);
    assert.ok(store.saveCheckpoint("After delete"));
});

test("reordering manual waypoints changes route sequence without losing coordinates", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    const ids = store.activeRoute.points.map(point => point.id);
    const before = analyzeRoute(store.activeRoute.points).totalDistance;
    assert.equal(store.reorderPoint(ids[1], 1), true);
    assert.equal(store.activeRoute.points[2].id, ids[1]);
    assert.notEqual(analyzeRoute(store.activeRoute.points).totalDistance, before);
    assert.equal(store.reorderPoint(ids[0], -1), false);
    assert.equal(store.reorderPoint(ids[0], 0), false);
});

test("user observation may be added as a waypoint manually", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    const note = store.current.observations[0];
    const count = store.activeRoute.points.length;
    assert.equal(store.addObservationWaypoint(note.id), true);
    assert.equal(store.activeRoute.points.length, count + 1);
    assert.equal(store.activeRoute.points.at(-1).lat, note.lat);
    assert.equal(store.addObservationWaypoint("missing"), false);
});
