import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { decodeBundledDem, JEZERO_DEM_RASTER_SHA256 } from "../src/bundled-dem.js";
import { marsDistance } from "../src/geo.js";
import { gridCellForPoint, gridCoordinate, findTerrainPath, planRouteOnDem, profileRouteOnDem, sampleElevation, validateDem } from "../src/terrain.js";
import { compareTerrainStrategies } from "../src/mission-scenarios.js";
import { DStarLite } from "../src/dstar-lite.js";
import { paretoTerrainRoutes } from "../src/pareto-routes.js";
import { REVIEW_START, REVIEW_GOAL } from "../src/review-demo.js";

const raw = JSON.parse(readFileSync(new URL("../assets/jezero_ctx_trn_dem_20m_clip.json", import.meta.url), "utf8"));
const dem = decodeBundledDem(raw);

function position(data, index)
{
    return gridCoordinate(data, Math.floor(index / data.width), index % data.width);
}

function subregion(rowStart = 56, colStart = 19, width = 24, height = 24)
{
    const elevations = [];

    for (let row = rowStart; row < rowStart + height; row++)
    {
        for (let col = colStart; col < colStart + width; col++)
        {
            elevations.push(dem.elevations[row * dem.width + col]);
        }
    }

    return validateDem({
        width, height,
        north: dem.north - rowStart * dem.latStep,
        west: dem.west + colStart * dem.lonStep,
        latStep: dem.latStep, lonStep: dem.lonStep, elevations,
        source: dem.source + " — numerical subset (no interpolation)"
    });
}

function independentDijkstra(data, start, goal, slopeLimit, slopePenalty)
{
    const count = data.width * data.height;
    const distances = new Float64Array(count).fill(Infinity);
    const visited = new Uint8Array(count);
    const moves = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    distances[start] = 0;

    for (let iteration = 0; iteration < count; iteration++)
    {
        let chosen = -1;

        for (let cell = 0; cell < count; cell++)
        {
            if (!visited[cell] && (chosen < 0 || distances[cell] < distances[chosen]))
            {
                chosen = cell;
            }
        }

        if (chosen < 0 || !Number.isFinite(distances[chosen]))
        {
            break;
        }

        if (chosen === goal)
        {
            return distances[goal];
        }

        visited[chosen] = 1;
        const row = Math.floor(chosen / data.width);
        const col = chosen % data.width;

        for (const [dr, dc] of moves)
        {
            const nextRow = row + dr;
            const nextCol = col + dc;

            if (nextRow < 0 || nextRow >= data.height || nextCol < 0 || nextCol >= data.width)
            {
                continue;
            }

            const next = nextRow * data.width + nextCol;

            if (visited[next] || !Number.isFinite(data.elevations[next]))
            {
                continue;
            }

            if (dr && dc)
            {
                if (!Number.isFinite(data.elevations[row * data.width + nextCol])
                    || !Number.isFinite(data.elevations[nextRow * data.width + col]))
                {
                    continue;
                }
            }

            const meters = marsDistance(position(data, chosen), position(data, next));
            const delta = data.elevations[next] - data.elevations[chosen];

            if (100 * Math.abs(delta) / meters > slopeLimit)
            {
                continue;
            }

            distances[next] = Math.min(distances[next], distances[chosen] + meters + slopePenalty * Math.abs(delta));
        }
    }

    return distances[goal];
}

function auditRoute(data, cells, slopeLimit, slopePenalty)
{
    let distanceMeters = 0;
    let ascentMeters = 0;
    let descentMeters = 0;
    let maxGradePercent = 0;

    for (let i = 1; i < cells.length; i++)
    {
        const from = cells[i - 1];
        const to = cells[i];
        const aRow = Math.floor(from / data.width);
        const aCol = from % data.width;
        const bRow = Math.floor(to / data.width);
        const bCol = to % data.width;
        assert.ok(Math.abs(aRow - bRow) <= 1 && Math.abs(aCol - bCol) <= 1 && from !== to);
        assert.ok(Number.isFinite(data.elevations[to]));

        if (aRow !== bRow && aCol !== bCol)
        {
            assert.ok(Number.isFinite(data.elevations[aRow * data.width + bCol]));
            assert.ok(Number.isFinite(data.elevations[bRow * data.width + aCol]));
        }

        const meters = marsDistance(position(data, from), position(data, to));
        const rise = data.elevations[to] - data.elevations[from];
        const grade = 100 * Math.abs(rise) / meters;

        assert.ok(grade <= slopeLimit + 1e-8);
        assert.ok(meters > 0);
        distanceMeters += meters;
        ascentMeters += Math.max(0, rise);
        descentMeters += Math.max(0, -rise);
        maxGradePercent = Math.max(maxGradePercent, grade);
    }

    return {
        distanceMeters, ascentMeters, descentMeters, maxGradePercent,
        costMeters: distanceMeters + slopePenalty * (ascentMeters + descentMeters)
    };
}

