import test from "node:test";
import assert from "node:assert/strict";
import { toGeoJson } from "../src/share.js";
import { createMission } from "../src/store.js";

test("empty routes are omitted from GeoJSON features", () =>
{
    const mission = createMission("Empty");
    assert.equal(toGeoJson(mission).features.length, 0);
});

test("single waypoint exports a Point, not an invalid LineString", () =>
{
    const mission = createMission("Single");
    mission.routes[0].points = [{ lat: 18.44, lon: 77.45 }];
    const feature = toGeoJson(mission).features[0];
    assert.equal(feature.geometry.type, "Point");
    assert.deepEqual(feature.geometry.coordinates, [77.45, 18.44]);
});

test("a two-point planned route exports a LineString", () =>
{
    const mission = createMission("Route");
    mission.routes[0].points = [{ lat: 18.44, lon: 77.45 }, { lat: 18.45, lon: 77.46 }];
    const feature = toGeoJson(mission).features[0];
    assert.equal(feature.geometry.type, "LineString");
    assert.equal(feature.properties.body, "Mars");
    assert.match(toGeoJson(mission).properties.crsNote, /not WGS84/);
});
