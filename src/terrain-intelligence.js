import { marsDistance } from "./geo.js";
import { calculateGrade, gridCellForPoint, gridCoordinate, makeExclusionMask } from "./terrain.js";
import { measureGridRegion } from "./measure-theory.js";

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
const MARS_RADIUS = 3396190;

class PriorityQueue
{
    constructor()
    {
        this.data = [];
    }

    push(item)
    {
        const data = this.data;
        let i = data.length;
        data.push(item);

        while (i > 0)
        {
            const parent = (i - 1) >> 1;

            if (data[parent].minutes <= item.minutes)
            {
                break;
            }

            data[i] = data[parent];
            i = parent;
        }

        data[i] = item;
    }

    pop()
    {
        const data = this.data;
        const first = data[0];
        const last = data.pop();

        if (!data.length)
        {
            return first;
        }

        let i = 0;

        while (i * 2 + 1 < data.length)
        {
            let child = i * 2 + 1;

            if (child + 1 < data.length && data[child + 1].minutes < data[child].minutes)
            {
                child++;
            }

            if (data[child].minutes >= last.minutes)
            {
                break;
            }

            data[i] = data[child];
            i = child;
        }

        data[i] = last;
        return first;
    }

    get size()
    {
        return this.data.length;
    }
}

export function sampleElevationBilinear(dem, point)
{
    const row = (dem.north - point.lat) / dem.latStep;
    const column = (point.lon - dem.west) / dem.lonStep;

    if (!Number.isFinite(row) || !Number.isFinite(column) || row < -1e-9 || column < -1e-9 || row > dem.height - 1 + 1e-9 || column > dem.width - 1 + 1e-9)
    {
        return null;
    }

    const r = Math.min(dem.height - 2, Math.max(0, Math.floor(row)));
    const c = Math.min(dem.width - 2, Math.max(0, Math.floor(column)));
    const dy = Math.max(0, Math.min(1, row - r));
    const dx = Math.max(0, Math.min(1, column - c));
    const z00 = dem.elevations[r * dem.width + c];
    const z10 = dem.elevations[r * dem.width + c + 1];
    const z01 = dem.elevations[(r + 1) * dem.width + c];
    const z11 = dem.elevations[(r + 1) * dem.width + c + 1];

    if (![z00, z10, z01, z11].every(Number.isFinite))
    {
        return null;
    }

    return z00 * (1 - dx) * (1 - dy) + z10 * dx * (1 - dy) + z01 * (1 - dx) * dy + z11 * dx * dy;
}

export function getTerrainCellMetrics(dem, row, column)
{
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 1 || column < 1 || row >= dem.height - 1 || column >= dem.width - 1)
    {
        return null;
    }

    const center = gridCoordinate(dem, row, column);
    const east = gridCoordinate(dem, row, column + 1);
    const south = gridCoordinate(dem, row + 1, column);
    const dx = marsDistance(center, east);
    const dy = marsDistance(center, south);
    const heights = [];

    for (let dr = -1; dr <= 1; dr++)
    {
        for (let dc = -1; dc <= 1; dc++)
        {
            const value = dem.elevations[(row + dr) * dem.width + column + dc];

            if (!Number.isFinite(value))
            {
                return null;
            }

            heights.push({ dr, dc, value });
        }
    }

    const mean = heights.reduce((sum, item) => sum + item.value, 0) / 9;
    const eastSlope = heights.reduce((sum, item) => sum + item.dc * (item.value - mean), 0) / (6 * dx);
    const southSlope = heights.reduce((sum, item) => sum + item.dr * (item.value - mean), 0) / (6 * dy);
    const residual = heights.reduce((sum, item) =>
    {
        const modeled = mean + item.dc * dx * eastSlope + item.dr * dy * southSlope;
        return sum + (item.value - modeled) ** 2;
    }, 0);
    const roughnessMeters = Math.sqrt(residual / 9);

    return {
        gradePercent: Math.hypot(eastSlope, southSlope) * 100,
        roughnessMeters,
        downhillBearingDegrees: (Math.atan2(-eastSlope, southSlope) * 180 / Math.PI + 360) % 360,
        sampleCount: 9
    };
}

