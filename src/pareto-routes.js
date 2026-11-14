import { GridGraph, KeyHeap } from "./graph-grid.js";

const EPSILON = 1e-8;

export function dominates(a, b)
{
    return a.distanceMeters <= b.distanceMeters + EPSILON && a.ascentMeters <= b.ascentMeters + EPSILON && (a.distanceMeters < b.distanceMeters - EPSILON || a.ascentMeters < b.ascentMeters - EPSILON);
}

function identical(a, b)
{
    return Math.abs(a.distanceMeters - b.distanceMeters) <= EPSILON && Math.abs(a.ascentMeters - b.ascentMeters) <= EPSILON;
}

export function paretoFilter(candidates)
{
    if (!Array.isArray(candidates))
    {
        throw new Error("Expected a list of measurable candidate routes.");
    }

    return candidates.filter((item, i) => !candidates.some((other, j) => j !== i && (dominates(other, item) || j < i && identical(other, item))));
}

function buildPath(label, graph)
{
    const cells = [];
    let cursor = label;

    while (cursor)
    {
        cells.push(cursor.index);
        cursor = cursor.parent;
    }

    cells.reverse();
    return {
        cells,
        points: cells.map(index => graph.positions[index]),
        distanceMeters: label.distanceMeters,
        ascentMeters: label.ascentMeters,
        model: "Bounded Pareto labels on a numeric DEM: distance vs cumulative uphill ascent"
    };
}

export function paretoTerrainRoutes(dem, waypoints, options = {})
{
    if (!Array.isArray(waypoints) || waypoints.length !== 2)
    {
        return { ok: false, reason: "Pareto explorer requires exactly two manual waypoints; intermediate stops would otherwise be skipped." };
    }

    const graph = new GridGraph(dem, options);
    const start = graph.cell(waypoints[0]), goal = graph.cell(waypoints[1]);

    if (!graph.allowed(start) || !graph.allowed(goal))
    {
        return { ok: false, reason: "One endpoint is outside numeric DEM coverage, in NoData, or inside an exclusion zone." };
    }

    const limitPerCell = options.maxLabelsPerCell ?? 12;
    const maxExpansions = options.maxExpansions ?? 35000;

    if (!Number.isInteger(limitPerCell) || limitPerCell < 2 || limitPerCell > 40 || !Number.isInteger(maxExpansions) || maxExpansions < 100 || maxExpansions > 200000)
    {
        throw new Error("Pareto label budget outside accepted limits.");
    }

    const labels = Array.from({ length: graph.size }, () => []);
    const heap = new KeyHeap();
    let serial = 0, expanded = 0, pruned = 0, clipped = 0;
    const seed = { index: start, distanceMeters: 0, ascentMeters: 0, parent: null, active: true };
    labels[start].push(seed);
    heap.push({ index: serial++, k1: graph.distance(start, goal), k2: 0, label: seed });

    while (heap.size && expanded < maxExpansions)
    {
        const current = heap.pop().label;

        if (!current.active)
        {
            continue;
        }

        expanded++;

        if (current.index === goal)
        {
            continue;
        }

        for (const next of graph.neighbors(current.index))
        {
            const edge = graph.edge(current.index, next);

            if (!edge)
            {
                continue;
            }

            const candidate = {
                index: next,
                distanceMeters: current.distanceMeters + edge.length,
                ascentMeters: current.ascentMeters + edge.ascent,
                parent: current,
                active: true
            };

            const bucket = labels[next];

            if (bucket.some(item => identical(item, candidate) || dominates(item, candidate)))
            {
                pruned++;
                continue;
            }

            for (let i = bucket.length - 1; i >= 0; i--)
            {
                if (dominates(candidate, bucket[i]))
                {
                    bucket[i].active = false;
                    bucket.splice(i, 1);
                }
            }

            if (bucket.length >= limitPerCell)
            {
                // The bound is explicit: retained alternatives are non-dominated among
                // retained labels, not necessarily the full global Pareto frontier.
                clipped++;
                const worst = bucket.reduce((a, b) => a.distanceMeters + a.ascentMeters > b.distanceMeters + b.ascentMeters ? a : b);

                if (candidate.distanceMeters + candidate.ascentMeters >= worst.distanceMeters + worst.ascentMeters)
                {
                    continue;
                }

                worst.active = false;
                bucket.splice(bucket.indexOf(worst), 1);
            }

            bucket.push(candidate);
            heap.push({ index: serial++, k1: candidate.distanceMeters + graph.distance(next, goal), k2: candidate.ascentMeters, label: candidate });
        }
    }

    const truncated = heap.size > 0 || clipped > 0;
    const nondominated = paretoFilter(labels[goal]).sort((a, b) => a.distanceMeters - b.distanceMeters || a.ascentMeters - b.ascentMeters);

    if (!nondominated.length)
    {
        return { ok: false, reason: "No modeled Pareto route found within the label budget and exclusion/grade constraints.", expanded, truncated };
    }

    const maxResults = Math.min(6, options.maxResults ?? 5);
    const selected = nondominated.length <= maxResults ? nondominated : Array.from({ length: maxResults }, (_, i) => nondominated[Math.round(i * (nondominated.length - 1) / (maxResults - 1))]);

    return {
        ok: true,
        routes: selected.map(label => buildPath(label, graph)),
        allGoalLabels: nondominated.length,
        expanded, pruned, clipped, truncated,
        warning: truncated ? "Bounded Pareto exploration: labels were discarded or the expansion limit was reached; no globally complete frontier is claimed." : "Complete label search within this small DEM graph and numeric cost assumptions; not a Mars hazard or science value optimization."
    };
}
