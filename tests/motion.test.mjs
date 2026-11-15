import test from "node:test";
import assert from "node:assert/strict";
import { animateNumber, easeOutCubic } from "../src/motion.js";

test("easing starts at 0, ends at 1 and never overshoots", () =>
{
    assert.equal(easeOutCubic(0), 0);
    assert.equal(easeOutCubic(1), 1);
    for (let t = 0; t <= 1; t += 0.1) assert.ok(easeOutCubic(t) >= 0 && easeOutCubic(t) <= 1);
});

test("without animation frames the final value is written immediately", () =>
{
    const element = { dataset: {}, textContent: "" };
    animateNumber(element, 1750, value => Math.round(value) + " m");
    assert.equal(element.textContent, "1750 m");
    animateNumber(element, 2000, value => Math.round(value) + " m");
    assert.equal(element.textContent, "2000 m");
});
