import test from "node:test";
import assert from "node:assert/strict";
import { DStarLite } from "../src/dstar-lite.js";
import { findTerrainPath, gridCoordinate, validateDem } from "../src/terrain.js";
import { paretoFilter, dominates, paretoTerrainRoutes } from "../src/pareto-routes.js";
import { analyzeTerrainTopology } from "../src/terrain-topology.js";
import { auditDemMetadata, compareAlignedDems, posteriorVerticalBias } from "../src/dem-audit.js";

function dem(width = 9, height = 9, heights = () => 0)
{
    return validateDem({ width, height, north: 18.47, west: 77.43, latStep: 0.0003, lonStep: 0.0003, source: "Analytic test DEM, not NASA", horizontalDatum: "Mars 2000", verticalDatum: "Example reference", elevations: Array.from({ length: width * height }, (_, i) => heights(Math.floor(i / width), i % width)) });
}

const p = (d, row, col) => gridCoordinate(d, row, col);

function comparableCost(actual, baseline)
{
    assert.equal(actual.ok, baseline.ok, `incremental ${actual.reason || "ok"}; A* ${baseline.reason || "ok"}`);

    if (actual.ok)
    {
        assert.ok(Math.abs(actual.costMeters - baseline.costMeters) < 1e-5, `cost ${actual.costMeters} vs ${baseline.costMeters}`);
    }
}

test("D* Lite computes identical DEM path costs to full A*", () =>
{
    const d = dem(12, 10, (r, c) => (r > 4 && c > 3 ? 1.2 : 0));
    const a = p(d, 4, 0), b = p(d, 4, 11);
    const opts = { maxSlopePercent: 18, slopePenalty: 6 };
    const incremental = new DStarLite(d, a, b, opts);
    comparableCost(incremental.compute(), findTerrainPath(d, a, b, opts));
});

test("D* Lite updates a hypothetical zone incrementally then reverts to shortest path", () =>
{
    const d = dem(12, 11);
    const a = p(d, 5, 0), b = p(d, 5, 11);
    const inc = new DStarLite(d, a, b);
    const initial = inc.compute();
    const zone = [{ ...p(d, 5, 6), radiusMeters: 24 }];
    const change = inc.updateExclusions(zone);
    const detour = inc.compute();
    assert.ok(change.changedCells >= 1);
    comparableCost(detour, findTerrainPath(d, a, b, { exclusionZones: zone }));
    assert.ok(detour.distanceMeters > initial.distanceMeters);
    inc.updateExclusions([]);
    comparableCost(inc.compute(), findTerrainPath(d, a, b));
});

test("D* Lite rejects disconnected grids and blocked destination", () =>
{
    const d = dem(8, 8, (r, c) => c === 4 ? null : 0);
    const a = p(d, 3, 0), b = p(d, 3, 7);
    const incremental = new DStarLite(d, a, b);
    assert.equal(incremental.compute().ok, false);
    const clear = dem(8, 8);
    const live = new DStarLite(clear, p(clear, 3, 0), p(clear, 3, 7));
    const zone = [{ ...p(clear, 3, 7), radiusMeters: 8 }];
    live.updateExclusions(zone);
    assert.match(live.compute().reason, /Endpoint/);
    live.updateExclusions([]);
    assert.equal(live.compute().ok, true);
});

test("Pareto dominance and duplicates distinguish incomparable alternatives", () =>
{
    const a = { distanceMeters: 10, ascentMeters: 3 };
    const b = { distanceMeters: 11, ascentMeters: 5 };
    const c = { distanceMeters: 13, ascentMeters: 1 };
    assert.ok(dominates(a, b));
    assert.ok(!dominates(a, c));
    assert.equal(paretoFilter([a, b, c, { ...a }]).length, 2);
});

test("Pareto labels find real distance/ascent tradeoffs on analytic sloped grid", () =>
{
    const d = dem(9, 7, (r, c) => Math.abs(c - 4) * 0.6 + r * 0.1);
    const r = paretoTerrainRoutes(d, [p(d, 3, 0), p(d, 3, 8)], { maxExpansions: 15000 });
    assert.equal(r.ok, true);
    assert.ok(r.routes.length >= 2);
    assert.ok(r.routes[0].distanceMeters < r.routes.at(-1).distanceMeters);
    assert.ok(r.routes[0].ascentMeters > r.routes.at(-1).ascentMeters);
    assert.equal(r.truncated, false);
});

test("Pareto refuses skipping human anchors and blocked endpoints", () =>
{
    const d = dem();
    assert.equal(paretoTerrainRoutes(d, [p(d, 0, 0), p(d, 1, 1), p(d, 2, 2)]).ok, false);
    assert.equal(paretoTerrainRoutes(d, [p(d, 0, 0), p(d, 8, 8)], { exclusionZones: [{ ...p(d, 8, 8), radiusMeters: 10 }] }).ok, false);
});

test("Topology finds two peaks separated by a saddle and a persistent basin", () =>
{
    const d = dem(5, 3, (r, c) => r === 1 ? [0, 5, 1, 4, 0][c] : 0);
    const out = analyzeTerrainTopology(d, { minPersistenceMeters: 0.1 });
    assert.ok(out.peaks.some(x => Math.abs(x.birthMeters - 4) < 1e-9 && Math.abs(x.mergeMeters - 1) < 1e-9 && Math.abs(x.persistenceMeters - 3) < 1e-9));
    assert.equal(out.globalPeaks.length, 1);
});

