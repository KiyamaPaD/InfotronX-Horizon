import { marsDistance } from "./geo.js";

const MAX_CELLS = 60000;
const MAX_EXCLUSION_ZONES = 20;
const NEIGHBORS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
];

class MinHeap
{
    constructor()
    {
        this.items = [];
    }

    push(item)
    {
        const items = this.items;
        items.push(item);
        let index = items.length - 1;

        while (index > 0)
        {
            const parent = (index - 1) >> 1;

            if (items[parent].priority <= item.priority)
            {
                break;
            }

            items[index] = items[parent];
            index = parent;
        }

        items[index] = item;
    }

    pop()
    {
        const items = this.items;
        const first = items[0];
        const last = items.pop();

        if (!items.length)
        {
            return first;
        }

        let index = 0;

        while (index * 2 + 1 < items.length)
        {
            let child = index * 2 + 1;

            if (child + 1 < items.length && items[child + 1].priority < items[child].priority)
            {
                child++;
            }

            if (items[child].priority >= last.priority)
            {
                break;
            }

            items[index] = items[child];
            index = child;
        }

        items[index] = last;
        return first;
    }

    get size()
    {
        return this.items.length;
    }
}

export function validateDem(raw)
{
    if (!raw || typeof raw !== "object")
    {
        throw new Error("DEM must be a JSON object.");
    }

    const { width, height, north, west, latStep, lonStep, elevations } = raw;

    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > MAX_CELLS)
    {
        throw new Error(`DEM grid must contain 2–${MAX_CELLS} cells per total area.`);
    }

    if (![north, west, latStep, lonStep].every(Number.isFinite) || latStep <= 0 || lonStep <= 0)
    {
        throw new Error("DEM coordinates and positive pixel steps are required.");
    }

    if (north > 90 || north - (height - 1) * latStep < -90 || west < -180 || west + (width - 1) * lonStep > 180)
    {
        throw new Error("DEM grid extends outside accepted Mars geographic coordinates.");
    }

    if (!Array.isArray(elevations) || elevations.length !== width * height)
    {
        throw new Error("DEM elevations must be a row-major array with width × height entries.");
    }

    if (!elevations.every(value => value === null || Number.isFinite(value) && Math.abs(value) < 40000))
    {
        throw new Error("DEM contains invalid elevations. Use numeric meters or null for NoData.");
    }

    if (elevations.every(value => value === null))
    {
        throw new Error("DEM has no usable elevation samples.");
    }

    const source = typeof raw.source === "string" ? raw.source.trim().slice(0, 240) : "";

    if (!source)
    {
        throw new Error("DEM source/provenance is required.");
    }

    return {
        version: 1,
        width, height, north, west, latStep, lonStep,
        elevations: elevations.slice(),
        source,
        resolution: typeof raw.resolution === "string" ? raw.resolution.slice(0, 100) : "Not specified",
        horizontalDatum: typeof raw.horizontalDatum === "string" ? raw.horizontalDatum.slice(0, 140) : "Not specified",
        verticalDatum: typeof raw.verticalDatum === "string" ? raw.verticalDatum.slice(0, 140) : "Not specified",
        sourceUrl: typeof raw.sourceUrl === "string" && /^https:\/\//.test(raw.sourceUrl) ? raw.sourceUrl.slice(0, 400) : "",
        verified: false
    };
}

export function gridCoordinate(dem, row, column)
{
    return { lat: dem.north - row * dem.latStep, lon: dem.west + column * dem.lonStep };
}

export function gridCellForPoint(dem, point)
{
    const row = Math.round((dem.north - point.lat) / dem.latStep);
    const column = Math.round((point.lon - dem.west) / dem.lonStep);

    if (!Number.isFinite(row) || !Number.isFinite(column) || row < 0 || column < 0 || row >= dem.height || column >= dem.width)
    {
        return -1;
    }

    const center = gridCoordinate(dem, row, column);

    if (Math.abs(center.lat - point.lat) > dem.latStep / 2 + 1e-9 || Math.abs(center.lon - point.lon) > dem.lonStep / 2 + 1e-9)
    {
        return -1;
    }

    return row * dem.width + column;
}

export function sampleElevation(dem, point)
{
    const cell = gridCellForPoint(dem, point);
    return cell < 0 ? null : dem.elevations[cell];
}

export function calculateGrade(elevationA, elevationB, distanceMeters)
{
    if (!Number.isFinite(elevationA) || !Number.isFinite(elevationB) || !Number.isFinite(distanceMeters) || distanceMeters <= 0)
    {
        return null;
    }

    return (elevationB - elevationA) / distanceMeters * 100;
}

function simplifyCellPath(indices, width)
{
    if (indices.length <= 2)
    {
        return indices;
    }

    const result = [indices[0]];

    for (let i = 1; i < indices.length - 1; i++)
    {
        const previous = indices[i - 1];
        const current = indices[i];
        const next = indices[i + 1];
        const stepA = [Math.sign(Math.floor(current / width) - Math.floor(previous / width)), Math.sign(current % width - previous % width)];
        const stepB = [Math.sign(Math.floor(next / width) - Math.floor(current / width)), Math.sign(next % width - current % width)];

        if (stepA[0] !== stepB[0] || stepA[1] !== stepB[1])
        {
            result.push(current);
        }
    }

    result.push(indices[indices.length - 1]);
    return result;
}

