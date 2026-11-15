import test from "node:test";
import assert from "node:assert/strict";
import { buildRouteGraph, drawRouteGraph } from "../src/route-graph.js";
import { marsDistance } from "../src/geo.js";

const routes = [{
    id: "route-a",
    name: "Science <script>alert(1)</script>",
    color: "#ec9976",
    points: [
        { id: "a", lat: 18.44, lon: 77.45, name: "Start" },
        { id: "b", lat: 18.445, lon: 77.457, name: "Mid" },
        { id: "c", lat: 18.45, lon: 77.467, name: "End" }
    ]
}];

test("route connectivity model uses actual Mars geodesic edge weights", () =>
{
    const graph = buildRouteGraph(routes, "route-a");
    assert.equal(graph.length, 1);
    assert.equal(graph[0].nodes.length, 3);
    assert.equal(graph[0].edges.length, 2);
    assert.equal(graph[0].edges[0].from, 0);
    assert.equal(graph[0].edges[0].to, 1);
    assert.equal(graph[0].edges[0].distanceMeters, marsDistance(routes[0].points[0], routes[0].points[1]));
    assert.ok(graph[0].distanceMeters > graph[0].edges[0].distanceMeters);
    assert.equal(graph[0].active, true);
});

test("abstract route graph escapes user-entered labels and never shows fabricated route data", () =>
{
    const target = { innerHTML: "" };
    drawRouteGraph(target, routes, "route-a");
    assert.match(target.innerHTML, /route connectivity graph/i);
    assert.match(target.innerHTML, /&lt;script&gt;/);
    assert.doesNotMatch(target.innerHTML, /<script>/);
    assert.match(target.innerHTML, /NOT to geographic scale/);
    assert.match(target.innerHTML, /<line /);
    assert.match(target.innerHTML, /<circle /);
    drawRouteGraph(target, [{ id: "none", points: [], name: "Empty" }], "none");
    assert.match(target.innerHTML, /Place two waypoints/);
});

test("invalid map colors fall back to a safe CSS hex string", () =>
{
    const graph = buildRouteGraph([{ ...routes[0], color: 'red" onload="x' }], "route-a");
    assert.equal(graph[0].color, "#ec9976");
});