export function analyzeTerrainSurface(dem)
{
    const grade = new Float32Array(dem.width * dem.height);
    const roughness = new Float32Array(dem.width * dem.height);
    let count = 0;
    let maxGrade = 0;
    let maxRoughness = 0;

    for (let row = 0; row < dem.height; row++)
    {
        for (let col = 0; col < dem.width; col++)
        {
            const index = row * dem.width + col;
            const result = getTerrainCellMetrics(dem, row, col);
            grade[index] = result?.gradePercent ?? NaN;
            roughness[index] = result?.roughnessMeters ?? NaN;

            if (result)
            {
                count++;
                maxGrade = Math.max(maxGrade, result.gradePercent);
                maxRoughness = Math.max(maxRoughness, result.roughnessMeters);
            }
        }
    }

    return { grade, roughness, validCells: count, maxGradePercent: maxGrade, maxRoughnessMeters: maxRoughness, width: dem.width, height: dem.height };
}

export function analyzeLineOfSight(dem, start, destination, options = {})
{
    const observerHeightMeters = options.observerHeightMeters ?? 1.8;
    const targetHeightMeters = options.targetHeightMeters ?? 1.8;

    if (![observerHeightMeters, targetHeightMeters].every(value => Number.isFinite(value) && value >= 0 && value <= 100))
    {
        throw new Error("Observer and target heights must be 0–100 meters above the DEM.");
    }

    const distanceMeters = marsDistance(start, destination);
    const first = sampleElevationBilinear(dem, start);
    const last = sampleElevationBilinear(dem, destination);

    if (first === null || last === null)
    {
        return { status: "unknown", reason: "One or both endpoints are outside numeric DEM coverage or touch NoData.", distanceMeters };
    }

    if (distanceMeters < 0.01)
    {
        return { status: "visible", distanceMeters, sampleCount: 1, minimumClearanceMeters: Math.min(observerHeightMeters, targetHeightMeters) };
    }

    const center = gridCoordinate(dem, 0, 0);
    const cellSize = Math.min(marsDistance(center, gridCoordinate(dem, 1, 0)), marsDistance(center, gridCoordinate(dem, 0, 1)));
    const intervals = Math.max(2, Math.ceil(distanceMeters / (cellSize / 2)));

    if (intervals > 1200)
    {
        return { status: "unknown", reason: "Segment is too long for reliable sampling within this clipped DEM.", distanceMeters };
    }

    const rayStartHeight = first + observerHeightMeters;
    const rayEndHeight = last + targetHeightMeters;
    let minimumClearanceMeters = Infinity;
    let obstructedAt = null;

    for (let i = 1; i < intervals; i++)
    {
        const fraction = i / intervals;
        const sample = { lat: start.lat + (destination.lat - start.lat) * fraction, lon: start.lon + (destination.lon - start.lon) * fraction };
        const altitude = sampleElevationBilinear(dem, sample);

        if (altitude === null)
        {
            return { status: "unknown", reason: "The ray crosses an area outside the DEM or with NoData; visibility cannot be certified.", distanceMeters };
        }

        const curvatureBulge = distanceMeters ** 2 * fraction * (1 - fraction) / (2 * MARS_RADIUS);
        const rayHeight = rayStartHeight + (rayEndHeight - rayStartHeight) * fraction;
        const clearance = rayHeight - (altitude + curvatureBulge);

        if (clearance < minimumClearanceMeters)
        {
            minimumClearanceMeters = clearance;
            obstructedAt = { ...sample, distanceFromStartMeters: distanceMeters * fraction, clearanceMeters: clearance };
        }
    }

    return {
        status: minimumClearanceMeters > 0 ? "visible" : "blocked",
        distanceMeters,
        sampleCount: intervals - 1,
        minimumClearanceMeters,
        closestApproach: obstructedAt,
        method: "Straight-line terrain ray sampled at ≤half DEM posting, bilinear elevations, approximate Mars spherical curvature"
    };
}

