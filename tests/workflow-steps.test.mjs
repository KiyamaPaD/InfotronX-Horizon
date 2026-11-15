import test from "node:test";
import assert from "node:assert/strict";
import { nextStepFor } from "../src/workflow-steps.js";

test("the first waypoint moves Explore to Plan automatically", () =>
{
    assert.equal(nextStepFor("explore", 0), "explore");
    assert.equal(nextStepFor("explore", 1), "plan");
});

test("automation never overrides a step the user chose", () =>
{
    assert.equal(nextStepFor("plan", 5), "plan");
    assert.equal(nextStepFor("analyze", 0), "analyze");
    assert.equal(nextStepFor("all", 3), "all");
});
