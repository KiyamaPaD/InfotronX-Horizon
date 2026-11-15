import test from "node:test";
import assert from "node:assert/strict";
import { MARS_RADIUS_METERS } from "../src/constants.js";
import { marsDistance, isValidCoordinate } from "../src/geo.js";
import { calculateGrade, gridCoordinate, findTerrainPath, makeExclusionMask, validateDem } from "../src/terrain.js";

function grid(width, height, heights)
{
    return validateDem({ width, height, north: 18.46, west: 77.43, latStep: 0.0005,
        lonStep: 0.0005, elevations: heights, source: "Synthetic oracle test — NOT NASA" });
}

// Independent Dijkstra reference: quadratic-array selection; never uses the A* heap or heuristic.
function dijkstraOracle(dem, start, end, maxSlopePercent, slopePenalty, zones = [])
{
    const count = dem.width * dem.height;
    const distances = Array(count).fill(Infinity);
    const visited = new Set();
    const excluded = makeExclusionMask(dem, zones);
    const coords = Array.from({ length: count }, (_, index) => gridCoordinate(dem,
        Math.floor(index / dem.width), index % dem.width));
    const allowed = id => dem.elevations[id] !== null && !excluded[id];
    const source = start.row * dem.width + start.column;
    const destination = end.row * dem.width + end.column;

    if (!allowed(source) || !allowed(destination))
    {
        return Infinity;
    }

    distances[source] = 0;

    for (let loop = 0; loop < count; loop++)
    {
        let current = -1;

        for (let index = 0; index < count; index++)
        {
            if (!visited.has(index) && (current < 0 || distances[index] < distances[current]))
            {
                current = index;
            }
        }

        if (current < 0 || !Number.isFinite(distances[current]))
        {
            return Infinity;
        }

        if (current === destination)
        {
            return distances[current];
        }

        visited.add(current);
        const row = Math.floor(current / dem.width);
        const column = current % dem.width;

        for (let dr = -1; dr <= 1; dr++)
        {
            for (let dc = -1; dc <= 1; dc++)
            {
                if (dr === 0 && dc === 0)
                {
                    continue;
                }

                const nr = row + dr, nc = column + dc;

                if (nr < 0 || nc < 0 || nr >= dem.height || nc >= dem.width)
                {
                    continue;
                }

                const next = nr * dem.width + nc;

                if (!allowed(next) || visited.has(next))
                {
                    continue;
                }

                if (dr && dc && (!allowed(row * dem.width + nc) || !allowed(nr * dem.width + column)))
                {
                    continue;
                }

                const step = marsDistance(coords[current], coords[next]);
                const grade = calculateGrade(dem.elevations[current], dem.elevations[next], step);

                if (grade === null || Math.abs(grade) > maxSlopePercent)
                {
                    continue;
                }

                const cost = distances[current] + step + slopePenalty * Math.abs(dem.elevations[next] - dem.elevations[current]);
                distances[next] = Math.min(distances[next], cost);
            }
        }
    }

    return Infinity;
}

test("Mars great-circle distances use the declared reference radius and symmetric geometry", () =>
{
    assert.equal(isValidCoordinate({ lat: 0, lon: 180 }), true);
    const oneDegree = MARS_RADIUS_METERS * Math.PI / 180;
    assert.ok(Math.abs(marsDistance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - oneDegree) < 1e-6);
    assert.ok(Math.abs(marsDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }) - Math.PI * MARS_RADIUS_METERS) < 1e-6);
    const a = { lat: 18.44, lon: 77.45 }, b = { lat: 18.451, lon: 77.48 }, c = { lat: 18.462, lon: 77.50 };
    assert.ok(Math.abs(marsDistance(a, b) - marsDistance(b, a)) < 1e-6);
    assert.ok(marsDistance(a, c) <= marsDistance(a, b) + marsDistance(b, c) + 1e-6);
    assert.equal(marsDistance(a, a), 0);
});

test("A* cost equals Dijkstra oracle across 48 synthetic cases and three preferences", () =>
{
    for (let seed = 1; seed <= 48; seed++)
    {
        const width = 6, height = 6;
        const heights = Array.from({ length: width * height }, (_, index) =>
        {
            const row = Math.floor(index / width);
            const column = index % width;
            const value = (row * 23 + column * 19 + seed * 29) % 11;
            return (value === 0 && (row + column + seed) % 3 === 0) ? null : value * 0.6;
        });
        heights[0] = 0;
        heights[height * width - 1] = 0;
        const dem = grid(width, height, heights);
        const start = { row: 0, column: 0 }, end = { row: height - 1, column: width - 1 };
        const pointA = gridCoordinate(dem, start.row, start.column);
        const pointB = gridCoordinate(dem, end.row, end.column);
        const maxSlopePercent = seed % 2 === 0 ? 10 : 25;

        for (const slopePenalty of [0, 6, 24])
        {
            const expected = dijkstraOracle(dem, start, end, maxSlopePercent, slopePenalty);
            const actual = findTerrainPath(dem, pointA, pointB, { maxSlopePercent, slopePenalty });

            if (!Number.isFinite(expected))
            {
                assert.equal(actual.ok, false, "A* should reject unreachable synthetic case " + seed);
                continue;
            }

            assert.equal(actual.ok, true, "A* should reach the same destination as Dijkstra, seed " + seed);
            assert.ok(Math.abs(actual.costMeters - expected) <= Math.max(1e-6, expected * 1e-9),
                "A* must match independent Dijkstra model cost for seed " + seed + ", λ=" + slopePenalty +
                ", A*: " + actual.costMeters + " Dijkstra: " + expected);
            const reconstructed = actual.distanceMeters + slopePenalty * (actual.ascentMeters + actual.descentMeters);
            assert.ok(Math.abs(actual.costMeters - reconstructed) < 1e-6);
            assert.ok(actual.maxGradePercent <= maxSlopePercent + 1e-9);
        }
    }
});

test("Dijkstra oracle validates A* avoidance of hypothetical exclusion zones", () =>
{
    const dem = grid(7, 7, Array(49).fill(0));
    const start = gridCoordinate(dem, 3, 0), end = gridCoordinate(dem, 3, 6);
    const zone = { ...gridCoordinate(dem, 3, 3), radiusMeters: 39 };
    const expected = dijkstraOracle(dem, { row: 3, column: 0 }, { row: 3, column: 6 }, 18, 6, [zone]);
    const actual = findTerrainPath(dem, start, end, { exclusionZones: [zone], maxSlopePercent: 18, slopePenalty: 6 });
    assert.ok(Number.isFinite(expected));
    assert.equal(actual.ok, true);
    assert.ok(Math.abs(actual.costMeters - expected) < 1e-6);
    const excluded = makeExclusionMask(dem, [zone]);
    assert.ok(actual.cells.every(id => !excluded[id]));
});
