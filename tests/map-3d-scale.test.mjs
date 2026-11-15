import test from "node:test";
import assert from "node:assert/strict";
import { molaGreyToMeters, pointsInside } from "../src/map-3d.js";

test("MOLA 8-bit grey maps the global Mars range linearly", () =>
{
    assert.equal(molaGreyToMeters(0), -8201);
    assert.ok(Math.abs(molaGreyToMeters(255) - 21229) < 1e-6);
});

test("the Jezero floor grey level matches the independent USGS CTX clip (~-2,500 m)", () =>
{
    const meters = molaGreyToMeters(49);
    assert.ok(meters > -2650 && meters < -2450, String(meters));
});

test("only points inside the 3D area are draped", () =>
{
    const bounds = { north: 18.9, south: 18.0, west: 77.0, east: 77.9 };
    assert.deepEqual(pointsInside(bounds, [{ lat: 18.4, lon: 77.4 }, { lat: 19.2, lon: 77.4 }]), [{ lat: 18.4, lon: 77.4 }]);
});
