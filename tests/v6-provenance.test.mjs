import test from "node:test";
import assert from "node:assert/strict";
import { createMission, validateMission } from "../src/store.js";

test("V6 scenario exclusion provenance survives mission export and import", () =>
{
    const mission = createMission("Test exclusion decision trail");
    mission.routes[0].points = [{ id: "1", lat: 18.4, lon: 77.4 }, { id: "2", lat: 18.5, lon: 77.5 }];
    mission.routes[0].terrainModel = {
        source: "TEST ONLY synthetic grid",
        stats: { distanceMeters: 4000, ascentMeters: 60, descentMeters: 10, maxGradePercent: 4.1 },
        scenario: { model: "A*", slopePenalty: 24, maxSlopePercent: 18, exclusionZones: [{ observationId: "note-1", title: "Not a real hazard", lat: 18.45, lon: 77.45, radiusMeters: 80 }] }
    };
    const restored = validateMission(JSON.parse(JSON.stringify(mission)));
    assert.deepEqual(restored.routes[0].terrainModel.scenario.exclusionZones, mission.routes[0].terrainModel.scenario.exclusionZones);
    assert.equal(restored.routes[0].terrainModel.scenario.verified, false);
    assert.equal(restored.routes[0].terrainModel.scenario.slopePenalty, 24);
});

test("untrusted exclusion metadata is sanitized instead of trusted", () =>
{
    const mission = createMission();
    mission.routes[0].terrainModel = {
        source: "Imported synthetic DEM", stats: { distanceMeters: 100, ascentMeters: 0, descentMeters: 0, maxGradePercent: 0 },
        scenario: { verified: true, slopePenalty: 1000, exclusionZones: [{ lat: 999, lon: 77, radiusMeters: -1 }, { lat: 18, lon: 77, radiusMeters: 20, title: "sample" }] }
    };
    const restored = validateMission(mission).routes[0].terrainModel;
    assert.equal(restored.scenario.verified, false);
    assert.equal(restored.scenario.exclusionZones.length, 1);
    assert.equal(restored.scenario.slopePenalty, 100);
});
