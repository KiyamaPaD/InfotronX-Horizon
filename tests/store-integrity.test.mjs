import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY } from "../src/constants.js";
import { createDemoMission, createMission, MissionStore, validateMission } from "../src/store.js";

function memoryStorage()
{
    const data = new Map();
    globalThis.localStorage = {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value)
    };
}

test("legacy example cleanup preserves user metadata after an actual storage reload", () =>
{
    const edits = [
        mission => { mission.routes[0].points[0].name = "My science stop"; },
        mission => { mission.routes[0].points[0].description = "Sample this outcrop"; },
        mission => { mission.routes[0].points[0].category = "science"; },
        mission => { mission.routes[0].points[0].color = "#abcdef"; },
        mission => { mission.observations[0].note = "My revised observation"; },
        mission => { mission.observations[0].source = "My field notebook"; },
        mission => { mission.description = "My mission objective"; },
        mission => { mission.routes[0].color = "#123456"; }
    ];

    for (const edit of edits)
    {
        memoryStorage();
        const mission = createDemoMission();
        edit(mission);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner: "test-user", missions: [mission] }));
        const store = new MissionStore({ userId: "test-user" });
        assert.equal(store.activeRoute.points.length, 4);
        assert.equal(store.current.observations.length, 1);
        assert.deepEqual(store.activeRoute.points, mission.routes[0].points);
        assert.deepEqual(store.current.observations, mission.observations);
        assert.equal(store.current.description, mission.description);
        assert.equal(store.activeRoute.color, mission.routes[0].color);
    }
});

test("imported duplicate identifiers cannot delete multiple unrelated records", () =>
{
    memoryStorage();
    const point = { id: "point", lat: 18, lon: 77 };
    const candidate = {
        routes: [
            { id: "route", points: [point, { ...point, lat: 19 }] },
            { id: "route", points: [{ ...point, lat: 20 }] }
        ],
        observations: [
            { id: "note", lat: 18, lon: 77, title: "First" },
            { id: "note", lat: 19, lon: 78, title: "Second" }
        ]
    };
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.importMission(candidate), true);
    assert.equal(new Set(store.current.routes.map(route => route.id)).size, 2);
    assert.equal(new Set(store.current.routes.flatMap(route => route.points.map(item => item.id))).size, 3);
    store.removePoint(store.activeRoute.points[0].id);
    assert.equal(store.activeRoute.points.length, 1);
    assert.equal(store.activeRoute.points[0].lat, 19);
    store.deleteObservation(store.current.observations[0].id);
    assert.equal(store.current.observations.length, 1);
    assert.equal(store.current.observations[0].title, "Second");
    const secondRouteId = store.current.routes[1].id;
    store.deleteRoute(store.current.routes[0].id);
    assert.equal(store.activeRoute.id, secondRouteId);
});

test("checkpoint restoration retains independently addressable routes and waypoints", () =>
{
    memoryStorage();
    const checkpoint = {
        id: "checkpoint", activeRouteId: "route", routes: [
            { id: "route", points: [{ id: "point", lat: 18, lon: 77 }, { id: "point", lat: 19, lon: 78 }] },
            { id: "route", points: [] }
        ]
    };
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.importMission({ routes: [], checkpoints: [checkpoint, checkpoint] }), true);
    assert.notEqual(store.current.checkpoints[0].id, store.current.checkpoints[1].id);
    assert.equal(store.restoreCheckpoint(store.current.checkpoints[0].id), true);
    assert.equal(store.activeRoute.id, "route");
    store.removePoint(store.activeRoute.points[0].id);
    assert.equal(store.activeRoute.points.length, 1);
    assert.equal(store.current.routes.length, 2);
    assert.notEqual(store.current.routes[0].id, store.current.routes[1].id);
});

test("identifier normalization repairs truncation collisions and remains stable across reload", () =>
{
    const prefix = "r".repeat(80);
    const mission = validateMission({ id: " ", routes: [
        { id: prefix + "a", points: [] },
        { id: prefix + "b", points: [] },
        { id: " ", points: [] }
    ] });
    assert.ok(mission.id.trim());
    assert.equal(new Set(mission.routes.map(route => route.id)).size, 3);
    assert.ok(mission.routes.every(route => route.id.trim()));
    assert.deepEqual(validateMission(mission).routes, mission.routes);
});

test("duplicate mission ids in local storage do not make deletion erase both missions", () =>
{
    memoryStorage();
    const first = createMission("First mission");
    const second = { ...createMission("Second mission"), id: first.id };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner: "test-user", activeId: first.id, missions: [first, second] }));
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.current.title, "First mission");
    assert.notEqual(store.missions[0].id, store.missions[1].id);
    store.deleteMission(first.id);
    assert.equal(store.current.title, "Second mission");
});

test("duplicating a route is a single complete undoable action", () =>
{
    memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    store.addPoint({ lat: 18, lon: 77, name: "Science stop" });
    const originalId = store.activeRoute.id;
    let notifications = 0;
    store.subscribe(() => { notifications++; });
    const copy = store.duplicateRoute();
    assert.equal(notifications, 1);
    assert.equal(copy.points[0].name, "Science stop");
    assert.equal(store.undo(), true);
    assert.equal(store.current.routes.length, 1);
    assert.equal(store.activeRoute.id, originalId);
    assert.equal(store.redo(), true);
    assert.equal(store.current.routes.length, 2);
    assert.equal(store.activeRoute.points.length, 1);
    assert.equal(store.activeRoute.points[0].name, "Science stop");
});
