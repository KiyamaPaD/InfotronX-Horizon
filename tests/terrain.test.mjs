import test from "node:test";
import assert from "node:assert/strict";
import { calculateGrade, findTerrainPath, gridCoordinate, planRouteOnDem, profileRouteOnDem, sampleElevation, validateDem } from "../src/terrain.js";

function grid(width, height, elevations, extra = {})
{
    return validateDem({ width, height, north: 18.46, west: 77.43, latStep: 0.0005, lonStep: 0.0005, elevations, source: "TEST ONLY · synthetic elevation fixture", ...extra });
}

test("DEM validation rejects missing or fabricated numeric fields", () =>
{
    assert.throws(() => validateDem(null), /object/);
    assert.throws(() => grid(2, 2, [1, 2]), /row-major/);
    assert.throws(() => grid(2, 2, [1, NaN, 2, 3]), /invalid elevations/);
    assert.throws(() => grid(2, 2, [null, null, null, null]), /no usable/);
    assert.throws(() => grid(2, 2, [0, 1, 2, 3], { source: "" }), /source/);
    assert.throws(() => grid(2, 2, [0, 1, 2, 3], { west: 179.99, lonStep: 1 }), /outside/);
});

test("DEM grid cell positions preserve geographic axes and meters", () =>
{
    const dem = grid(3, 3, Array(9).fill(-2200));
    assert.deepEqual(gridCoordinate(dem, 0, 0), { lat: 18.46, lon: 77.43 });
    assert.equal(sampleElevation(dem, gridCoordinate(dem, 1, 2)), -2200);
    assert.equal(sampleElevation(dem, { lat: 15, lon: 77.43 }), null);
    assert.equal(calculateGrade(100, 110, 100), 10);
    assert.equal(calculateGrade(110, 100, 100), -10);
    assert.equal(calculateGrade(0, 10, 0), null);
});

test("A* traverses flat DEM near the geodesic shortest distance", () =>
{
    const dem = grid(9, 9, Array(81).fill(-2000));
    const result = findTerrainPath(dem, gridCoordinate(dem, 0, 0), gridCoordinate(dem, 8, 8));
    assert.equal(result.ok, true);
    assert.equal(result.cells[0], 0);
    assert.equal(result.cells.at(-1), 80);
    assert.equal(result.maxGradePercent, 0);
    assert.equal(result.ascentMeters, 0);
    assert.ok(result.distanceMeters > 310 && result.distanceMeters < 350);
    assert.equal(result.simplifiedCells.length, 2);
});

test("A* walks around NoData barriers instead of cutting through missing elevation", () =>
{
    const heights = Array(35).fill(0);

    for (let row = 0; row < 5; row++)
    {
        if (row !== 4)
        {
            heights[row * 7 + 3] = null;
        }
    }

    const dem = grid(7, 5, heights);
    const result = findTerrainPath(dem, gridCoordinate(dem, 0, 0), gridCoordinate(dem, 0, 6));
    assert.equal(result.ok, true);
    assert.ok(result.cells.some(cell => Math.floor(cell / 7) === 4));
    assert.ok(result.cells.every(cell => heights[cell] !== null));
});

test("A* refuses unreachable destinations and diagonal corner cutting", () =>
{
    const dem = grid(3, 3, [0, null, 0, null, 0, 0, 0, 0, 0]);
    const result = findTerrainPath(dem, gridCoordinate(dem, 0, 0), gridCoordinate(dem, 2, 2));
    assert.equal(result.ok, false);
    assert.match(result.reason, /No connected path/);
});

test("A* rejects steep links and responds to configurable penalties", () =>
{
    const dem = grid(3, 3, [0, 25, 0, 0, 25, 0, 0, 0, 0]);
    const direct = findTerrainPath(dem, gridCoordinate(dem, 0, 0), gridCoordinate(dem, 0, 2), { maxSlopePercent: 10 });
    assert.equal(direct.ok, true);
    assert.ok(direct.cells.some(cell => Math.floor(cell / 3) === 2));
    assert.ok(direct.maxGradePercent <= 10);
    assert.throws(() => findTerrainPath(dem, gridCoordinate(dem, 0, 0), gridCoordinate(dem, 1, 1), { maxSlopePercent: -5 }), /Invalid/);
});

test("DEM route planning respects each user waypoint, not just first/last", () =>
{
    const dem = grid(7, 7, Array(49).fill(0));
    const points = [gridCoordinate(dem, 0, 0), gridCoordinate(dem, 6, 0), gridCoordinate(dem, 6, 6)];
    const result = planRouteOnDem(dem, points);
    assert.equal(result.ok, true);
    assert.equal(result.points[0].lat, points[0].lat);
    assert.equal(result.points.at(-1).lon, points[2].lon);
    assert.ok(result.points.some(p => p.lat === points[1].lat && p.lon === points[1].lon));
    assert.ok(result.stats.distanceMeters > 0);
});

test("straight-line intermediate user waypoint remains a routing anchor", () =>
{
    const dem = grid(9, 3, Array(27).fill(0));
    const points = [gridCoordinate(dem, 1, 0), gridCoordinate(dem, 1, 4), gridCoordinate(dem, 1, 8)];
    const result = planRouteOnDem(dem, points);
    assert.equal(result.ok, true);
    assert.equal(result.points.length, 3);
    assert.deepEqual(result.points[1].lon, points[1].lon);
});

test("DEM planning does not silently oversimplify paths over limits", () =>
{
    const dem = grid(7, 7, Array(49).fill(0));
    const result = planRouteOnDem(dem, [gridCoordinate(dem, 0, 0), gridCoordinate(dem, 6, 0), gridCoordinate(dem, 6, 6)], { maxWaypoints: 2 });
    assert.equal(result.ok, false);
    assert.match(result.reason, /will not cut across unchecked cells/);
});

test("DEM profile labels missing coverage honestly", () =>
{
    const dem = grid(4, 3, [10, 11, null, 13, 10, 12, null, 14, 10, 13, null, 15]);
    const route = [gridCoordinate(dem, 1, 0), gridCoordinate(dem, 1, 3)];
    const p = profileRouteOnDem(dem, route);
    assert.equal(p.complete, false);
    assert.ok(p.samples.length > 2);
    assert.ok(p.samples.some(x => x.elevationMeters === null));
    assert.ok(p.knownCount < p.samples.length);
});
