import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRoute, marsDistance } from "../src/geo.js";

// Expected values are computed by hand from R = 3,396,190 m: one degree of arc is R·π/180 = 59,274.7 m.
const METERS_PER_DEGREE = 3396190 * Math.PI / 180;

test("one degree of latitude on Mars is about 59.27 km", () =>
{
    const meters = marsDistance({ lat: 18, lon: 77.45 }, { lat: 19, lon: 77.45 });
    assert.ok(Math.abs(meters - 59274.7) < 0.5, meters);
});

test("two Jezero points on one meridian are 0.1 degree apart", () =>
{
    const meters = marsDistance({ lat: 18.4, lon: 77.45 }, { lat: 18.5, lon: 77.45 });
    assert.ok(Math.abs(meters - METERS_PER_DEGREE * 0.1) < 0.01, meters);
});

test("two Jezero points on one parallel shrink by cos(latitude)", () =>
{
    const meters = marsDistance({ lat: 18.4446, lon: 77.4 }, { lat: 18.4446, lon: 77.5 });
    const expected = METERS_PER_DEGREE * 0.1 * Math.cos(18.4446 * Math.PI / 180);
    assert.ok(Math.abs(meters - expected) < 0.05, meters + " vs " + expected);
});

test("a three-point route equals the sum of its two segments", () =>
{
    const points = [{ lat: 18.40, lon: 77.40 }, { lat: 18.45, lon: 77.45 }, { lat: 18.47, lon: 77.52 }];
    const route = analyzeRoute(points);
    const sum = marsDistance(points[0], points[1]) + marsDistance(points[1], points[2]);
    assert.equal(route.segments.length, 2);
    assert.ok(Math.abs(route.totalDistance - sum) < 1e-9);
    assert.ok(route.totalDistance > marsDistance(points[0], points[2]), "detour via the middle point is longer than the direct arc");
});
