import test from "node:test";
import assert from "node:assert/strict";
import { isValidCoordinate, marsDistance, project, unproject } from "../src/geo.js";
import { MARS_RADIUS_METERS } from "../src/constants.js";
import { measureRouteChange } from "../src/mission-scenarios.js";

const A = { lat: 18.4446, lon: 77.4509 };
const B = { lat: 18.4520, lon: 77.4620 };
const C = { lat: 18.4640, lon: 77.4710 };

test("Mars distances are symmetric and obey the triangle inequality", () =>
{
    const ab = marsDistance(A, B);
    const ba = marsDistance(B, A);
    const ac = marsDistance(A, C);
    const bc = marsDistance(B, C);

    assert.ok(ab > 0 && ac > 0 && bc > 0);
    assert.ok(Math.abs(ab - ba) < 1e-8);
    assert.ok(ac <= ab + bc + 1e-7);
    assert.ok(ab <= ac + bc + 1e-7);
});

test("one degree of latitude agrees with Mars sphere circumference", () =>
{
    const expected = MARS_RADIUS_METERS * Math.PI / 180;
    const actual = marsDistance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });

    assert.ok(Math.abs(actual - expected) < 1e-7);
});

test("mapping and inverse mapping retain Jezero coordinates at every supported zoom", () =>
{
    for (let z = 3; z <= 11; z++)
    {
        for (const point of [A, B, C])
        {
            const recovered = unproject(project(point, z), z);
            assert.ok(Math.abs(recovered.lat - point.lat) < 1e-10);
            assert.ok(Math.abs(recovered.lon - point.lon) < 1e-10);
        }
    }
});

test("route comparison is symmetric in distance difference", () =>
{
    const first = [A, B, C];
    const second = [A, { lat: 18.4400, lon: 77.4600 }, C];
    const forward = measureRouteChange(first, second);
    const backward = measureRouteChange(second, first);

    assert.ok(Number.isFinite(forward.referenceMeters));
    assert.ok(Number.isFinite(forward.candidateMeters));
    assert.ok(Math.abs(forward.differenceMeters + backward.differenceMeters) < 1e-7);
    assert.equal(forward.referenceMeters, backward.candidateMeters);
    assert.equal(forward.candidateMeters, backward.referenceMeters);
});

test("route comparison refuses invalid coordinates rather than reporting zero distance", () =>
{
    const invalid = [
        { lat: 99, lon: 77.45 },
        { lat: 18.44, lon: 181 },
        { lat: NaN, lon: 77.45 },
        { lat: 18.44 },
        null
    ];

    for (const point of invalid)
    {
        assert.equal(isValidCoordinate(point), false);
        assert.throws(() => measureRouteChange([A, point], [A, B]), /valid Martian coordinates/);
        assert.throws(() => measureRouteChange([A, B], [A, point]), /valid Martian coordinates/);
    }
});

test("route comparison requires actual two-point routes", () =>
{
    for (const bad of [[], [A], null, "not a route"])
    {
        assert.throws(() => measureRouteChange(bad, [A, B]), /two or more valid/);
        assert.throws(() => measureRouteChange([A, B], bad), /two or more valid/);
    }
});

test("identical valid routes have zero distance change and zero percentage change", () =>
{
    const result = measureRouteChange([A, B], [A, B]);
    assert.equal(result.differenceMeters, 0);
    assert.equal(result.differencePercent, 0);
});
