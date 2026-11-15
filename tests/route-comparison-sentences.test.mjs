import test from "node:test";
import assert from "node:assert/strict";
import { compareAlternatives } from "../src/route-decision.js";

const decision = {
    winners: ["a"],
    alternatives: [
        { id: "a", label: "Route A", distanceMeters: 1000, verticalMeters: 80, maxGradePercent: 18 },
        { id: "b", label: "Route B", distanceMeters: 1320, verticalMeters: 50, maxGradePercent: 9 },
        { id: "c", label: "Route C", distanceMeters: 1000.2, verticalMeters: 80, maxGradePercent: 18 }
    ]
};

test("comparison sentences use the real differences against the selected route", () =>
{
    const [b, c] = compareAlternatives(decision);
    assert.equal(b, "Route B is 320 m longer than Route A; maximum grade drops from 18.0% to 9.0%; 30 m less total climb and descent.");
    assert.equal(c, "Route C is the same length as Route A.");
});

test("no selected route gives no sentences", () =>
{
    assert.deepEqual(compareAlternatives({ winners: [], alternatives: [] }), []);
});
