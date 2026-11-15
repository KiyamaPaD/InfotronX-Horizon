import test from "node:test";
import assert from "node:assert/strict";
import { PHASES } from "../src/qa-checklist-data.js";

test("the checklist has at most five phases and unique, complete items", () =>
{
    assert.ok(PHASES.length <= 5);
    const ids = new Set();

    for (const phase of PHASES)
    {
        for (const item of phase.items)
        {
            assert.ok(!ids.has(item.id), "duplicate id " + item.id);
            ids.add(item.id);
            assert.ok(["yes", "partly", "no"].includes(item.built), item.id);
            assert.ok(item.text.length > 10, item.id);
            if (item.built !== "no") assert.ok(item.test, item.id + " is built, so it needs a way to test it");
        }
    }

    assert.ok(ids.size >= 80);
});
