import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EVA_ASSUMPTIONS, estimateMarswalk, validateEvaAssumptions } from "../src/resources.js";

test("resource estimate uses Mars surface meters, roundtrip and stops", () =>
{
    const a = estimateMarswalk(2400, { speedKmh: 2.4, observationMinutes: 30, oxygenKgPerHour: 0.1, batteryWatts: 200 });
    assert.equal(a.travelDistanceMeters, 4800);
    assert.equal(a.travelHours, 2);
    assert.equal(a.stopHours, 0.5);
    assert.equal(a.durationHours, 2.5);
    assert.equal(a.oxygenKg, 0.25);
    assert.equal(a.batteryWh, 500);
    assert.equal(a.isIllustrative, true);
    assert.equal(a.usedTerrainModel, false);
});

test("one-way option does not double path", () =>
{
    const estimate = estimateMarswalk(1000, { speedKmh: 2, observationMinutes: 0, retraceReturn: false });
    assert.equal(estimate.travelDistanceMeters, 1000);
    assert.equal(estimate.durationHours, 0.5);
});

test("reserve budgets calculate usable supplies and warnings", () =>
{
    const estimate = estimateMarswalk(3000, {
        speedKmh: 1, observationMinutes: 0, retraceReturn: true,
        oxygenKgPerHour: 0.2, oxygenAvailableKg: 0.8, batteryWatts: 300,
        batteryAvailableWh: 1200, reservePercent: 25, maxDurationHours: 5
    });
    assert.ok(Math.abs(estimate.usableOxygenKg - 0.6) < 1e-10);
    assert.equal(estimate.usableBatteryWh, 900);
    assert.equal(estimate.usableDurationHours, 3.75);
    assert.equal(estimate.warnings.length, 3);
});

test("zero route and no pauses has no predicted consumption", () =>
{
    const estimate = estimateMarswalk(0, { observationMinutes: 0 });
    assert.equal(estimate.durationHours, 0);
    assert.equal(estimate.oxygenKg, 0);
    assert.equal(estimate.batteryWh, 0);
});

test("invalid inputs reject nonsensical budgets and speeds", () =>
{
    assert.throws(() => estimateMarswalk(-1), /nonnegative/);
    assert.throws(() => estimateMarswalk(Infinity), /nonnegative/);
    assert.throws(() => validateEvaAssumptions({ speedKmh: 0 }), /Invalid/);
    assert.throws(() => validateEvaAssumptions({ reservePercent: -10 }), /Invalid/);
    assert.throws(() => validateEvaAssumptions({ retraceReturn: "yes" }), /true or false/);
    assert.equal(DEFAULT_EVA_ASSUMPTIONS.reservePercent, 25);
});