export function makeExclusionMask(dem, zones = [], positions = null)
{
    if (!Array.isArray(zones) || zones.length > MAX_EXCLUSION_ZONES)
    {
        throw new Error(`At most ${MAX_EXCLUSION_ZONES} scenario exclusion zones are allowed.`);
    }

    const mask = new Uint8Array(dem.width * dem.height);

    if (!zones.length)
    {
        return mask;
    }

    const checked = zones.map(zone =>
    {
        if (!Number.isFinite(zone?.lat) || !Number.isFinite(zone?.lon) || !Number.isFinite(zone?.radiusMeters) || Math.abs(zone.lat) > 90 || Math.abs(zone.lon) > 180 || zone.radiusMeters < 1 || zone.radiusMeters > 5000)
        {
            throw new Error("Scenario exclusion zones require valid Mars coordinates and a radius of 1–5000 meters.");
        }

        return zone;
    });

    for (let index = 0; index < mask.length; index++)
    {
        if (dem.elevations[index] === null)
        {
            continue;
        }

        const point = positions?.[index] || gridCoordinate(dem, Math.floor(index / dem.width), index % dem.width);

        if (checked.some(zone => marsDistance(zone, point) <= zone.radiusMeters))
        {
            mask[index] = 1;
        }
    }

    return mask;
}

export function findTerrainPath(dem, start, goal, options = {})
{
    const maxSlopePercent = Number.isFinite(options.maxSlopePercent) ? options.maxSlopePercent : 18;
    const slopePenalty = Number.isFinite(options.slopePenalty) ? options.slopePenalty : 6;

    if (maxSlopePercent <= 0 || maxSlopePercent > 100 || slopePenalty < 0 || slopePenalty > 100)
    {
        throw new Error("Invalid route model assumptions.");
    }

    const startCell = gridCellForPoint(dem, start);
    const goalCell = gridCellForPoint(dem, goal);

    if (startCell < 0 || goalCell < 0)
    {
        return { ok: false, reason: "Start or destination is outside this DEM clip." };
    }

    if (dem.elevations[startCell] === null || dem.elevations[goalCell] === null)
    {
        return { ok: false, reason: "Start or destination has no elevation data." };
    }

    const zones = options.exclusionZones || [];
    const blocked = makeExclusionMask(dem, zones);

    if (blocked[startCell] || blocked[goalCell])
    {
        return { ok: false, reason: "A waypoint falls inside a user-defined exclusion zone. Move the waypoint or adjust the radius." };
    }

    if (startCell === goalCell)
    {
        return { ok: true, cells: [startCell], costMeters: 0, distanceMeters: 0, ascentMeters: 0, descentMeters: 0, maxGradePercent: 0, visited: 1 };
    }

    const positions = Array.from({ length: dem.width * dem.height }, (_, index) => gridCoordinate(dem, Math.floor(index / dem.width), index % dem.width));
    const best = new Float64Array(positions.length);
    const parents = new Int32Array(positions.length);
    const closed = new Uint8Array(positions.length);
    best.fill(Infinity);
    parents.fill(-1);
    best[startCell] = 0;
    const heap = new MinHeap();
    heap.push({ index: startCell, priority: marsDistance(positions[startCell], positions[goalCell]), cost: 0 });
    let visited = 0;

    while (heap.size)
    {
        const current = heap.pop();

        if (closed[current.index] || current.cost > best[current.index] + 1e-8)
        {
            continue;
        }

        closed[current.index] = 1;
        visited++;

        if (current.index === goalCell)
        {
            break;
        }

        const row = Math.floor(current.index / dem.width);
        const column = current.index % dem.width;

        for (const [deltaRow, deltaColumn] of NEIGHBORS)
        {
            const newRow = row + deltaRow;
            const newColumn = column + deltaColumn;

            if (newRow < 0 || newColumn < 0 || newRow >= dem.height || newColumn >= dem.width)
            {
                continue;
            }

            const next = newRow * dem.width + newColumn;

            if (closed[next] || dem.elevations[next] === null || blocked[next])
            {
                continue;
            }

            if (deltaRow !== 0 && deltaColumn !== 0 && (dem.elevations[row * dem.width + newColumn] === null || dem.elevations[newRow * dem.width + column] === null || blocked[row * dem.width + newColumn] || blocked[newRow * dem.width + column]))
            {
                continue;
            }

            const distance = marsDistance(positions[current.index], positions[next]);
            const grade = calculateGrade(dem.elevations[current.index], dem.elevations[next], distance);

            if (grade === null || Math.abs(grade) > maxSlopePercent)
            {
                continue;
            }

            const cost = best[current.index] + distance * (1 + slopePenalty * Math.abs(grade) / 100);

            if (cost >= best[next])
            {
                continue;
            }

            best[next] = cost;
            parents[next] = current.index;
            heap.push({ index: next, cost, priority: cost + marsDistance(positions[next], positions[goalCell]) });
        }
    }

    if (!closed[goalCell])
    {
        return { ok: false, reason: `No connected path within the DEM clip and the ${maxSlopePercent}% illustrative slope limit.`, visited };
    }

    const cells = [];

    for (let index = goalCell; index >= 0; index = parents[index])
    {
        cells.push(index);

        if (index === startCell)
        {
            break;
        }
    }

    cells.reverse();
    let distanceMeters = 0;
    let ascentMeters = 0;
    let descentMeters = 0;
    let maxGrade = 0;

    for (let i = 1; i < cells.length; i++)
    {
        const previous = cells[i - 1];
        const current = cells[i];
        const distance = marsDistance(positions[previous], positions[current]);
        const change = dem.elevations[current] - dem.elevations[previous];
        distanceMeters += distance;
        ascentMeters += Math.max(0, change);
        descentMeters += Math.max(0, -change);
        maxGrade = Math.max(maxGrade, Math.abs(calculateGrade(dem.elevations[previous], dem.elevations[current], distance)));
    }

    return {
        ok: true,
        cells,
        simplifiedCells: simplifyCellPath(cells, dem.width),
        costMeters: best[goalCell],
        distanceMeters,
        ascentMeters,
        descentMeters,
        maxGradePercent: maxGrade,
        visited
    };
}

