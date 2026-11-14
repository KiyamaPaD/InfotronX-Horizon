import { GridGraph, KeyHeap } from "./graph-grid.js";

// Incremental shortest paths on a *fixed* DEM with changing hypothetical exclusion zones.
// Koenig/Likhachev D* Lite: g(s), rhs(s), lexicographic keys and lazy heap invalidation.
function keyBefore(a, b)
{
    return a.k1 < b.k1 || (a.k1 === b.k1 && a.k2 < b.k2);
}

export class DStarLite
{
    constructor(dem, start, goal, options = {})
    {
        this.graph = new GridGraph(dem, options);
        this.start = this.graph.cell(start);
        this.goal = this.graph.cell(goal);
        this.km = 0;
        this.g = new Float64Array(this.graph.size);
        this.rhs = new Float64Array(this.graph.size);
        this.g.fill(Infinity);
        this.rhs.fill(Infinity);
        this.heap = new KeyHeap();
        this.open = new Map();
        this.expanded = 0;

        if (this.start < 0 || this.goal < 0 || !this.graph.allowed(this.start) || !this.graph.allowed(this.goal))
        {
            throw new Error("D* Lite endpoints must be inside valid, unexcluded DEM cells.");
        }

        this.rhs[this.goal] = 0;
        this.enqueue(this.goal);
    }

    key(index)
    {
        const m = Math.min(this.g[index], this.rhs[index]);
        return { index, k1: m + this.graph.distance(this.start, index) + this.km, k2: m };
    }

    enqueue(index)
    {
        const item = this.key(index);
        this.open.set(index, item);
        this.heap.push(item);
    }

    validTop()
    {
        while (this.heap.size)
        {
            const value = this.heap.items[0];

            if (this.open.get(value.index) === value)
            {
                return value;
            }

            this.heap.pop();
        }

        return { index: -1, k1: Infinity, k2: Infinity };
    }

    updateVertex(index)
    {
        if (index !== this.goal)
        {
            let best = Infinity;

            if (this.graph.allowed(index))
            {
                for (const next of this.graph.neighbors(index))
                {
                    const edge = this.graph.edge(index, next);
                    best = Math.min(best, (edge?.cost ?? Infinity) + this.g[next]);
                }
            }

            this.rhs[index] = best;
        }

        this.open.delete(index);

        if (this.g[index] !== this.rhs[index])
        {
            this.enqueue(index);
        }
    }

    compute(maxExpansions = 350000)
    {
        if (!this.graph.allowed(this.start) || !this.graph.allowed(this.goal))
        {
            return { ok: false, reason: "Endpoint falls inside the exclusion or NoData area.", expanded: 0 };
        }

        let expanded = 0;

        while (keyBefore(this.validTop(), this.key(this.start)) || this.rhs[this.start] !== this.g[this.start])
        {
            if (++expanded > maxExpansions)
            {
                return { ok: false, reason: "D* Lite computational budget reached; no path is certified.", expanded };
            }

            const u = this.heap.pop();

            if (u.index < 0 || this.open.get(u.index) !== u)
            {
                continue;
            }

            this.open.delete(u.index);
            const freshKey = this.key(u.index);

            if (keyBefore(u, freshKey))
            {
                this.enqueue(u.index);
            }
            else if (this.g[u.index] > this.rhs[u.index])
            {
                this.g[u.index] = this.rhs[u.index];

                for (const predecessor of this.graph.neighbors(u.index))
                {
                    this.updateVertex(predecessor);
                }
            }
            else
            {
                this.g[u.index] = Infinity;
                this.updateVertex(u.index);

                for (const predecessor of this.graph.neighbors(u.index))
                {
                    this.updateVertex(predecessor);
                }
            }
        }

        this.expanded += expanded;

        if (!Number.isFinite(this.g[this.start]))
        {
            return { ok: false, reason: "No route through the current DEM and exclusion scenario.", expanded };
        }

        const cells = [this.start];
        const visited = new Set(cells);
        let distanceMeters = 0, ascentMeters = 0, costMeters = 0;

        while (cells.at(-1) !== this.goal)
        {
            const here = cells.at(-1);
            let next = -1, edgeChosen = null, bestCost = Infinity;

            for (const candidate of this.graph.neighbors(here))
            {
                const edge = this.graph.edge(here, candidate);
                const value = (edge?.cost ?? Infinity) + this.g[candidate];

                if (value < bestCost - 1e-8)
                {
                    next = candidate;
                    edgeChosen = edge;
                    bestCost = value;
                }
            }

            if (next < 0 || visited.has(next) || !Number.isFinite(bestCost))
            {
                return { ok: false, reason: "The incremental path is not consistent after model updates.", expanded };
            }

            cells.push(next);
            visited.add(next);
            distanceMeters += edgeChosen.length;
            ascentMeters += edgeChosen.ascent;
            costMeters += edgeChosen.cost;
        }

        return { ok: true, cells, points: cells.map(i => this.graph.positions[i]), distanceMeters, ascentMeters, costMeters, expanded, totalExpanded: this.expanded, method: "D* Lite incremental on 8-neighbor DEM (hypothetical terrain cost)" };
    }

    // A changed mask can affect edges incident to adjacent diagonal cells. Update the
    // two-cell neighborhood of every changed cell, not just the changed cell itself.
    updateExclusions(zones)
    {
        const changed = this.graph.setZones(zones);
        const affected = new Set();

        for (const index of changed)
        {
            const row = Math.floor(index / this.graph.width), col = index % this.graph.width;

            for (let dr = -2; dr <= 2; dr++)
            {
                for (let dc = -2; dc <= 2; dc++)
                {
                    const r = row + dr, c = col + dc;

                    if (r >= 0 && c >= 0 && r < this.graph.height && c < this.graph.width)
                    {
                        affected.add(r * this.graph.width + c);
                    }
                }
            }
        }

        for (const index of affected)
        {
            this.updateVertex(index);
        }

        // Goal becomes inconsistent with a blocked cell and must be reset to its
        // original rhs=0 only when it is again accessible.
        return { changedCells: changed.length, reprocessedVertices: affected.size };
    }
}
