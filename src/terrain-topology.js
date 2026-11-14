import { gridCoordinate } from "./terrain.js";

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// 0-dimensional persistence of the upper/lower excursion sets on an explicit
// 4-connected DEM complex. Features are topological summaries, NOT geology labels.
function persistenceSweep(dem, type)
{
    const n = dem.width * dem.height;
    const heights = dem.elevations;
    const order = [];

    for (let i = 0; i < n; i++)
    {
        if (Number.isFinite(heights[i]))
        {
            order.push(i);
        }
    }

    order.sort((a, b) => type === "peak" ? heights[b] - heights[a] || a - b : heights[a] - heights[b] || a - b);
    const parent = new Int32Array(n).fill(-1);
    const rankBirth = new Float64Array(n);
    const bornAt = new Int32Array(n);
    const features = [];
    const levels = [];
    let components = 0, processed = 0;

    function root(i)
    {
        while (parent[i] !== i)
        {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }

        return i;
    }

    function join(a, b, level)
    {
        let ra = root(a), rb = root(b);

        if (ra === rb)
        {
            return;
        }

        // Elder rule: higher maxima (or lower minima) survive the merge.
        const aOlder = type === "peak" ? rankBirth[ra] > rankBirth[rb] || rankBirth[ra] === rankBirth[rb] && bornAt[ra] < bornAt[rb]
            : rankBirth[ra] < rankBirth[rb] || rankBirth[ra] === rankBirth[rb] && bornAt[ra] < bornAt[rb];
        const older = aOlder ? ra : rb;
        const younger = aOlder ? rb : ra;
        const difference = Math.abs(rankBirth[younger] - level);

        if (difference > 1e-9)
        {
            const index = bornAt[younger];
            features.push({ type, birthMeters: rankBirth[younger], mergeMeters: level, persistenceMeters: difference, cellIndex: index, point: gridCoordinate(dem, Math.floor(index / dem.width), index % dem.width), bounded: true });
        }

        parent[younger] = older;
        components--;
    }

    for (let begin = 0; begin < order.length;)
    {
        const elevation = heights[order[begin]];
        let end = begin;

        while (end < order.length && heights[order[end]] === elevation)
        {
            const index = order[end];
            parent[index] = index;
            bornAt[index] = index;
            rankBirth[index] = elevation;
            end++;
            components++;
        }

        // Cells of the same elevation form one simultaneous level; avoids fake
        // persistence created by arbitrary ordering of plateau pixels.
        for (let k = begin; k < end; k++)
        {
            const index = order[k], row = Math.floor(index / dem.width), col = index % dem.width;

            for (const [dr, dc] of NEIGHBORS)
            {
                const r = row + dr, c = col + dc;

                if (r >= 0 && c >= 0 && r < dem.height && c < dem.width)
                {
                    const other = r * dem.width + c;

                    if (parent[other] >= 0)
                    {
                        join(index, other, elevation);
                    }
                }
            }
        }

        processed += end - begin;
        levels.push({ elevationMeters: elevation, componentCount: components, includedCells: processed });
        begin = end;
    }

    const survivors = new Set();

    for (const index of order)
    {
        survivors.add(root(index));
    }

    for (const survivingRoot of survivors)
    {
        const index = bornAt[survivingRoot];
        features.push({ type, birthMeters: rankBirth[survivingRoot], mergeMeters: null, persistenceMeters: null, cellIndex: index, point: gridCoordinate(dem, Math.floor(index / dem.width), index % dem.width), bounded: false });
    }

    const finite = features.filter(item => item.bounded).sort((a, b) => b.persistenceMeters - a.persistenceMeters || a.cellIndex - b.cellIndex);
    const global = features.filter(item => !item.bounded);

    return { type, finite, global, levels, validCells: order.length };
}

export function analyzeTerrainTopology(dem, options = {})
{
    const count = Math.min(30, Math.max(1, options.maxFeatures ?? 8));
    const minPersistence = Math.max(0, options.minPersistenceMeters ?? 1);
    const peaks = persistenceSweep(dem, "peak");
    const basins = persistenceSweep(dem, "basin");

    return {
        peaks: peaks.finite.filter(x => x.persistenceMeters >= minPersistence).slice(0, count),
        basins: basins.finite.filter(x => x.persistenceMeters >= minPersistence).slice(0, count),
        globalPeaks: peaks.global,
        globalBasins: basins.global,
        inspectedCells: peaks.validCells,
        totalFinitePeaks: peaks.finite.length,
        totalFiniteBasins: basins.finite.length,
        componentLevels: { peaks: peaks.levels, basins: basins.levels },
        caveat: "0D excursion-set persistence on a 4-neighbor grid. Values are DEM height contrasts, not validated geological formations, independent noise thresholds or rock hazards."
    };
}
