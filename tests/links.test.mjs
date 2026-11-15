import test from "node:test";
import assert from "node:assert/strict";
import { cleanLinks, MissionStore } from "../src/store.js";

const memory = () => { const v = new Map(); return { get length() { return v.size; }, key: i => [...v.keys()][i] ?? null, getItem: k => v.get(k) ?? null, setItem: (k, x) => v.set(k, String(x)), removeItem: k => v.delete(k) }; };

function storeWithThreePoints()
{
    globalThis.localStorage = memory();
    const store = new MissionStore({ userId: null });
    for (const [lat, lon] of [[18.44, 77.45], [18.46, 77.47], [18.45, 77.49]]) store.addPoint({ lat, lon });
    return store;
}

test("two waypoints that are not neighbours can be connected, like the missing side of a triangle", () =>
{
    const store = storeWithThreePoints();
    const [a, , c] = store.activeRoute.points;
    assert.equal(store.linkPoints(a.id, c.id), "linked");
    assert.deepEqual(store.activeRoute.links, [[a.id, c.id]]);
});

test("neighbours, repeats and strangers are not connected twice", () =>
{
    const store = storeWithThreePoints();
    const [a, b, c] = store.activeRoute.points;
    assert.equal(store.linkPoints(a.id, b.id), "exists");
    assert.equal(store.linkPoints(a.id, c.id), "linked");
    assert.equal(store.linkPoints(c.id, a.id), "exists");
    assert.equal(store.linkPoints(a.id, a.id), false);
    assert.equal(store.linkPoints(a.id, "missing"), false);
});

test("removing a waypoint removes its connections", () =>
{
    const store = storeWithThreePoints();
    const [a, , c] = store.activeRoute.points;
    store.linkPoints(a.id, c.id);
    store.removePoint(c.id);
    assert.deepEqual(store.activeRoute.links, []);
});

test("saved connections survive a reload and bad ones are dropped", () =>
{
    const points = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    assert.deepEqual(cleanLinks([["p1", "p3"], ["p3", "p1"], ["p1", "p1"], ["p1", "zzz"], "bad", ["p2", "p3"]], points), [["p1", "p3"], ["p2", "p3"]]);
});
