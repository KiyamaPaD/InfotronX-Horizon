import test from "node:test";
import assert from "node:assert/strict";
import { marsCellAreaSqMeters, measureGridRegion, haarBlock, analyzeHaarTerrain } from "../src/measure-theory.js";
import { validateDem } from "../src/terrain.js";
import { computeReachability } from "../src/terrain-intelligence.js";
import { gridCoordinate } from "../src/terrain.js";
import { readFileSync } from "node:fs";

const R = 3396190;
const DEG = Math.PI / 180;

function dem(width, height, heights, north = 18.46)
{
    return validateDem({ width, height, north, west: 77.43, latStep: 0.00034, lonStep: 0.00036, elevations: heights, source: "Synthetic math test, not NASA" });
}

function nearly(value, expected, tolerance = 1e-8)
{
    assert.ok(Math.abs(value - expected) <= tolerance, `Expected ${value} ≈ ${expected}`);
}

test("Mars cell area equals the exact spherical surface integral, not flat lat-lon area", () =>
{
    const grid = dem(2, 2, [1, 2, 3, 4]);
    const row = 0;
    const theta = grid.north * DEG;
    const half = grid.latStep * DEG / 2;
    const expected = R ** 2 * grid.lonStep * DEG * (Math.sin(theta + half) - Math.sin(theta - half));
    nearly(marsCellAreaSqMeters(grid, row), expected);
    assert.ok(marsCellAreaSqMeters(grid, 1) > marsCellAreaSqMeters(grid, 0));
});

test("area weighting falls with absolute latitude and ignores NoData", () =>
{
    const tropical = dem(2, 2, [1, null, 1, 1], 0.001);
    const high = dem(2, 2, [1, 1, 1, 1], 70.001);
    const mask = new Uint8Array([1, 1, 1, 0]);
    const area = measureGridRegion(tropical, mask);
    assert.equal(area.cells, 2);
    assert.equal(measureGridRegion(tropical, mask, { includeNoData: true }).cells, 3);
    assert.ok(measureGridRegion(high, new Uint8Array([1, 1, 1, 1])).squareMeters < measureGridRegion(dem(2, 2, [1, 1, 1, 1], 0.001), new Uint8Array([1, 1, 1, 1])).squareMeters * 0.5);
    assert.throws(() => measureGridRegion(tropical, new Uint8Array([1])));
    assert.throws(() => marsCellAreaSqMeters(tropical, 100));
});

test("Haar block is an exactly invertible 4-point transform and conserves detail variance", () =>
{
    const original = [1, 3, 5, 7];
    const h = haarBlock(...original);
    const { mean: a, horizontal: x, vertical: y, diagonal: z } = h;
    const reconstructed = [a + x + y + z, a - x + y - z, a + x - y - z, a - x - y + z];
    reconstructed.forEach((value, i) => nearly(value, original[i]));
    nearly(h.contrastMeters ** 2, original.reduce((sum, value) => sum + (value - a) ** 2, 0) / 4);
    assert.equal(haarBlock(1, null, 3, 4), null);
});

test("constant terrain has zero Haar contrast at every scale", () =>
{
    const report = analyzeHaarTerrain(dem(8, 8, Array(64).fill(-2550)), 4);
    assert.equal(report.levels.length, 3);
    assert.equal(report.levels[0].validBlocks, 16);
    report.levels.forEach(level => assert.equal(level.rmsContrastMeters, 0));
});

test("a height step creates nonzero Haar contrast; pure slope also appears", () =>
{
    const values = Array.from({ length: 64 }, (_, i) => (i % 8 >= 3 ? 10 : 0));
    const report = analyzeHaarTerrain(dem(8, 8, values), 3);
    assert.ok(report.levels.some(level => level.rmsContrastMeters > 0));
    assert.ok(report.levels[0].footprintMetersApprox > 0);
    assert.ok(report.levels[1].footprintMetersApprox > report.levels[0].footprintMetersApprox);
    const slope = analyzeHaarTerrain(dem(8, 8, Array.from({ length: 64 }, (_, i) => i % 8)), 3);
    assert.ok(slope.levels[0].rmsContrastMeters > 0, "Haar contrast is NOT detrended roughness!");
});

test("missing elevations make block unknown and do not get silently interpolated", () =>
{
    const flat = Array(16).fill(0);
    flat[0] = null;
    const result = analyzeHaarTerrain(dem(4, 4, flat));
    assert.equal(result.levels[0].validBlocks, 3);
    assert.equal(result.levels[1].validBlocks, 0);
    assert.equal(result.levels[1].rmsContrastMeters, null);
    assert.throws(() => analyzeHaarTerrain(dem(4, 4, Array(16).fill(0)), 0));
});

test("Dijkstra reports spherical integral area over exactly the reachable mask", () =>
{
    const grid = dem(7, 7, Array(49).fill(0));
    const report = computeReachability(grid, gridCoordinate(grid, 3, 3), { budgetMinutes: 1 });
    const expected = measureGridRegion(grid, report.bands);
    nearly(report.modeledAreaKm2, expected.squareKilometers, 1e-12);
    assert.equal(expected.cells, report.reachableCells);
    assert.match(report.areaMethod, /spherical/i);
});

test("UI exposes accessible multi-scale analysis without changing manual routes", () =>
{
    const source = readFileSync(new URL("../src/terrain-intelligence-ui.js", import.meta.url), "utf8");
    assert.match(source, /id="intel-run-haar"/);
    assert.match(source, /id="intel-haar-result"[^>]*role="status"/);
    assert.match(source, /analyzeHaarTerrain/);
    assert.match(source, /No sub-pixel hazards/);
    assert.doesNotMatch(source, /store\.addRoute\(/);
});
