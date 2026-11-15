import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY } from "../src/constants.js";
import { createMission, MissionStore, validateMission } from "../src/store.js";

function memoryStorage()
{
    const values = new Map();

    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value)
    };
}

test("invalid imported route objects are ignored without crashing", () =>
{
    const imported = validateMission({ title: "Bad", routes: [null, {}, { points: [{ lat: 1000, lon: 1 }] }] });
    assert.ok(imported);
    assert.ok(imported.routes.length >= 1);
    assert.equal(imported.routes.every(route => Array.isArray(route.points)), true);
});

test("a legacy V1 mission array loads in V2", () =>
{
    globalThis.localStorage = memoryStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner: "test-user", missions: [createMission("Legacy")] }));
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.current.title, "Legacy");
});

test("selected mission persists across reloads", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    const originalId = store.current.id;
    store.addMission("Second");
    store.selectMission(originalId);
    const reloaded = new MissionStore({ userId: "test-user" });
    assert.equal(reloaded.activeId, originalId);
});

test("coordinates can be edited exactly", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    const route = store.activeRoute;
    store.addPoint({ lat: 18.44, lon: 77.45 });
    const point = route.points[0];
    assert.equal(store.updatePoint(point.id, { lat: 18.5, lon: 77.5 }), true);
    assert.deepEqual([route.points[0].lat, route.points[0].lon], [18.5, 77.5]);
    assert.equal(store.updatePoint(point.id, { lat: 180, lon: 77.5 }), false);
});

test("route limit is enforced", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    for (let i = 1; i < 15; i++)
    {
        assert.ok(store.addRoute(`Route ${i}`));
    }

    assert.equal(store.addRoute("Overflow"), null);
    assert.equal(store.duplicateRoute(), null);
    assert.equal(store.current.routes.length, 15);
});

test("deleting the last mission leaves a blank usable mission", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    const id = store.current.id;
    assert.equal(store.deleteMission(id), true);
    assert.equal(store.missions.length, 1);
    assert.notEqual(store.current.id, id);
});

test("failed browser storage is surfaced", () =>
{
    globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error("quota exceeded"); } };
    const store = new MissionStore({ userId: "test-user" });
    const previous = console.warn;
    console.warn = () => {};
    try
    {
        store.addPoint({ lat: 18.44, lon: 77.45 });
        assert.equal(store.lastSaveSucceeded, false);
    }
    finally
    {
        console.warn = previous;
    }
});

test("fresh missions start with no user-generated map markers", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.activeRoute.points.length, 0);
    assert.equal(store.current.observations.length, 0);
});

test("untouched sample markers are removed without touching customized routes", async () =>
{
    const { createDemoMission, removeUntouchedExample } = await import("../src/store.js");
    const example = removeUntouchedExample(createDemoMission());
    assert.equal(example.routes[0].points.length, 0);
    assert.equal(example.observations.length, 0);

    const customized = createDemoMission();
    customized.routes[0].points[0].lat += 0.00001;
    assert.equal(removeUntouchedExample(customized).routes[0].points.length, 4);
});

test("clearing an active route is explicit and does not delete observations", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    store.addPoint({ lat: 18.44, lon: 77.45 });
    store.addObservation({ lat: 18.45, lon: 77.46 }, "Manual observation", "");
    assert.equal(store.clearActiveRoute(), true);
    assert.equal(store.activeRoute.points.length, 0);
    assert.equal(store.current.observations.length, 1);
});
