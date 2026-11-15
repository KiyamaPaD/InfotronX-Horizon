import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BENCHMARK, benchmarkMissionData, rankByCost, crossoverLambda, crossovers } from "../src/benchmark.js";
import { decodeBundledDem } from "../src/bundled-dem.js";
import { planRouteOnDem, profileRouteOnDem } from "../src/terrain.js";
import { summarizeTerrainProfile } from "../src/terrain-profile-v2.js";
import { analyzeRoute } from "../src/geo.js";
import { validateMission } from "../src/store.js";

const dem = decodeBundledDem(JSON.parse(readFileSync(new URL("../assets/jezero_ctx_trn_dem_20m_clip.json", import.meta.url), "utf8")));
const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

test("the benchmark routes are reproduced by the planner on the bundled height model", () =>
{
    const start = { lat: BENCHMARK.routes[0].points[0][0], lon: BENCHMARK.routes[0].points[0][1] };
    const end = { lat: BENCHMARK.routes[0].points.at(-1)[0], lon: BENCHMARK.routes[0].points.at(-1)[1] };

    for (const route of BENCHMARK.routes)
    {
        const plan = planRouteOnDem(dem, [start, end], { slopePenalty: route.penalty });
        assert.equal(plan.ok, true, route.name);
        close(plan.stats.distanceMeters, route.expected.distanceMeters, 0.01, route.name + " distance");
        close(plan.stats.ascentMeters, route.expected.ascentMeters, 0.01, route.name + " climb");
        close(plan.stats.descentMeters, route.expected.descentMeters, 0.01, route.name + " descent");
        close(plan.stats.maxGradePercent, route.expected.maxGradePercent, 0.01, route.name + " slope");
        assert.equal(plan.points.length, route.points.length, route.name + " waypoints");
    }
});

test("the stored coordinates give the same numbers through the profile tools", () =>
{
    for (const route of BENCHMARK.routes)
    {
        const points = route.points.map(([lat, lon]) => ({ lat, lon }));
        const summary = summarizeTerrainProfile(dem, points, profileRouteOnDem(dem, points));
        assert.equal(summary.complete, true, route.name + " lies inside the height model");
        close(analyzeRoute(points).totalDistance, route.expected.distanceMeters, 20, route.name + " spherical distance");
    }
});

test("the benchmark mission is a valid mission with three routes", () =>
{
    const mission = validateMission(benchmarkMissionData());
    assert.ok(mission);
    assert.equal(mission.routes.length, 3);
    assert.equal(mission.routes[0].points[0].name, "Start");
});

test("the cost ranking changes at the penalty where the shorter route stops being cheapest", () =>
{
    const rows = BENCHMARK.routes.map(route => ({ name: route.name, distanceMeters: route.expected.distanceMeters, verticalMeters: route.expected.ascentMeters + route.expected.descentMeters }));
    assert.equal(rankByCost(rows, 24)[0].name, "Gentle (penalty 24)");
    assert.equal(rankByCost(rows, 6)[0].name, "Balanced (penalty 6)");
    const point = crossoverLambda(rows[1], rows[2]);
    close(point.lambda, 10.64, 0.01, "balanced versus gentle");
    assert.equal(rankByCost(rows, point.lambda - 0.5)[0].name, "Balanced (penalty 6)");
    assert.equal(rankByCost(rows, point.lambda + 0.5)[0].name, "Gentle (penalty 24)");
    assert.equal(crossoverLambda(rows[0], rows[1]), null, "balanced is as short and climbs less, so there is nothing to trade");
    assert.ok(crossovers(rows).length >= 1);
});
