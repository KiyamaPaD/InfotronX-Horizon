import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDem, gridCoordinate } from "../src/terrain.js";
import { buildTerrainMesh, terrainPointMarkers } from "../src/terrain-3d.js";

const input = rows => validateDem({ width: 3, height: 3, north: 18.45, west: 77.45,
    latStep: 0.0003, lonStep: 0.0003, source: "User supplied numeric test grid",
    elevations: rows });

test("3D mesh encodes exact samples from DEM and valid numeric physical bounds", () =>
{
    const dem = input([-12,-10,-9,-11,-8,-7,-12,-10,-6]);
    const mesh = buildTerrainMesh(dem);
    assert.equal(mesh.vertexData.length, 3 * 3 * 6);
    assert.equal(mesh.triangleCount, 8);
    assert.equal(mesh.minElevation, -12);
    assert.equal(mesh.maxElevation, -6);
    assert.ok(mesh.widthMeters > 0);
    assert.ok(mesh.heightMeters > 0);
    assert.ok(mesh.vertexData.every(Number.isFinite));
});

test("NoData creates a genuine hole, never an interpolated fake triangle", () =>
{
    const dem = input([1,2,3,4,null,6,7,8,9]);
    const mesh = buildTerrainMesh(dem);
    assert.equal(mesh.cellCount, 8);
    assert.equal(mesh.triangleCount, 2);
    assert.ok(!Array.from(mesh.triangles).includes(4));
});

test("3D waypoint overlay snaps only points supported by the numeric DEM", () =>
{
    const dem = input([1,2,3,4,5,6,7,8,9]);
    const mesh = buildTerrainMesh(dem);
    const points = [gridCoordinate(dem,1,1),{lat:1,lon:2},gridCoordinate(dem,0,0)];
    const markers = terrainPointMarkers(dem, mesh, points);
    assert.equal(markers.length, 12);
    assert.deepEqual(Array.from(markers.slice(3,6)).map(x=>Math.round(x*100)/100),[1,0.7,0.34]);
});

test("3D surface exposes honest provenance labels and WebGL fallback", () =>
{
    const src = readFileSync(new URL("../src/terrain-3d-ui.js", import.meta.url),"utf8");
    assert.match(src,/Real numeric|numeric terrain|numeric Martian/i);
    assert.match(src,/WebGL unavailable/);
    assert.match(src,/missing samples|Missing samples/i);
    assert.match(src,/not a safe-traverse|Not a safe-traverse/i);
});
