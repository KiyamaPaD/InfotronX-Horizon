import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { directionOf, ellipseRadius, latLonOf, parseGlb, positionGroups, subdivide, POLAR_RATIO } from "../src/planet-mesh.js";

const file = readFileSync(new URL("../assets/nasa/mars-3d-model.glb", import.meta.url));
const model = parseGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));

test("a real place and its direction on the model convert back to the same place", () =>
{
    for (const [lat, lon] of [[18.44, 77.45], [-42, 70], [0, 0], [-89, -179], [60, 130]])
    {
        const d = directionOf(lat, lon);
        const back = latLonOf(d.x, d.y, d.z);
        assert.ok(Math.abs(back.lat - lat) < 1e-9, `${lat},${lon} lat`);
        assert.ok(Math.abs(back.lon - lon) < 1e-9, `${lat},${lon} lon`);
    }
});

test("the flattened sphere is round at the equator and shorter at the poles", () =>
{
    assert.ok(Math.abs(ellipseRadius(1, 0, 0) - 1) < 1e-12);
    assert.ok(Math.abs(ellipseRadius(0, 1, 0) - POLAR_RATIO) < 1e-12);
});

test("the NASA model is read: a small sphere with two textures", () =>
{
    assert.equal(model.positions.length / 3, 2034);
    assert.equal(model.uvs.length / 2, 2034);
    assert.equal(model.indices.length, 9216);
    assert.equal(model.diffuse.type, "image/png");
    assert.equal(model.normal.type, "image/png");
    // PNG signature
    assert.deepEqual([...model.diffuse.bytes.slice(0, 4)], [0x89, 0x50, 0x4E, 0x47]);
});

test("subdividing keeps the shape: four times the triangles, every point at or just above the flattened sphere", () =>
{
    const scaled = model.positions.map(value => value / 500);
    const dense = subdivide(scaled, model.uvs, model.indices, 2);
    assert.equal(dense.indices.length, model.indices.length * 16);
    assert.equal(dense.uvs.length / 2, dense.positions.length / 3);

    for (let i = 0; i < dense.positions.length; i += 3 * 37)
    {
        const x = dense.positions[i], y = dense.positions[i + 1], z = dense.positions[i + 2];
        const length = Math.hypot(x, y, z);
        // The NASA vertices already carry real heights (up to 0.87% of the radius); added points sit on the smooth sphere.
        const height = length - ellipseRadius(x / length, y / length, z / length);
        assert.ok(height > -1e-6 && height < 0.0095, "point off the sphere: " + height);
    }

    for (const index of dense.indices) assert.ok(index < dense.positions.length / 3);
});

test("texture seams share positions so their normals can be averaged", () =>
{
    const scaled = model.positions.map(value => value / 500);
    const { group, count } = positionGroups(scaled);
    assert.ok(count < scaled.length / 3, "seam vertices should be duplicates of one another");
    assert.equal(group.length, scaled.length / 3);
});

test("known places land where the texture shows them", () =>
{
    // The texture is a cube map. In its equatorial strip the horizontal coordinate runs once round the planet.
    // Syrtis Major (about 8 N, 69 E) is the dark patch near u = 0.563, and Olympus Mons (18.65 N, 133.8 W) sits at the seam u = 0.
    const near = (u, v) =>
    {
        let best = null;

        for (let i = 0; i < model.uvs.length / 2; i++)
        {
            const distance = Math.hypot(model.uvs[i * 2] - u, model.uvs[i * 2 + 1] - v);
            if (!best || distance < best.distance) best = { distance, i };
        }

        const i = best.i;
        return latLonOf(model.positions[i * 3], model.positions[i * 3 + 1], model.positions[i * 3 + 2]);
    };

    const syrtis = near(0.563, 0.47);
    assert.ok(Math.abs(syrtis.lon - 69) < 8, "Syrtis longitude " + syrtis.lon);
    const seam = near(0.0, 0.47);
    assert.ok(Math.abs(seam.lon - -133.8) < 8, "seam longitude " + seam.lon);
});

import { equirectMesh } from "../src/planet-mesh.js";

test("the flat-map sphere faces outward and covers every place once", () =>
{
    const mesh = equirectMesh(32, 16);
    assert.equal(mesh.directions.length / 3, 33 * 17);
    let outward = 0, inward = 0;

    for (let t = 0; t < mesh.indices.length; t += 3 * 7)
    {
        const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]].map(i => [mesh.directions[i * 3], mesh.directions[i * 3 + 1], mesh.directions[i * 3 + 2]]);
        const edge1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], edge2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const normal = [edge1[1] * edge2[2] - edge1[2] * edge2[1], edge1[2] * edge2[0] - edge1[0] * edge2[2], edge1[0] * edge2[1] - edge1[1] * edge2[0]];
        const length = Math.hypot(...normal);

        if (length < 1e-9) continue;

        const dot = (normal[0] * (a[0] + b[0] + c[0]) + normal[1] * (a[1] + b[1] + c[1]) + normal[2] * (a[2] + b[2] + c[2])) / length;
        if (dot > 0) outward++; else inward++;
    }

    assert.ok(outward > 0 && inward === 0, `every face must look outward: ${outward} outward, ${inward} inward`);
    assert.ok(mesh.groupCount < mesh.directions.length / 3, "seam and pole vertices share positions");
    // the world's edge columns meet
    const left = latLonOf(mesh.directions[0], mesh.directions[1], mesh.directions[2]);
    assert.ok(Math.abs(left.lat - 90) < 1e-6);
});
