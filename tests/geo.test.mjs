import test from "node:test";
import assert from "node:assert/strict";
import { JEZERO } from "../src/constants.js";
import { analyzeRoute, formatDistance, generateDetour, marsDistance, project, unproject } from "../src/geo.js";
import { createMission, validateMission } from "../src/store.js";

const A = { lat: 18.4446, lon: 77.4509 };
const B = { lat: 18.4500, lon: 77.4600 };

test("distance between identical Martian coordinates is zero", () =>
{
    assert.equal(marsDistance(A, A), 0);
});

test("one degree along the equator corresponds to Mars radius", () =>
{
    const distance = marsDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    assert.ok(Math.abs(distance - 59274.7) < 5);
});

test("route analysis sums segment distances", () =>
{
    const result = analyzeRoute([A, B, JEZERO]);
    assert.equal(result.segments.length, 2);
    assert.ok(Math.abs(result.totalDistance - marsDistance(A, B) * 2) < 0.01);
});

test("project and unproject roundtrip", () =>
{
    for (const zoom of [3, 8, 11, 13])
    {
        const restored = unproject(project(A, zoom), zoom);
        assert.ok(Math.abs(restored.lat - A.lat) < 1e-9);
        assert.ok(Math.abs(restored.lon - A.lon) < 1e-9);
    }
});

test("detour creates a distinct waypoint and extends a simple route", () =>
{
    const points = [A, B];
    const detour = generateDetour(points);
    assert.equal(detour.length, 3);
    assert.ok(analyzeRoute(detour).totalDistance > analyzeRoute(points).totalDistance);
    assert.equal(points.length, 2);
});

test("invalid imported coordinates are discarded", () =>
{
    const mission = createMission("Test");
    mission.routes[0].points = [{ lat: 1000, lon: 0 }, A];
    const validated = validateMission(mission);
    assert.equal(validated.routes[0].points.length, 1);
});

test("distance formatting", () =>
{
    assert.equal(formatDistance(1250), "1.25 km");
    assert.equal(formatDistance(450), "450 m");
});
