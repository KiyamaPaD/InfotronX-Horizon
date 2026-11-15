import test from "node:test";
import assert from "node:assert/strict";
import { COMPANIONS, supplyKit, pointOfNoReturn } from "../src/companions.js";
import { estimateMarswalk } from "../src/resources.js";

test("every companion idea says who it is, what it carries and when it helps", () =>
{
    assert.ok(COMPANIONS.length >= 5);

    for (const item of COMPANIONS)
    {
        assert.ok(item.name && item.role && item.carries && item.help, item.id);
        assert.ok(["concept", "real-analog"].includes(item.kind));
        if (item.kind === "real-analog") assert.ok(item.example, item.id + " needs its real example");
    }
});

test("the kit scales with the route and keeps the reserve", () =>
{
    const estimate = estimateMarswalk(4200);
    const kit = supplyKit(estimate);
    const oxygen = kit.find(item => item.id === "oxygen");
    // 0.45 kg needed, 25 % reserve: 0.45 / 0.75 = 0.6 kg.
    assert.equal(oxygen.amount, "0.60 kg");
    assert.equal(kit.find(item => item.id === "battery").amount, "1400 Wh");
    assert.ok(kit.length >= 10);
    assert.equal(supplyKit(estimateMarswalk(8400)).find(item => item.id === "oxygen").amount, "1.16 kg");
});

test("the point of no return follows the tightest allowance", () =>
{
    // 4.2 km route, defaults: budget min(6 h, 0.9/0.12 = 7.5 h, 1650/280 = 5.89 h) = 5.89 h.
    const estimate = estimateMarswalk(4200);
    const cumulative = [0, 1000, 2000, 3000, 4200];
    const result = pointOfNoReturn(cumulative, estimate);
    assert.ok(Math.abs(result.budgetHours - 1650 / 280) < 1e-9);
    // one way = (5.893 - 0.25) h * 2.4 km/h / 2 = 6.77 km, which is farther than the whole route.
    assert.equal(result.reachesEnd, true);

    const long = estimateMarswalk(12000);
    const far = pointOfNoReturn([0, 3000, 6000, 9000, 12000], long);
    assert.equal(far.reachesEnd, false);
    assert.ok(far.lastSafeIndex >= 0 && far.lastSafeIndex < 4);
});
