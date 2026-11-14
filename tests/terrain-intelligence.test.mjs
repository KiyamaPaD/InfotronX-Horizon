import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLineOfSight, analyzeTerrainSurface, computeReachability, getTerrainCellMetrics, sampleElevationBilinear } from "../src/terrain-intelligence.js";
import { gridCoordinate, validateDem } from "../src/terrain.js";

function terrain(width, height, values = () => 0)
{
    return validateDem({ width, height, north: 18.46, west: 77.43, latStep: 0.000337, lonStep: 0.000356, elevations: Array.from({ length: width * height }, (_, i) => values(Math.floor(i / width), i % width)), source: "Analytic test DEM · not NASA" });
}

test("bilinear terrain height interpolation matches an analytic plane", () =>
{
    const dem = terrain(5, 5, (r, c) => 100 + r * 2 + c * 4);
    const a = gridCoordinate(dem, 1, 1);
    const b = gridCoordinate(dem, 2, 2);
    const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
    assert.ok(Math.abs(sampleElevationBilinear(dem, mid) - 109) < 1e-7);
    assert.equal(sampleElevationBilinear(dem, { lat: 19, lon: 78 }), null);
});

test("3×3 least-squares terrain plane returns zero roughness", () =>
{
    const dem = terrain(5, 5, (r, c) => -2500 + r * 2 + c * 4);
    const value = getTerrainCellMetrics(dem, 2, 2);
    assert.ok(value.gradePercent > 0);
    assert.ok(value.roughnessMeters < 1e-10);
    assert.equal(value.sampleCount, 9);
});

test("rugged center increases plane residual RMS; missing data is unknown", () =>
{
    const base = terrain(5, 5, () => 0);
    base.elevations[2 * 5 + 2] = 10;
    assert.ok(getTerrainCellMetrics(base, 2, 2).roughnessMeters > 1);
    base.elevations[1 * 5 + 1] = null;
    assert.equal(getTerrainCellMetrics(base, 2, 2), null);
});

test("surface analytics reports missing DEM boundaries honestly", () =>
{
    const result = analyzeTerrainSurface(terrain(5, 5, () => 0));
    assert.equal(result.validCells, 9);
    assert.equal(result.maxGradePercent, 0);
    assert.ok(Number.isNaN(result.grade[0]));
});

test("flat Mars terrain has clear line of sight for above-ground endpoints", () =>
{
    const dem = terrain(11, 11);
    const result = analyzeLineOfSight(dem, gridCoordinate(dem, 5, 1), gridCoordinate(dem, 5, 9));
    assert.equal(result.status, "visible");
    assert.ok(result.minimumClearanceMeters > 0);
});

test("an intervening ridge obstructs line of sight", () =>
{
    const dem = terrain(11, 11, (r, c) => c === 5 ? 25 : 0);
    const result = analyzeLineOfSight(dem, gridCoordinate(dem, 5, 1), gridCoordinate(dem, 5, 9));
    assert.equal(result.status, "blocked");
    assert.ok(result.minimumClearanceMeters < 0);
});

test("line of sight returns unknown rather than fabricating visibility through gaps", () =>
{
    const dem = terrain(11, 11);
    dem.elevations[5 * 11 + 5] = null;
    assert.equal(analyzeLineOfSight(dem, gridCoordinate(dem, 5, 1), gridCoordinate(dem, 5, 9)).status, "unknown");
    assert.equal(analyzeLineOfSight(dem, { lat: 0, lon: 0 }, gridCoordinate(dem, 5, 9)).status, "unknown");
});

test("visibility includes both endpoint heights as user-specified parameters", () =>
{
    const dem = terrain(11, 11, (r, c) => c === 5 ? 4 : 0);
    const a = gridCoordinate(dem, 5, 1), b = gridCoordinate(dem, 5, 9);
    assert.equal(analyzeLineOfSight(dem, a, b, { observerHeightMeters: 1, targetHeightMeters: 1 }).status, "blocked");
    assert.equal(analyzeLineOfSight(dem, a, b, { observerHeightMeters: 8, targetHeightMeters: 8 }).status, "visible");
});

test("reachability uses a genuine Dijkstra expansion and zero budget never claimed", () =>
{
    const dem = terrain(11, 11);
    const source = gridCoordinate(dem, 5, 5);
    const small = computeReachability(dem, source, { budgetMinutes: 0.1, speedKmh: 2.4 });
    const large = computeReachability(dem, source, { budgetMinutes: 5, speedKmh: 2.4 });
    assert.equal(small.reachableCells, 1);
    assert.ok(large.reachableCells > small.reachableCells);
    assert.ok(large.modeledAreaKm2 > small.modeledAreaKm2);
    assert.throws(() => computeReachability(dem, source, { budgetMinutes: 0 }));
});

test("reachability respects NoData barriers and does not cut corners", () =>
{
    const dem = terrain(7, 7, (r, c) => (r === 3 && c !== 3 ? null : 0));
    const start = gridCoordinate(dem, 1, 3);
    const report = computeReachability(dem, start, { budgetMinutes: 10 });
    assert.equal(report.bands[3 * 7 + 1], 0);
    assert.ok(report.bands[4 * 7 + 3] > 0);
});

test("terrain slope and explicit exclusion reduce feasible reachability", () =>
{
    const dem = terrain(9, 9, (r, c) => c >= 5 ? 200 : 0);
    const start = gridCoordinate(dem, 4, 2);
    const noZone = computeReachability(dem, start, { budgetMinutes: 60, maxSlopePercent: 10 });
    assert.equal(noZone.bands[4 * 9 + 7], 0);
    const zone = [{ ...gridCoordinate(dem, 4, 3), radiusMeters: 10 }];
    const withZone = computeReachability(dem, start, { budgetMinutes: 60, maxSlopePercent: 10, exclusionZones: zone });
    assert.ok(withZone.reachableCells < noZone.reachableCells);
    assert.equal(withZone.bands[4 * 9 + 3], 0);
});

test("blocked start and oversized budgets produce explicit errors", () =>
{
    const dem = terrain(7, 7);
    const start = gridCoordinate(dem, 3, 3);
    const zone = [{ ...start, radiusMeters: 30 }];
    assert.equal(computeReachability(dem, start, { exclusionZones: zone }).ok, false);
    assert.throws(() => computeReachability(dem, start, { budgetMinutes: 999 }));
});
