import test from "node:test";
import assert from "node:assert/strict";
import { compareTerrainStrategies, estimateResourceEnvelope, measureRouteChange } from "../src/mission-scenarios.js";
import { findTerrainPath, gridCoordinate, makeExclusionMask, validateDem } from "../src/terrain.js";

function grid(width, height, elevations)
{
    return validateDem({ width, height, north: 18.46, west: 77.43, latStep: 0.0005, lonStep: 0.0005, elevations, source: "TEST ONLY · synthetic DEM" });
}

test("exclusion masks only cover synthetic cells within radius", () =>
{
    const dem = grid(7, 7, Array(49).fill(10));
    const center = gridCoordinate(dem, 3, 3);
    const mask = makeExclusionMask(dem, [{ ...center, radiusMeters: 38 }]);
    assert.equal(mask[3 * 7 + 3], 1);
    assert.equal(mask[0], 0);
    assert.ok([...mask].reduce((sum, value) => sum + value, 0) > 1);
});

test("A* reroutes around a what-if exclusion and keeps manual endpoints", () =>
{
    const dem = grid(9, 9, Array(81).fill(0));
    const start = gridCoordinate(dem, 4, 0);
    const end = gridCoordinate(dem, 4, 8);
    const baseline = findTerrainPath(dem, start, end);
    const zone = { ...gridCoordinate(dem, 4, 4), radiusMeters: 48 };
    const revised = findTerrainPath(dem, start, end, { exclusionZones: [zone] });
    assert.equal(baseline.ok, true);
    assert.equal(revised.ok, true);
    assert.ok(revised.distanceMeters > baseline.distanceMeters);
    const mask = makeExclusionMask(dem, [zone]);
    assert.ok(revised.cells.every(cell => mask[cell] === 0));
    assert.equal(revised.cells[0], 4 * 9);
    assert.equal(revised.cells.at(-1), 4 * 9 + 8);
});

test("exclusion blocks endpoints and enforces input validation", () =>
{
    const dem = grid(5, 5, Array(25).fill(0));
    const start = gridCoordinate(dem, 1, 1);
    const end = gridCoordinate(dem, 4, 4);
    assert.match(findTerrainPath(dem, start, end, { exclusionZones: [{ ...start, radiusMeters: 10 }] }).reason, /waypoint falls/);
    assert.throws(() => makeExclusionMask(dem, [{ ...start, radiusMeters: 0 }]), /valid Mars coordinates/);
    assert.throws(() => makeExclusionMask(dem, Array(21).fill({ ...start, radiusMeters: 10 })), /At most/);
});

test("A* cannot cut diagonally across blocked exclusion neighbors", () =>
{
    const dem = grid(3, 3, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const start = gridCoordinate(dem, 0, 0);
    const end = gridCoordinate(dem, 1, 1);
    const zoneA = { ...gridCoordinate(dem, 0, 1), radiusMeters: 5 };
    const zoneB = { ...gridCoordinate(dem, 1, 0), radiusMeters: 5 };
    const result = findTerrainPath(dem, start, end, { exclusionZones: [zoneA, zoneB] });
    assert.equal(result.ok, false);
});

test("three routing strategies share the same DEM and waypoint anchors", () =>
{
    const dem = grid(9, 9, Array(81).fill(0));
    const anchors = [gridCoordinate(dem, 0, 0), gridCoordinate(dem, 8, 8)];
    const results = compareTerrainStrategies(dem, anchors);
    assert.deepEqual(results.map(x => x.id), ["distance", "balanced", "gentle"]);
    assert.ok(results.every(x => x.ok && x.points.length >= 2));
    assert.ok(results.every(x => x.points[0].lat === anchors[0].lat));
});

test("sensitivity envelope is deterministic with seed and marks artificial assumptions", () =>
{
    const options = { samples: 400, seed: 55, variationPercent: 25 };
    const first = estimateResourceEnvelope(4000, {}, options);
    const second = estimateResourceEnvelope(4000, {}, options);
    assert.deepEqual(first, second);
    assert.ok(first.durationHours.p10 < first.durationHours.median);
    assert.ok(first.durationHours.median < first.durationHours.p90);
    assert.ok(first.exceedanceFrequency.any >= 0 && first.exceedanceFrequency.any <= 1);
    assert.match(first.disclaimer, /not calibrated/);
});

test("zero sensitivity exactly agrees with deterministic scenario", () =>
{
    const result = estimateResourceEnvelope(1200, { speedKmh: 2, observationMinutes: 30, retraceReturn: false }, { samples: 30, variationPercent: 0 });
    assert.equal(result.durationHours.p10, 1.1);
    assert.equal(result.durationHours.p90, 1.1);
    assert.equal(result.oxygenKg.p10, 1.1 * 0.12);
});

test("sensitivity works at upper valid resource bounds and rejects invalid settings", () =>
{
    const result = estimateResourceEnvelope(8000, { speedKmh: 12, batteryWatts: 5000, oxygenKgPerHour: 3 }, { samples: 50, variationPercent: 60 });
    assert.ok(result.batteryWh.p90 > 0);
    assert.throws(() => estimateResourceEnvelope(1000, {}, { samples: 3001 }), /Invalid/);
    assert.throws(() => estimateResourceEnvelope(1000, {}, { variationPercent: NaN }), /Invalid/);
});

test("route change calculation distinguishes route length from route cost", () =>
{
    const dem = grid(5, 5, Array(25).fill(0));
    const start = gridCoordinate(dem, 0, 0);
    const finish = gridCoordinate(dem, 4, 4);
    const direct = [start, finish];
    const detour = [start, gridCoordinate(dem, 4, 0), finish];
    const comparison = measureRouteChange(direct, detour);
    assert.ok(comparison.differenceMeters > 0);
    assert.ok(comparison.differencePercent > 0);
});
