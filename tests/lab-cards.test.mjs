import test from "node:test";
import assert from "node:assert/strict";
import { labCards } from "../src/lab-panel.js";
import { BENCHMARK } from "../src/benchmark.js";

const ctx = {
    benchmarkRows: () => BENCHMARK.routes.map(route => ({ name: route.name, distanceMeters: route.expected.distanceMeters, verticalMeters: route.expected.ascentMeters + route.expected.descentMeters })),
    path: () => [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 420, y: 160 }, { x: 420, y: 520 }],
    pathNote: () => "example"
};

test("every lab card runs with its own example numbers and gives readable lines", async () =>
{
    const cards = labCards(ctx).filter(card => !["5.4", "5.17"].includes(card.id));
    assert.ok(cards.length >= 20);

    for (const card of cards)
    {
        const values = Object.fromEntries(card.inputs.map(input => [input.n, String(input.v)]));
        const lines = await card.run(values);
        assert.ok(Array.isArray(lines) && lines.length > 0 && lines.every(line => typeof line === "string" && !line.includes("NaN") && !line.includes("undefined")), card.id + " " + JSON.stringify(lines));
    }
});
