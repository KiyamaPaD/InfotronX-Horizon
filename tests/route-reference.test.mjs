import test from "node:test";
import assert from "node:assert/strict";
import { MARS_RADIUS_METERS } from "../src/constants.js";
import { marsDistance } from "../src/geo.js";
import { findTerrainPath, gridCoordinate, validateDem } from "../src/terrain.js";
import { DStarLite } from "../src/dstar-lite.js";
import { paretoTerrainRoutes } from "../src/pareto-routes.js";

const STEPS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
];

function seededRandom(seed)
{
    let state = seed >>> 0;

    return () =>
    {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function fixture(seed, width = 7, height = 7)
{
    const random = seededRandom(seed);
    const heights = Array.from({ length: width * height }, () =>
        random() < 0.09 ? null : Math.round(random() * 38) / 10);
    heights[0] = 0;
    heights[heights.length - 1] = 0;

    return validateDem({
        width, height, north: 18.470, west: 77.440,
        latStep: 0.0003, lonStep: 0.0003, elevations: heights,
        source: "Independent deterministic synthetic DEM; no NASA claim"
    });
}

function position(dem, index)
{
    return {
        lat: dem.north - Math.floor(index / dem.width) * dem.latStep,
        lon: dem.west + index % dem.width * dem.lonStep
    };
}

function independentEdges(dem, index, blocked, limit)
{
    const row = Math.floor(index / dem.width);
    const col = index % dem.width;
    const result = [];

    for (const [dr, dc] of STEPS)
    {
        const r = row + dr;
        const c = col + dc;

        if (r < 0 || r >= dem.height || c < 0 || c >= dem.width)
        {
            continue;
        }

        const to = r * dem.width + c;

        if (blocked.has(to) || dem.elevations[to] === null)
        {
            continue;
        }

        if (dr && dc)
        {
            const sideA = row * dem.width + c;
            const sideB = r * dem.width + col;

            if (blocked.has(sideA) || blocked.has(sideB)
                || dem.elevations[sideA] === null || dem.elevations[sideB] === null)
            {
                continue;
            }
        }

        const distance = marsDistance(position(dem, index), position(dem, to));
        const rise = dem.elevations[to] - dem.elevations[index];

        if (Math.abs(rise) * 100 / distance > limit)
        {
            continue;
        }

        result.push({ to, distance, rise });
    }

    return result;
}

function blockedCells(dem, zones)
{
    const blocked = new Set();

    for (let index = 0; index < dem.width * dem.height; index++)
    {
        const point = position(dem, index);

        if (zones.some(zone => marsDistance(zone, point) <= zone.radiusMeters))
        {
            blocked.add(index);
        }
    }

    return blocked;
}

function referenceDijkstra(dem, start, goal, options)
{
    const size = dem.width * dem.height;
    const zones = options.exclusionZones ?? [];
    const blocked = blockedCells(dem, zones);
    const costs = Array(size).fill(Infinity);
    const seen = new Set();

    if (blocked.has(start) || blocked.has(goal)
        || dem.elevations[start] === null || dem.elevations[goal] === null)
    {
        return Infinity;
    }

    costs[start] = 0;

    for (let step = 0; step < size; step++)
    {
        let current = -1;

        for (let i = 0; i < size; i++)
        {
            if (!seen.has(i) && (current < 0 || costs[i] < costs[current]))
            {
                current = i;
            }
        }

        if (current < 0 || !Number.isFinite(costs[current]))
        {
            break;
        }

        if (current === goal)
        {
            return costs[current];
        }

        seen.add(current);

        for (const edge of independentEdges(dem, current, blocked, options.maxSlopePercent))
        {
            const cost = costs[current] + edge.distance + options.slopePenalty * Math.abs(edge.rise);
            costs[edge.to] = Math.min(costs[edge.to], cost);
        }
    }

    return costs[goal];
}

function certifyPath(dem, cells, options)
{
    const blocked = blockedCells(dem, options.exclusionZones ?? []);
    let cost = 0;

    for (let i = 1; i < cells.length; i++)
    {
        const edge = independentEdges(dem, cells[i - 1], blocked, options.maxSlopePercent)
            .find(item => item.to === cells[i]);

        assert.ok(edge, "Reported route must use legal, connected DEM edges");
        cost += edge.distance + options.slopePenalty * Math.abs(edge.rise);
    }

    return cost;
}

test("A* matches independent zero-heuristic Dijkstra over varied deterministic terrains", () =>
{
    let checked = 0;

    for (let seed = 1; seed <= 20; seed++)
    {
        const dem = fixture(seed);
        const start = 0, goal = dem.elevations.length - 1;
        const a = position(dem, start), b = position(dem, goal);

        for (const penalty of [0, 4, 16])
        {
            const settings = { maxSlopePercent: 18, slopePenalty: penalty };
            const reference = referenceDijkstra(dem, start, goal, settings);
            const actual = findTerrainPath(dem, a, b, settings);

            assert.equal(actual.ok, Number.isFinite(reference), "seed=" + seed + ", penalty=" + penalty);

            if (actual.ok)
            {
                assert.ok(Math.abs(actual.costMeters - reference) < 1e-5, "A* did not return the optimum");
                assert.ok(Math.abs(certifyPath(dem, actual.cells, settings) - reference) < 1e-5);
                assert.equal(actual.cells[0], start);
                assert.equal(actual.cells.at(-1), goal);
            }

            checked++;
        }
    }

    assert.equal(checked, 60);
});

test("D* Lite matches independent Dijkstra as user-authored exclusions change", () =>
{
    let checked = 0;

    for (let seed = 1; seed <= 12; seed++)
    {
        const dem = fixture(seed + 100);
        const start = 0, goal = dem.elevations.length - 1;
        const settings = { maxSlopePercent: 22, slopePenalty: 5 };
        const planner = new DStarLite(dem, position(dem, start), position(dem, goal), settings);
        const center = position(dem, Math.floor(dem.height / 2) * dem.width + Math.floor(dem.width / 2));
        const zones = [[], [{ ...center, radiusMeters: 9 }], []];

        for (let phase = 0; phase < zones.length; phase++)
        {
            if (phase)
            {
                planner.updateExclusions(zones[phase]);
            }

            const reference = referenceDijkstra(dem, start, goal, { ...settings, exclusionZones: zones[phase] });
            const actual = planner.compute();

            assert.equal(actual.ok, Number.isFinite(reference), "seed=" + seed + ", phase=" + phase);

            if (actual.ok)
            {
                assert.ok(Math.abs(actual.costMeters - reference) < 1e-5);
                assert.ok(Math.abs(certifyPath(dem, actual.cells, { ...settings, exclusionZones: zones[phase] }) - reference) < 1e-5);
            }

            checked++;
        }
    }

    assert.equal(checked, 36);
});

test("slope edge weight is distance plus ascent-and-descent penalty in meters", () =>
{
    const dem = fixture(17);
    const options = { maxSlopePercent: 100, slopePenalty: 9 };
    const cells = [0, 1];
    const distance = marsDistance(position(dem, 0), position(dem, 1));
    const difference = Math.abs(dem.elevations[1] - dem.elevations[0]);
    assert.ok(Math.abs(certifyPath(dem, cells, options) - (distance + 9 * difference)) < 1e-8);
});

test("Mars spherical distance uses its actual planet radius, not the Earth radius", () =>
{
    const quarterCircle = marsDistance({ lat: 0, lon: 0 }, { lat: 90, lon: 0 });
    assert.ok(Math.abs(quarterCircle - Math.PI * MARS_RADIUS_METERS / 2) < 1e-6);
});

function exhaustivePareto(dem, start, goal)
{
    const results = [];
    const visited = new Set([start]);
    const blocked = new Set();

    function visit(at, distance, ascent)
    {
        if (at === goal)
        {
            results.push({ distance, ascent });
            return;
        }

        for (const edge of independentEdges(dem, at, blocked, 100))
        {
            if (visited.has(edge.to))
            {
                continue;
            }

            visited.add(edge.to);
            visit(edge.to, distance + edge.distance, ascent + Math.max(0, edge.rise));
            visited.delete(edge.to);
        }
    }

    visit(start, 0, 0);

    return results.filter((value, i) => !results.some((other, j) =>
        j !== i && other.distance <= value.distance + 1e-8 && other.ascent <= value.ascent + 1e-8
        && (other.distance < value.distance - 1e-8 || other.ascent < value.ascent - 1e-8
            || j < i && Math.abs(other.distance - value.distance) < 1e-8
                && Math.abs(other.ascent - value.ascent) < 1e-8)));
}

test("Pareto frontier agrees with exhaustive simple-path enumeration on small DEMs", () =>
{
    for (let seed = 1; seed <= 9; seed++)
    {
        const dem = fixture(seed + 250, 3, 3);
        dem.elevations.fill(0);

        for (let i = 0; i < dem.elevations.length; i++)
        {
            dem.elevations[i] = (i * 5 + seed * 3) % 7 * 0.3;
        }

        const start = 3, goal = 5;
        const exact = exhaustivePareto(dem, start, goal);
        const actual = paretoTerrainRoutes(dem, [position(dem, start), position(dem, goal)],
            { maxSlopePercent: 100, maxExpansions: 5000, maxLabelsPerCell: 40, maxResults: 6 });

        assert.equal(actual.ok, true, "seed=" + seed);
        assert.equal(actual.truncated, false, "small exhaustive graph should not hit budgets");
        assert.equal(actual.allGoalLabels, exact.length, "Pareto frontier size differs, seed=" + seed);

        for (const candidate of exact)
        {
            assert.ok(actual.routes.some(route =>
                Math.abs(route.distanceMeters - candidate.distance) < 1e-6
                && Math.abs(route.ascentMeters - candidate.ascent) < 1e-6), "Exact Pareto point missing");
        }
    }
});
