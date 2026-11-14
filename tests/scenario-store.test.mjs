import test from "node:test";
import assert from "node:assert/strict";
import { MissionStore, createMission, validateMission } from "../src/store.js";

function memoryStorage()
{
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("EVA scenario survives mission import, save, reload, and checkpoint restore", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    store.setEvaScenario({ speedKmh: 3.3, reservePercent: 35 });
    const checkpoint = store.saveCheckpoint("Before experimental EVA settings");
    store.setEvaScenario({ speedKmh: 1.5, reservePercent: 12 });
    assert.equal(store.restoreCheckpoint(checkpoint.id), true);
    assert.equal(store.current.evaScenario.speedKmh, 3.3);
    assert.equal(store.current.evaScenario.reservePercent, 35);
    assert.equal(new MissionStore().current.evaScenario.speedKmh, 3.3);
    assert.equal(validateMission(JSON.parse(JSON.stringify(store.current))).evaScenario.reservePercent, 35);
});

test("invalid shared EVA model settings are replaced by explicit defaults", () =>
{
    const mission = createMission();
    mission.evaScenario = { speedKmh: -123, reservePercent: 400 };
    const imported = validateMission(mission);
    assert.equal(imported.evaScenario.speedKmh, 2.4);
    assert.equal(imported.evaScenario.reservePercent, 25);
});

test("terrain metadata survives mission import but direct coordinate edits invalidate it", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    const route = store.activeRoute;
    route.terrainModel = { source: "User-imported numeric DEM, not NASA-validated", stats: { distanceMeters: 900, ascentMeters: 10, descentMeters: 5, maxGradePercent: 12 } };
    store.save();
    const reloaded = new MissionStore();
    const restoredRoute = reloaded.activeRoute;
    assert.equal(restoredRoute.terrainModel.stats.ascentMeters, 10);
    assert.equal(reloaded.updatePoint(restoredRoute.points[0].id, { lat: 18.445, lon: 77.451 }), true);
    assert.equal(reloaded.activeRoute.terrainModel, null);
});
