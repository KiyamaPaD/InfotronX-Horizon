import { marsDistance } from "./geo.js";
import { calculateGrade, gridCellForPoint, gridCoordinate, makeExclusionMask } from "./terrain.js";

const STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

export class GridGraph
{
    constructor(dem, options = {})
    {
        this.dem = dem;
        this.width = dem.width;
        this.height = dem.height;
        this.size = dem.width * dem.height;
        this.maxSlopePercent = options.maxSlopePercent ?? 18;
        this.slopePenalty = options.slopePenalty ?? 6;

        if (!(this.maxSlopePercent > 0 && this.maxSlopePercent <= 100) || !(this.slopePenalty >= 0 && this.slopePenalty <= 100))
        {
            throw new Error("Slope model requires a grade threshold (0,100] and penalty [0,100].");
        }

        this.positions = Array.from({ length: this.size }, (_, i) => gridCoordinate(dem, Math.floor(i / this.width), i % this.width));
        this.blocked = makeExclusionMask(dem, options.exclusionZones ?? [], this.positions);
    }

    cell(point)
    {
        return gridCellForPoint(this.dem, point);
    }

    allowed(index)
    {
        return index >= 0 && index < this.size && Number.isFinite(this.dem.elevations[index]) && !this.blocked[index];
    }

    neighbors(index)
    {
        const row = Math.floor(index / this.width);
        const col = index % this.width;
        const result = [];

        for (const [dr, dc] of STEPS)
        {
            const nr = row + dr;
            const nc = col + dc;

            if (nr < 0 || nc < 0 || nr >= this.height || nc >= this.width)
            {
                continue;
            }

            const next = nr * this.width + nc;

            if (dr && dc && (!this.allowed(row * this.width + nc) || !this.allowed(nr * this.width + col)))
            {
                continue;
            }

            result.push(next);
        }

        return result;
    }

    edge(a, b)
    {
        if (!this.allowed(a) || !this.allowed(b))
        {
            return null;
        }

        const ar = Math.floor(a / this.width), ac = a % this.width;
        const br = Math.floor(b / this.width), bc = b % this.width;

        if (Math.abs(ar - br) > 1 || Math.abs(ac - bc) > 1 || a === b)
        {
            return null;
        }

        if (ar !== br && ac !== bc && (!this.allowed(ar * this.width + bc) || !this.allowed(br * this.width + ac)))
        {
            return null;
        }

        const length = marsDistance(this.positions[a], this.positions[b]);
        const rise = this.dem.elevations[b] - this.dem.elevations[a];
        const grade = calculateGrade(this.dem.elevations[a], this.dem.elevations[b], length);

        if (grade === null || Math.abs(grade) > this.maxSlopePercent)
        {
            return null;
        }

        return { length, ascent: Math.max(0, rise), descent: Math.max(0, -rise), grade, cost: length * (1 + this.slopePenalty * Math.abs(grade) / 100) };
    }

    distance(a, b)
    {
        return marsDistance(this.positions[a], this.positions[b]);
    }

    setZones(zones)
    {
        const previous = this.blocked;
        const next = makeExclusionMask(this.dem, zones, this.positions);
        const changes = [];

        for (let i = 0; i < this.size; i++)
        {
            if (previous[i] !== next[i])
            {
                changes.push(i);
            }
        }

        this.blocked = next;
        return changes;
    }
}

export class KeyHeap
{
    constructor()
    {
        this.items = [];
    }

    static compare(a, b)
    {
        if (a.k1 !== b.k1)
        {
            return a.k1 < b.k1 ? -1 : 1;
        }

        if (a.k2 !== b.k2)
        {
            return a.k2 < b.k2 ? -1 : 1;
        }

        return a.index - b.index;
    }

    push(item)
    {
        const a = this.items;
        let i = a.length;
        a.push(item);

        while (i > 0)
        {
            const p = (i - 1) >> 1;

            if (KeyHeap.compare(a[p], item) <= 0)
            {
                break;
            }

            a[i] = a[p];
            i = p;
        }

        a[i] = item;
    }

    pop()
    {
        const a = this.items;
        const first = a[0];
        const last = a.pop();

        if (!a.length)
        {
            return first;
        }

        let i = 0;

        while (i * 2 + 1 < a.length)
        {
            let child = i * 2 + 1;

            if (child + 1 < a.length && KeyHeap.compare(a[child + 1], a[child]) < 0)
            {
                child++;
            }

            if (KeyHeap.compare(a[child], last) >= 0)
            {
                break;
            }

            a[i] = a[child];
            i = child;
        }

        a[i] = last;
        return first;
    }

    get size()
    {
        return this.items.length;
    }
}

// Remove intermediate grid cells only when the direction of movement remains
// unchanged. Straight runs retain exactly the same geometric path.
export function compactGridPath(cells, width)
{
    if (cells.length <= 2)
    {
        return cells.slice();
    }

    const result = [cells[0]];

    for (let i = 1; i < cells.length - 1; i++)
    {
        const prev = cells[i - 1], now = cells[i], next = cells[i + 1];
        const a = [Math.sign(Math.floor(now / width) - Math.floor(prev / width)), Math.sign(now % width - prev % width)];
        const b = [Math.sign(Math.floor(next / width) - Math.floor(now / width)), Math.sign(next % width - now % width)];

        if (a[0] !== b[0] || a[1] !== b[1])
        {
            result.push(now);
        }
    }

    result.push(cells.at(-1));
    return result;
}
