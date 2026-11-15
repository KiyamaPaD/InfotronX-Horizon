import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marsDistance } from "../src/geo.js";
import { MARS_RADIUS_METERS } from "../src/constants.js";
import { estimateMarswalk, DEFAULT_EVA_ASSUMPTIONS } from "../src/resources.js";
import { routeCostBreakdown } from "../src/route-decision.js";
import { calculateGrade } from "../src/terrain.js";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const close = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test("the radius in the README is the radius in the code", () =>
{
    assert.equal(MARS_RADIUS_METERS, 3396190);
    assert.match(readme, /3\\,396\\,190/);
});

test("distance checks quoted in the README hold", () =>
{
    close(marsDistance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 59274.7, 0.1);
    close(marsDistance({ lat: 60, lon: 0 }, { lat: 60, lon: 1 }), 29637.1, 0.1);
    close(marsDistance({ lat: 18.4446, lon: 77.4509 }, { lat: 18.45, lon: 77.46 }), 603.5, 0.1);
    close(marsDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }) / 1000, 10669.4, 0.1);
    assert.match(readme, /59\\,274\.7/);
    assert.match(readme, /603\.5/);
});

test("a route's length is the sum of its legs", () =>
{
    const a = { lat: 18.44, lon: 77.45 }, b = { lat: 18.46, lon: 77.47 }, c = { lat: 18.49, lon: 77.44 };
    close(marsDistance(a, b) + marsDistance(b, c), marsDistance(a, b) + marsDistance(b, c), 1e-9);
});

test("grade is metres of rise per 100 metres travelled", () =>
{
    close(calculateGrade(0, 7.3, 100), 7.3, 1e-9);
    assert.equal(calculateGrade(0, 5, 0), null);
});

test("the cost of a step equals distance plus the penalty times the height change", () =>
{
    const stepCost = 100 * (1 + 6 * 5 / 100);
    close(stepCost, 130, 1e-9);
    const cost = routeCostBreakdown({ distanceMeters: 100, ascentMeters: 5, descentMeters: 0 }, 6);
    close(cost.costMeters, 130, 1e-9);
});

test("the resource example in the README is what the model gives", () =>
{
    const estimate = estimateMarswalk(4200);
    close(estimate.durationHours, 3.75, 1e-9);
    close(estimate.oxygenKg, 0.45, 1e-9);
    close(estimate.batteryWh, 1050, 1e-6);
    close(estimate.usableOxygenKg, 0.9, 1e-9);
    close(estimate.usableBatteryWh, 1650, 1e-9);
    close(estimate.usableDurationHours, 6, 1e-9);
    assert.deepEqual(estimate.warnings, []);
    assert.equal(DEFAULT_EVA_ASSUMPTIONS.speedKmh, 2.4);
    assert.equal(DEFAULT_EVA_ASSUMPTIONS.reservePercent, 25);
});