export function computeReachability(dem, start, options = {})
{
    const speedKmh = options.speedKmh ?? 2.4;
    const budgetMinutes = options.budgetMinutes ?? 30;
    const maxSlopePercent = options.maxSlopePercent ?? 18;
    const slopePenalty = options.slopePenalty ?? 6;

    if (![speedKmh, budgetMinutes, maxSlopePercent, slopePenalty].every(Number.isFinite) || speedKmh <= 0 || speedKmh > 12 || budgetMinutes <= 0 || budgetMinutes > 480 || maxSlopePercent <= 0 || maxSlopePercent > 100 || slopePenalty < 0 || slopePenalty > 100)
    {
        throw new Error("Invalid time, speed or modeled slope parameters.");
    }

    const startCell = gridCellForPoint(dem, start);
    const total = dem.width * dem.height;
    const costs = new Float64Array(total);
    costs.fill(Infinity);
    const bands = new Uint8Array(total);
    const settled = new Uint8Array(total);
    const positions = Array.from({ length: total }, (_, index) => gridCoordinate(dem, Math.floor(index / dem.width), index % dem.width));
    const blocked = makeExclusionMask(dem, options.exclusionZones || [], positions);

    if (startCell < 0 || dem.elevations[startCell] === null || blocked[startCell])
    {
        return { ok: false, reason: "Starting waypoint is outside the usable DEM or inside a hypothetical exclusion area." };
    }

    const heap = new PriorityQueue();
    costs[startCell] = 0;
    heap.push({ index: startCell, minutes: 0 });
    let explored = 0;
    let reachableCells = 0;
    let maximumDistanceMeters = 0;

    while (heap.size)
    {
        const item = heap.pop();

        if (settled[item.index] || item.minutes > costs[item.index] + 1e-10 || item.minutes > budgetMinutes)
        {
            continue;
        }

        settled[item.index] = 1;
        explored++;
        reachableCells++;
        const row = Math.floor(item.index / dem.width);
        const col = item.index % dem.width;
        maximumDistanceMeters = Math.max(maximumDistanceMeters, marsDistance(start, positions[item.index]));
        bands[item.index] = Math.min(4, Math.max(1, Math.ceil(item.minutes / budgetMinutes * 4)));

        for (const [dr, dc] of NEIGHBORS)
        {
            const nr = row + dr;
            const nc = col + dc;

            if (nr < 0 || nc < 0 || nr >= dem.height || nc >= dem.width)
            {
                continue;
            }

            const next = nr * dem.width + nc;

            if (dem.elevations[next] === null || blocked[next])
            {
                continue;
            }

            if (dr && dc && (dem.elevations[row * dem.width + nc] === null || dem.elevations[nr * dem.width + col] === null || blocked[row * dem.width + nc] || blocked[nr * dem.width + col]))
            {
                continue;
            }

            const distance = marsDistance(positions[item.index], positions[next]);
            const grade = calculateGrade(dem.elevations[item.index], dem.elevations[next], distance);

            if (grade === null || Math.abs(grade) > maxSlopePercent)
            {
                continue;
            }

            const nextCost = item.minutes + distance / 1000 / speedKmh * 60 * (1 + slopePenalty * Math.abs(grade) / 100);

            if (nextCost < costs[next] && nextCost <= budgetMinutes)
            {
                costs[next] = nextCost;
                heap.push({ index: next, minutes: nextCost });
            }
        }
    }

    const modeledArea = measureGridRegion(dem, bands);
    const validTerrainArea = measureGridRegion(dem, new Uint8Array(total).fill(1));

    return {
        ok: true, start, bands, costs, reachableCells, explored,
        modeledAreaKm2: modeledArea.squareKilometers,
        validTerrainAreaKm2: validTerrainArea.squareKilometers,
        reachableFractionOfValidTerrain: validTerrainArea.squareMeters ? modeledArea.squareMeters / validTerrainArea.squareMeters : 0,
        areaMethod: "Spherical Mars area measure: sum of longitude-latitude sample cells weighted by cos(latitude)",
        maxStraightLineRangeMeters: maximumDistanceMeters,
        budgetMinutes, speedKmh, maxSlopePercent, slopePenalty,
        width: dem.width, height: dem.height,
        warning: "Purely DEM-derived reachability under user-specified motion and grade assumptions; excludes rocks, soil, suit limits, route completion and EVA safety."
    };
}
