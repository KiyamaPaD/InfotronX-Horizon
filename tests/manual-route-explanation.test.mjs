import test from "node:test";
import assert from "node:assert/strict";
import { explainManualDistanceRoutes } from "../src/analytics.js";

const a = { lat: 18.440, lon: 77.450 };
const b = { lat: 18.446, lon: 77.460 };
const detour = { lat: 18.445, lon: 77.445 };

test("manual distance advice requires two user-authored routes", () =>
{
    assert.equal(explainManualDistanceRoutes([]).status, "insufficient");
    assert.equal(explainManualDistanceRoutes([{ id: "one", points: [a, b] }]).comparable, false);
});

test("routes with unrelated endpoints cannot be called optimal alternatives", () =>
{
    const result = explainManualDistanceRoutes([
        { id: "one", name: "A", points: [a, b] },
        { id: "two", name: "Other objective", points: [a, detour] }
    ]);

    assert.equal(result.comparable, false);
    assert.equal(result.status, "different-endpoints");
    assert.match(result.explanation, /no shortest-route recommendation/i);
});

test("common endpoints permit only a shortest-polyline claim", () =>
{
    const result = explainManualDistanceRoutes([
        { id: "direct", name: "Direct", points: [a, b] },
        { id: "detour", name: "Detour", points: [a, detour, b] }
    ]);

    assert.equal(result.comparable, true);
    assert.equal(result.status, "shortest");
    assert.deepEqual(result.winnerIds, ["direct"]);
    assert.match(result.explanation, /distance-only comparison/i);
    assert.match(result.explanation, /not a DEM traverse/i);
});

test("routes with identical geometry receive tied distance rankings", () =>
{
    const result = explainManualDistanceRoutes([
        { id: "first", name: "Same one", points: [a, b] },
        { id: "second", name: "Same two", points: [a, b] }
    ]);

    assert.equal(result.status, "tie");
    assert.deepEqual(result.winnerIds, ["first","second"]);
});
