import test from "node:test";
import assert from "node:assert/strict";
import { routeCostBreakdown, explainTerrainRouteChoice, ROUTE_PREFERENCES } from "../src/route-decision.js";
import { gridCoordinate, planRouteOnDem, validateDem } from "../src/terrain.js";
import { compareTerrainStrategies } from "../src/mission-scenarios.js";

function testGrid(heights)
{
    return validateDem({ width: 5, height: 5, north: 18.46, west: 77.43,
        latStep: 0.0005, lonStep: 0.0005, source: "Synthetic test DEM (not NASA)", elevations: heights });
}

test("A* objective exactly decomposes into grid distance and total absolute height change", () =>
{
    const breakdown = routeCostBreakdown({
        distanceMeters: 1250, ascentMeters: 50, descentMeters: 20
    }, 6);

    assert.equal(breakdown.verticalMeters, 70);
    assert.equal(breakdown.penaltyMeters, 420);
    assert.equal(breakdown.costMeters, 1670);
    assert.equal(routeCostBreakdown({ distanceMeters: 1250, ascentMeters: 50, descentMeters: 20 }, 0).costMeters, 1250);
    assert.throws(() => routeCostBreakdown({ distanceMeters: -1, ascentMeters: 1, descentMeters: 1 }, 6));
    assert.throws(() => routeCostBreakdown({ distanceMeters: 1, ascentMeters: 1, descentMeters: 1 }, NaN));
});

test("model does not invent a winning route if none is feasible", () =>
{
    const decision = explainTerrainRouteChoice([{ id: "a", ok: false, reason: "No data" }], "balanced");
    assert.deepEqual(decision.winners, []);
    assert.equal(decision.alternatives.length, 0);
    assert.match(decision.explanation, /No feasible/);
    assert.equal(decision.rejected[0].reason, "No data");
});

test("different preferences produce explainable cost rankings and a Pareto frontier", () =>
{
    const data = [
        { ok: true, id: "distance", label: "Shortest", slopePenalty: 0,
            stats: { distanceMeters: 100, ascentMeters: 12, descentMeters: 8, maxGradePercent: 18, costMeters: 100 } },
        { ok: true, id: "balanced", label: "Balanced", slopePenalty: 6,
            stats: { distanceMeters: 120, ascentMeters: 3, descentMeters: 2, maxGradePercent: 8, costMeters: 150 } },
        { ok: true, id: "gentle", label: "Gentle", slopePenalty: 24,
            stats: { distanceMeters: 145, ascentMeters: 2, descentMeters: 1, maxGradePercent: 4, costMeters: 217 } },
        { ok: true, id: "dominated", label: "Dominated", slopePenalty: 6,
            stats: { distanceMeters: 165, ascentMeters: 10, descentMeters: 10, maxGradePercent: 14, costMeters: 285 } }
    ];
    const shortest = explainTerrainRouteChoice(data, "distance");
    const balanced = explainTerrainRouteChoice(data, "balanced");
    const gentle = explainTerrainRouteChoice(data, "gentle");
    assert.deepEqual(shortest.winners, ["distance"]);
    assert.deepEqual(balanced.winners, ["balanced"]);
    assert.deepEqual(gentle.winners, ["gentle"]);
    assert.equal(balanced.alternatives.find(item => item.id === "dominated").onFrontier, false);
    assert.ok(balanced.alternatives.filter(item => item.onFrontier).length >= 2);
    assert.ok(balanced.alternatives.every(item => item.costConsistent === true));
    assert.equal(ROUTE_PREFERENCES.length, 3);
});

test("ties stay ties and do not produce fake safety rankings", () =>
{
    const a = { ok: true, id: "a", label: "A", slopePenalty: 0,
        stats: { distanceMeters: 100, ascentMeters: 0, descentMeters: 0, maxGradePercent: 0 } };
    const b = { ...a, id: "b", label: "B" };
    const result = explainTerrainRouteChoice([a,b]);
    assert.deepEqual(result.winners, ["a", "b"]);
    assert.equal(result.equivalent, true);
    assert.match(result.explanation, /equivalent/);
    assert.match(result.warning, /NOT a NASA-certified/);
});

test("actual DEM routes report A* costs matching the mathematical identity", () =>
{
    const elevations = Array.from({ length: 25 }, (_, i) => Math.floor(i / 5) + (i % 5));
    const dem = testGrid(elevations);
    const anchors = [gridCoordinate(dem, 0, 0), gridCoordinate(dem, 4, 4)];
    const candidates = compareTerrainStrategies(dem, anchors, { maxSlopePercent: 30 });
    assert.ok(candidates.every(item => item.ok));
    const report = explainTerrainRouteChoice(candidates, "gentle");
    assert.ok(report.alternatives.every(row => row.costConsistent === true));
    assert.ok(report.alternatives.every(row => row.onFrontier));
    for (const candidate of candidates)
    {
        const explicit = planRouteOnDem(dem, anchors, { slopePenalty: candidate.slopePenalty, maxSlopePercent: 30 });
        assert.ok(Math.abs(explicit.stats.costMeters - candidate.stats.costMeters) < 1e-7);
    }
});
