import test from "node:test";
import assert from "node:assert/strict";
import { MARKER_ICONS, normalizeMarkerIcon, spreadNearbyMarkers, edgeFadeMask } from "../src/marker-icons.js";

test("marker shape identifiers are validated", () =>
{
    assert.equal(MARKER_ICONS.length, 5);
    assert.equal(normalizeMarkerIcon("star"), "star");
    assert.equal(normalizeMarkerIcon("<script>"), "circle");
});

test("nearby icons separate while source screen coordinates remain unchanged", () =>
{
    const input = [{ x: 120, y: 220 }, { x: 123, y: 223 }];
    const original = structuredClone(input);
    const display = spreadNearbyMarkers(input);
    assert.deepEqual(input, original);
    assert.ok(Math.hypot(display[0].x - display[1].x, display[0].y - display[1].y) >= 40);
    assert.ok(display.every(point => point.shifted));
});

test("distant icons remain geographically aligned", () =>
{
    const input = [{ x: 10, y: 20 }, { x: 300, y: 400 }];
    assert.deepEqual(spreadNearbyMarkers(input), input.map(point => ({ ...point, shifted: false })));
});

test("edge masks fade the exterior but leave loaded neighbor edges solid", () =>
{
    const mask = edgeFadeMask(true, false, false, true);
    assert.match(mask, /transparent 0px/);
    assert.match(mask, /transparent 100%/);
    assert.doesNotMatch(edgeFadeMask(false, false, false, false), /transparent/);
});