export function planRouteOnDem(dem, waypoints, options = {})
{
    if (!Array.isArray(waypoints) || waypoints.length < 2)
    {
        return { ok: false, reason: "Add at least two route waypoints before planning." };
    }

    const segments = [];
    let cells = [];
    let distanceMeters = 0;
    let ascentMeters = 0;
    let descentMeters = 0;
    let maxGradePercent = 0;
    let visited = 0;

    for (let i = 1; i < waypoints.length; i++)
    {
        const segment = findTerrainPath(dem, waypoints[i - 1], waypoints[i], options);

        if (!segment.ok)
        {
            return { ok: false, reason: `Segment ${i}: ${segment.reason}` };
        }

        segments.push(segment);
        cells.push(...segment.cells.slice(cells.length ? 1 : 0));
        distanceMeters += segment.distanceMeters;
        ascentMeters += segment.ascentMeters;
        descentMeters += segment.descentMeters;
        maxGradePercent = Math.max(maxGradePercent, segment.maxGradePercent);
        visited += segment.visited;
    }

    const kept = [];

    for (const segment of segments)
    {
        const simplified = simplifyCellPath(segment.cells, dem.width);
        kept.push(...simplified.slice(kept.length ? 1 : 0));
    }

    const maxWaypoints = Number.isInteger(options.maxWaypoints) ? options.maxWaypoints : 80;

    if (kept.length > maxWaypoints)
    {
        return { ok: false, reason: `The modeled route needs ${kept.length} turning points (limit ${maxWaypoints}). Use a shorter section or a coarser DEM clip; the algorithm will not cut across unchecked cells.` };
    }

    return {
        ok: true,
        points: kept.map(index => ({ ...gridCoordinate(dem, Math.floor(index / dem.width), index % dem.width), elevation: dem.elevations[index] })),
        stats: { distanceMeters, ascentMeters, descentMeters, maxGradePercent, visited, cellCount: cells.length },
        assumptions: { maxSlopePercent: options.maxSlopePercent ?? 18, slopePenalty: options.slopePenalty ?? 6, exclusionZones: (options.exclusionZones || []).length },
        source: dem.source
    };
}

export function profileRouteOnDem(dem, points)
{
    if (!Array.isArray(points) || points.length < 2)
    {
        return { complete: false, samples: [], knownCount: 0 };
    }

    let distanceMeters = 0;
    const samples = [{
        distanceMeters, elevationMeters: sampleElevation(dem, points[0]),
        lat: points[0].lat, lon: points[0].lon, segmentIndex: 0
    }];

    for (let i = 1; i < points.length; i++)
    {
        const segmentLength = marsDistance(points[i - 1], points[i]);
        const resolution = Math.min(marsDistance(points[i - 1], { lat: points[i - 1].lat + dem.latStep, lon: points[i - 1].lon }), marsDistance(points[i - 1], { lat: points[i - 1].lat, lon: points[i - 1].lon + dem.lonStep }));
        const segmentLimit = Math.max(3, Math.floor(3000 / (points.length - 1)));
        const steps = Math.min(segmentLimit, Math.max(1, Math.ceil(segmentLength / Math.max(1, resolution))));

        for (let step = 1; step <= steps; step++)
        {
            const t = step / steps;
            const point = { lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t, lon: points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t };
            samples.push({
                distanceMeters: distanceMeters + segmentLength * t,
                elevationMeters: sampleElevation(dem, point),
                lat: point.lat, lon: point.lon, segmentIndex: i - 1
            });
        }

        distanceMeters += segmentLength;
    }

    const knownCount = samples.filter(item => item.elevationMeters !== null).length;
    return { complete: knownCount === samples.length, knownCount, samples };
}