test("Topology does not invent peaks on a flat plateau or on missing data", () =>
{
    const d = dem(6, 6, () => 7);
    const t = analyzeTerrainTopology(d, { minPersistenceMeters: 0 });
    assert.equal(t.peaks.length, 0);
    assert.equal(t.basins.length, 0);
    assert.equal(t.globalPeaks.length, 1);
    const islands = dem(5, 5, (r, c) => c === 2 ? null : 1);
    const u = analyzeTerrainTopology(islands);
    assert.equal(u.globalPeaks.length, 2);
    assert.equal(u.globalBasins.length, 2);
});

test("DEM metadata audit reports sampling without pretending height accuracy", () =>
{
    const d = dem(6, 6);
    const report = auditDemMetadata(d);
    assert.equal(report.validCells, 36);
    assert.ok(report.eastPostingMeters > 0);
    assert.equal(report.referenceComparisonAvailable, false);
});

test("DEM comparison requires independent datasets and common declared reference", () =>
{
    const a = dem(6, 6, (_, c) => 3 + c);
    const same = structuredClone(a);
    assert.throws(() => compareAlignedDems(a, same), /independently sourced/);
    const b = structuredClone(a);
    b.source = "Independent reference (test, not NASA)";
    b.elevations = b.elevations.map(x => x + 2);
    const residual = compareAlignedDems(a, b, { sampleStride: 1 });
    assert.equal(residual.ok, true);
    assert.ok(Math.abs(residual.biasMeters + 2) < 1e-7);
    assert.ok(residual.residualScatterMeters < 1e-7);
    b.verticalDatum = "Different";
    assert.throws(() => compareAlignedDems(a, b), /vertical datum/i);
});

test("Bayesian bias refuses invented sample independence; conditional posterior is analytical", () =>
{
    assert.throws(() => posteriorVerticalBias(3, { priorMeanMeters: 0, priorStdMeters: 5, observationStdMeters: 2 }), /effective independent-sample/);
    const r = posteriorVerticalBias(3, { priorMeanMeters: 0, priorStdMeters: 2, observationStdMeters: 2, effectiveIndependentSamples: 1 });
    assert.ok(Math.abs(r.posteriorMeanMeters - 1.5) < 1e-10);
    assert.ok(Math.abs(r.posteriorStdMeters - Math.sqrt(2)) < 1e-10);
});

test("D* Lite matches full A* on 40 seeded graph updates including NoData", () =>
{
    let checks = 0;

    for (let seed = 1; seed <= 10; seed++)
    {
        let state = seed;
        const next = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
        const data = dem(11, 11, () => next() < 0.08 ? null : Math.round(next() * 12) / 6);
        data.elevations[3 * 11 + 1] = 0;
        data.elevations[8 * 11 + 9] = 0;
        const a = p(data, 3, 1), b = p(data, 8, 9);
        const assumptions = { maxSlopePercent: 20, slopePenalty: 5 };
        const planner = new DStarLite(data, a, b, assumptions);

        for (let phase = 0; phase < 4; phase++)
        {
            const zone = phase === 0 || phase === 3 ? [] : [{ ...p(data, 3 + phase, 4 + phase), radiusMeters: 11 }];

            if (phase)
            {
                planner.updateExclusions(zone);
            }

            comparableCost(planner.compute(), findTerrainPath(data, a, b, { ...assumptions, exclusionZones: zone }));
            checks++;
        }
    }

    assert.equal(checks, 40);
});


test("Pareto supports one selected route even when several nondominated alternatives exist", () =>
{
    const d = dem(9, 7, (r, c) => Math.abs(c - 4) * 0.6 + r * 0.1);
    const from = p(d, 3, 0);
    const to = p(d, 3, 8);
    const full = paretoTerrainRoutes(d, [from, to], { maxExpansions: 15000 });
    const single = paretoTerrainRoutes(d, [from, to], { maxResults: 1, maxExpansions: 15000 });

    assert.equal(full.ok, true);
    assert.ok(full.allGoalLabels > 1);
    assert.equal(single.ok, true);
    assert.equal(single.routes.length, 1);
    assert.equal(single.allGoalLabels, full.allGoalLabels);
    assert.ok(Number.isFinite(single.routes[0].distanceMeters));
    assert.deepEqual(single.routes[0].cells, full.routes[0].cells);
});

test("Pareto rejects invalid output counts instead of returning an empty successful result", () =>
{
    const d = dem(5, 5);
    const from = p(d, 0, 0);
    const to = p(d, 4, 4);

    for (const value of [0, -1, 1.25, NaN, Infinity, "2"])
    {
        assert.throws(() => paretoTerrainRoutes(d, [from, to], { maxResults: value }), /positive integer/);
    }

    const capped = paretoTerrainRoutes(d, [from, to], { maxResults: 12 });
    assert.equal(capped.ok, true);
    assert.ok(capped.routes.length >= 1 && capped.routes.length <= 6);
});
