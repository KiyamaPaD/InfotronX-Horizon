import test from "node:test";
import assert from "node:assert/strict";
import { validateDem } from "../src/terrain.js";
import { analyzeHypsometry, marchingSquares, empiricalCvar, empiricalWasserstein1, compareResourceDistributions } from "../src/advanced-math.js";
import { marsDistance } from "../src/geo.js";

function grid(width, height, elevations, north = 18.46)
{
    return validateDem({ width, height, north, west: 77.43, latStep: 0.00034, lonStep: 0.00036, source: "Synthetic analytical fixture, not NASA", elevations });
}

const close = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `Expected ${a} ≈ ${b}`);

test("hypsometry gives exact area-weighted bins and fractions summing to one", () =>
{
    const dem = grid(2, 2, [1, 2, 3, 4]);
    const result = analyzeHypsometry(dem, 4);
    assert.equal(result.validCells, 4);
    assert.deepEqual(result.bins.map(bin => bin.count), [1, 1, 1, 1]);
    close(result.bins.reduce((sum, bin) => sum + bin.areaFraction, 0), 1);
    close(result.bins.at(-1).cumulativeAreaFraction, 1);
    assert.ok(result.areaWeightedMeanMeters > 2 && result.areaWeightedMeanMeters < 3);
});

test("hypsometry excludes NoData and produces valid constant-height distribution", () =>
{
    const result = analyzeHypsometry(grid(2, 2, [null, 5, 5, 5]), 4);
    assert.equal(result.validCells, 3);
    close(result.areaWeightedMeanMeters, 5);
    assert.equal(result.areaWeightedMedianMeters, 5);
    assert.equal(result.bins[0].count, 3);
    assert.equal(result.bins.slice(1).reduce((s, bin) => s + bin.count, 0), 0);
});

test("hypsometry rejects invalid histogram bin count", () =>
{
    assert.throws(() => analyzeHypsometry(grid(2, 2, [1, 2, 3, 4]), 1), /bins/);
});

test("Marching Squares intersects a planar ramp at the exact interpolated fraction", () =>
{
    const dem = grid(2, 2, [0, 10, 0, 10]);
    const result = marchingSquares(dem, 5);
    assert.equal(result.segments.length, 1);
    close(result.segments[0].a.column, 0.5);
    close(result.segments[0].b.column, 0.5);
    close(result.segments[0].lengthMeters, marsDistance({ lat: dem.north, lon: dem.west + dem.lonStep / 2 }, { lat: dem.north - dem.latStep, lon: dem.west + dem.lonStep / 2 }), 1e-6);
});

test("saddle ambiguity yields two segments with deterministic selection", () =>
{
    const sample = grid(2, 2, [10, 0, 0, 10]);
    const result = marchingSquares(sample, 5);
    assert.equal(result.ambiguousCells, 1);
    assert.equal(result.segments.length, 2);
    assert.ok(result.totalLengthMeters > 0);
});

test("NoData never fabricates a contour, and out-of-range level is empty", () =>
{
    const dem = grid(2, 2, [0, null, 10, 20]);
    const x = marchingSquares(dem, 5);
    assert.equal(x.segments.length, 0);
    assert.equal(x.skippedNoDataCells, 1);
    assert.equal(marchingSquares(grid(2, 2, [1, 2, 3, 4]), 100).segments.length, 0);
});

test("CVaR computes exact empirical upper tail including fractional sample", () =>
{
    const x = empiricalCvar([0, 0, 10, 20], 0.625);
    close(x.cvar, (20 + 0.5 * 10) / 1.5);
    close(x.mean, 7.5);
    close(x.var, 10);
    close(empiricalCvar([4, 4, 4, 4]).cvar, 4);
});

test("Wasserstein is symmetric, zero on matching distributions, translation correct", () =>
{
    close(empiricalWasserstein1([0, 1, 3], [5, 6, 8]), 5);
    close(empiricalWasserstein1([0, 10], [5]), 5);
    close(empiricalWasserstein1([0, 10], [0, 0, 10]), 10 / 6);
    close(empiricalWasserstein1([0, 10], [0, 10]), 0);
    close(empiricalWasserstein1([0, 0, 10], [0, 10]), empiricalWasserstein1([0, 10], [0, 0, 10]));
});

test("CVaR and Wasserstein reject invalid or nonfinite samples", () =>
{
    assert.throws(() => empiricalWasserstein1([0], [Infinity]));
    assert.throws(() => empiricalCvar([], 0.9));
    assert.throws(() => empiricalCvar([0, 1], 1));
});

test("paired seeded resource distributions are deterministic and compare scenario costs", () =>
{
    const first = compareResourceDistributions(800, 1200, {}, { seed: 42, samples: 100 });
    const second = compareResourceDistributions(800, 1200, {}, { seed: 42, samples: 100 });
    assert.deepEqual(first, second);
    assert.ok(first.metrics.durationHours.alternative.cvar > first.metrics.durationHours.reference.cvar);
    assert.ok(first.metrics.oxygenKg.wasserstein1 > 0);
    assert.ok(first.metrics.batteryWh.wasserstein1 > 0);
});

test("identical routes produce zero Wasserstein and equal CVaR under same variations", () =>
{
    const result = compareResourceDistributions(900, 900, {}, { samples: 50 });
    for (const metric of Object.values(result.metrics))
    {
        close(metric.wasserstein1, 0);
        close(metric.reference.cvar, metric.alternative.cvar);
    }
});

test("invalid route distances and simulation parameters are rejected", () =>
{
    assert.throws(() => compareResourceDistributions(-1, 1));
    assert.throws(() => compareResourceDistributions(0, 1, {}, { samples: 4 }));
    assert.throws(() => compareResourceDistributions(0, 1, {}, { variationPercent: NaN }));
});