test("the committed Jezero USGS CTX DEM is genuinely numeric, complete and geo-referenced", () =>
{
    assert.equal(raw.sourceRasterSha256, JEZERO_DEM_RASTER_SHA256);
    assert.equal(dem.width, 104);
    assert.equal(dem.height, 96);
    assert.equal(dem.elevations.length, 9984);
    assert.equal(dem.elevations.filter(Number.isFinite).length, 9984);
    assert.ok(dem.source.includes("USGS"));
    assert.match(dem.verticalDatum, /MOLA/i);
    assert.ok(dem.north > REVIEW_START.lat && dem.west < REVIEW_START.lon);

    const minimum = Math.min(...dem.elevations);
    const maximum = Math.max(...dem.elevations);
    const horizontal = marsDistance(gridCoordinate(dem, 60, 20), gridCoordinate(dem, 60, 21));
    const vertical = marsDistance(gridCoordinate(dem, 60, 20), gridCoordinate(dem, 61, 20));
    const bufferDigest = createHash("sha256").update(Buffer.from(raw.elevationsBase64, "base64")).digest("hex");

    assert.ok(minimum > -2700 && minimum < -2600);
    assert.ok(maximum > -2600 && maximum < -2500);
    assert.ok(horizontal > 10 && horizontal < 30);
    assert.ok(vertical > 10 && vertical < 30);

    console.log("REAL_JEZERO_DATA " + JSON.stringify({
        cells: dem.elevations.length, minimum, maximum,
        horizontalPostingMeters: horizontal, verticalPostingMeters: vertical,
        decodedPayloadSha256: bufferDigest, source: dem.source
    }));
});

test("independent Dijkstra certifies real USGS terrain subregion A* edge costs", () =>
{
    const section = subregion();
    const startCell = 2 * section.width + 2;
    const goalCell = 21 * section.width + 21;

    for (const slopePenalty of [0, 6, 24])
    {
        const options = { maxSlopePercent: 100, slopePenalty };
        const expected = independentDijkstra(section, startCell, goalCell, options.maxSlopePercent, slopePenalty);
        const result = findTerrainPath(section, position(section, startCell), position(section, goalCell), options);

        assert.equal(result.ok, Number.isFinite(expected), "Penalty=" + slopePenalty);

        if (result.ok)
        {
            const audit = auditRoute(section, result.cells, options.maxSlopePercent, slopePenalty);
            assert.ok(Math.abs(result.costMeters - expected) < 1e-5);
            assert.ok(Math.abs(audit.costMeters - expected) < 1e-5);
            assert.ok(Math.abs(audit.distanceMeters - result.distanceMeters) < 1e-5);
            assert.ok(Math.abs(audit.ascentMeters - result.ascentMeters) < 1e-8);
        }
    }
});

test("the entire real DEM supports a reproducible Jezero A* and D* Lite cross-check", () =>
{
    const settings = { maxSlopePercent: 18, slopePenalty: 6 };
    const startAt = performance.now();
    const astar = findTerrainPath(dem, REVIEW_START, REVIEW_GOAL, settings);
    const elapsedAstar = performance.now() - startAt;
    const startDstar = performance.now();
    const replanner = new DStarLite(dem, REVIEW_START, REVIEW_GOAL, settings);
    const incremental = replanner.compute();
    const elapsedDstar = performance.now() - startDstar;

    assert.equal(astar.ok, incremental.ok, "Both algorithms should agree on real DEM reachability");

    if (astar.ok)
    {
        const first = gridCellForPoint(dem, REVIEW_START);
        const last = gridCellForPoint(dem, REVIEW_GOAL);
        const audit = auditRoute(dem, astar.cells, settings.maxSlopePercent, settings.slopePenalty);
        assert.equal(astar.cells[0], first);
        assert.equal(astar.cells.at(-1), last);
        assert.ok(Math.abs(astar.costMeters - incremental.costMeters) < 1e-5);
        assert.ok(Math.abs(audit.costMeters - astar.costMeters) < 1e-5);
        assert.ok(Number.isFinite(astar.distanceMeters));
    }

    console.log("REAL_JEZERO_ROUTING " + JSON.stringify({
        success: astar.ok, distanceMeters: astar.distanceMeters ?? null,
        costMeters: astar.costMeters ?? null, ascentMeters: astar.ascentMeters ?? null,
        aStarCells: astar.cells?.length ?? 0, dStarCells: incremental.cells?.length ?? 0,
        astarMilliseconds: Number(elapsedAstar.toFixed(1)),
        dstarMilliseconds: Number(elapsedDstar.toFixed(1))
    }));
});

