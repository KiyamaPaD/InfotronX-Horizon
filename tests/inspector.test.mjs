import test from "node:test";
import assert from "node:assert/strict";
import { JEZERO } from "../src/constants.js";
import { distanceToRoute, inspectRoute } from "../src/inspector.js";

const start = { lat: 18.4446, lon: 77.4509 };
const end = { lat: 18.4556, lon: 77.4609 };

test("incomplete routes are flagged without claiming safety", () =>
{
    const result = inspectRoute({ points: [start] });
    assert.equal(result.complete, false);
    assert.equal(result.evidenceValidated, false);
    assert.ok(result.findings.some(finding => finding.title === "Route is incomplete"));
});

test("repeated consecutive points are reported", () =>
{
    const result = inspectRoute({ points: [start, { ...start }, end] });
    assert.equal(result.duplicateCount, 1);
});

test("unverified long gaps are reported as heuristics", () =>
{
    const result = inspectRoute({ points: [start, { lat: 18.5446, lon: 77.4509 }] });
    assert.equal(result.longSegmentCount, 1);
    assert.ok(result.findings.some(finding => finding.detail.includes("not a NASA safety limit")));
});

test("point-to-route distance is zero for a point on the route", () =>
{
    assert.ok(distanceToRoute(start, [start, end]) < 0.01);
});

test("nearby notes are included and remote notes excluded", () =>
{
    const observations = [
        { id: "a", title: "Near start", lat: JEZERO.lat, lon: JEZERO.lon },
        { id: "b", title: "Far away", lat: 19.0, lon: 80.0 }
    ];
    const result = inspectRoute({ points: [start, end] }, observations);
    assert.deepEqual(result.nearby.map(entry => entry.observation.id), ["a"]);
});

test("Jezero study-area notice is about scope, not hazard", () =>
{
    const result = inspectRoute({ points: [start, { lat: 20.0, lon: 77.45 }] });
    assert.ok(result.findings.some(finding => finding.title === "Outside local study area"));
});
