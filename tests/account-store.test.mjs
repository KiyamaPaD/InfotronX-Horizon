import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY } from "../src/constants.js";
import { createMission, MissionStore, storedSessionUserId } from "../src/store.js";

function memoryStorage()
{
    const values = new Map();

    return {
        get length() { return values.size; },
        key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function drawPoint(store)
{
    store.activeRoute.points.push({ id: "p1", lat: 18.44, lon: 77.45 });
    store.save();
}

test("a guest's routes are never written to the device", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: null });
    drawPoint(store);
    assert.equal(localStorage.getItem(STORAGE_KEY), null);
    assert.equal(store.persistLocal, false);
    assert.equal(store.lastSaveSucceeded, true);
});

test("reloading as a guest starts clean even if older data is on the device", () =>
{
    globalThis.localStorage = memoryStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ missions: [createMission("Old work")] }));
    const store = new MissionStore({ userId: null });
    assert.notEqual(store.current.title, "Old work");
});

test("signing in keeps what the guest drew and starts saving it", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: null });
    drawPoint(store);
    store.attachAccount("user-1");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.equal(saved.owner, "user-1");
    assert.equal(saved.missions[0].routes[0].points.length, 1);
});

test("one account cannot read another account's device copy", () =>
{
    globalThis.localStorage = memoryStorage();
    const first = new MissionStore({ userId: "user-1" });
    drawPoint(first);
    const other = new MissionStore({ userId: "user-2" });
    assert.equal(other.activeRoute.points.length, 0);
    const same = new MissionStore({ userId: "user-1" });
    assert.equal(same.activeRoute.points.length, 1);
});

test("signing out removes the device copy and clears the screen", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "user-1" });
    drawPoint(store);
    let notified = 0;
    store.subscribe(() => { notified++; });
    store.detachAccount();
    assert.equal(localStorage.getItem(STORAGE_KEY), null);
    assert.equal(store.activeRoute.points.length, 0);
    assert.equal(store.persistLocal, false);
    assert.equal(notified, 1);
});

test("the stored Supabase session identifies the user without a network call", () =>
{
    globalThis.localStorage = memoryStorage();
    assert.equal(storedSessionUserId(), null);
    localStorage.setItem("sb-abcdef-auth-token", JSON.stringify({ access_token: "x", user: { id: "user-9" } }));
    assert.equal(storedSessionUserId(), "user-9");
    localStorage.setItem("sb-abcdef-auth-token", "not json");
    assert.equal(storedSessionUserId(), null);
});