test("a hypothetical 70-meter exclusion can be reversed without stale D* Lite state", () =>
{
    const midpoint = {
        lat: (REVIEW_START.lat + REVIEW_GOAL.lat) / 2,
        lon: (REVIEW_START.lon + REVIEW_GOAL.lon) / 2,
        radiusMeters: 70
    };
    const options = { maxSlopePercent: 18, slopePenalty: 6 };
    const planner = new DStarLite(dem, REVIEW_START, REVIEW_GOAL, options);
    const before = planner.compute();
    const zoneStats = planner.updateExclusions([midpoint]);
    const during = planner.compute();
    const fresh = findTerrainPath(dem, REVIEW_START, REVIEW_GOAL, { ...options, exclusionZones: [midpoint] });
    const restored = planner.updateExclusions([]);
    const after = planner.compute();

    assert.ok(zoneStats.changedCells > 0);
    assert.ok(restored.changedCells > 0);
    assert.equal(during.ok, fresh.ok);

    if (during.ok)
    {
        assert.ok(Math.abs(during.costMeters - fresh.costMeters) < 1e-5);
    }

    assert.equal(after.ok, before.ok);

    if (after.ok)
    {
        assert.ok(Math.abs(after.costMeters - before.costMeters) < 1e-5);
    }
});

test("the real DEM refuses routes and elevation claims outside its numeric footprint", () =>
{
    const outside = { lat: dem.north + dem.latStep, lon: REVIEW_START.lon };

    assert.equal(sampleElevation(dem, outside), null);
    assert.equal(gridCellForPoint(dem, outside), -1);

    const attempted = findTerrainPath(dem, outside, REVIEW_GOAL);
    assert.equal(attempted.ok, false);
    assert.match(attempted.reason, /outside/i);

    const profile = profileRouteOnDem(dem, [REVIEW_START, outside]);
    assert.equal(profile.complete, false);
    assert.ok(profile.knownCount > 0);
    assert.ok(profile.samples.some(item => item.elevationMeters === null));
});

test("real-data route variants preserve manual anchors and reference source", () =>
{
    const results = compareTerrainStrategies(dem, [REVIEW_START, REVIEW_GOAL]);
    assert.deepEqual(results.map(item => item.id), ["distance", "balanced", "gentle"]);

    for (const item of results)
    {
        assert.equal(item.ok, true, "Demo needs a valid result for " + item.label);
        assert.ok(item.points.length >= 2);
        assert.ok(item.source.includes("USGS"));
        assert.ok(item.points.every(point => sampleElevation(dem, point) !== null));
        assert.ok(item.stats.maxGradePercent <= 18 + 1e-8);
    }

    const middle = gridCoordinate(dem, 65, 39);
    const multi = planRouteOnDem(dem, [REVIEW_START, middle, REVIEW_GOAL]);
    assert.equal(multi.ok, true);
    assert.ok(multi.points.some(point => Math.abs(point.lat - middle.lat) < 1e-9 && Math.abs(point.lon - middle.lon) < 1e-9));
});

test("bounded Pareto paths on real Jezero heights respect distance and uphill ascent metrics", () =>
{
    const section = subregion(61, 24, 12, 12);
    const start = gridCoordinate(section, 2, 2);
    const goal = gridCoordinate(section, 9, 9);
    const options = { maxSlopePercent: 100, maxExpansions: 12000, maxLabelsPerCell: 12, maxResults: 3 };
    const result = paretoTerrainRoutes(section, [start, goal], options);

    assert.equal(result.ok, true);

    for (const route of result.routes)
    {
        const audit = auditRoute(section, route.cells, 100, 0);
        assert.ok(Math.abs(route.distanceMeters - audit.distanceMeters) < 1e-5);
        assert.ok(Math.abs(route.ascentMeters - audit.ascentMeters) < 1e-8);
        assert.equal(route.cells[0], gridCellForPoint(section, start));
        assert.equal(route.cells.at(-1), gridCellForPoint(section, goal));
    }

    console.log("REAL_JEZERO_PARETO " + JSON.stringify({
        returned: result.routes.length, frontierLabels: result.allGoalLabels,
        expanded: result.expanded, truncated: result.truncated
    }));
});
