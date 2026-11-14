import { marsDistance } from "./geo.js";
import { marsCellAreaSqMeters } from "./measure-theory.js";
import { validateEvaAssumptions } from "./resources.js";

const MAX_SAMPLES = 3000;

function checkSamples(samples)
{
    if (!Array.isArray(samples) || samples.length === 0 || samples.length > MAX_SAMPLES || !samples.every(Number.isFinite))
    {
        throw new Error("A nonempty sample array of finite values (maximum 3000) is required.");
    }

    return [...samples].sort((a, b) => a - b);
}

// Area-weighted hypsometry on the Mars reference sphere, not a rugged 3D surface integral.
export function analyzeHypsometry(dem, binCount = 12)
{
    if (!Number.isInteger(binCount) || binCount < 2 || binCount > 32)
    {
        throw new Error("Elevation histogram requires 2–32 bins.");
    }

    const samples = [];
    let totalAreaSqMeters = 0;
    let weightedHeight = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let row = 0; row < dem.height; row++)
    {
        const area = marsCellAreaSqMeters(dem, row);

        for (let col = 0; col < dem.width; col++)
        {
            const height = dem.elevations[row * dem.width + col];

            if (!Number.isFinite(height))
            {
                continue;
            }

            samples.push({ height, area });
            totalAreaSqMeters += area;
            weightedHeight += area * height;
            min = Math.min(min, height);
            max = Math.max(max, height);
        }
    }

    if (!samples.length)
    {
        throw new Error("No numeric DEM samples are available for elevation analysis.");
    }

    const span = Math.max(max - min, 1e-9);
    const bins = Array.from({ length: binCount }, (_, index) => ({
        lower: min + span * index / binCount,
        upper: min + span * (index + 1) / binCount,
        squareMeters: 0,
        count: 0,
        cumulativeAreaFraction: 0
    }));

    for (const sample of samples)
    {
        const index = Math.min(binCount - 1, Math.floor((sample.height - min) / span * binCount));
        bins[index].squareMeters += sample.area;
        bins[index].count++;
    }

    let runningArea = 0;

    for (const bin of bins)
    {
        runningArea += bin.squareMeters;
        bin.squareKilometers = bin.squareMeters / 1000000;
        bin.areaFraction = bin.squareMeters / totalAreaSqMeters;
        bin.cumulativeAreaFraction = runningArea / totalAreaSqMeters;
    }

    samples.sort((a, b) => a.height - b.height);
    let median = samples.at(-1).height;
    let cumulativeArea = 0;

    for (const sample of samples)
    {
        cumulativeArea += sample.area;

        if (cumulativeArea >= totalAreaSqMeters / 2)
        {
            median = sample.height;
            break;
        }
    }

    return {
        bins,
        totalAreaSqMeters,
        totalAreaSqKm: totalAreaSqMeters / 1000000,
        minElevationMeters: min,
        maxElevationMeters: max,
        areaWeightedMeanMeters: weightedHeight / totalAreaSqMeters,
        areaWeightedMedianMeters: median,
        validCells: samples.length,
        method: "Mars spherical reference-area weighted DEM hypsometry; sampled height bins, not continuous geological volume"
    };
}

function interpolateEdge(a, b, level)
{
    const t = (level - a.z) / (b.z - a.z);
    return { row: a.row + (b.row - a.row) * t, column: a.column + (b.column - a.column) * t };
}

function fractionalGeo(dem, point)
{
    return { lat: dem.north - point.row * dem.latStep, lon: dem.west + point.column * dem.lonStep };
}

// Marching Squares: fixed center-value tie rule for diagonal saddle ambiguity.
// Lines crossing NoData are deliberately omitted. Output consists of clipped segments.
export function marchingSquares(dem, elevationMeters, maxSegments = 100000)
{
    if (!Number.isFinite(elevationMeters) || !Number.isInteger(maxSegments) || maxSegments < 1 || maxSegments > 250000)
    {
        throw new Error("Invalid contour elevation or segment limit.");
    }

    const segments = [];
    let skippedNoDataCells = 0;
    let ambiguousCells = 0;
    let totalLengthMeters = 0;

    for (let row = 0; row < dem.height - 1; row++)
    {
        for (let col = 0; col < dem.width - 1; col++)
        {
            const index = row * dem.width + col;
            const z = [dem.elevations[index], dem.elevations[index + 1], dem.elevations[index + dem.width + 1], dem.elevations[index + dem.width]];

            if (!z.every(Number.isFinite))
            {
                skippedNoDataCells++;
                continue;
            }

            const corners = [
                { row, column: col, z: z[0] },
                { row, column: col + 1, z: z[1] },
                { row: row + 1, column: col + 1, z: z[2] },
                { row: row + 1, column: col, z: z[3] }
            ];
            const high = z.map(value => value >= elevationMeters);
            const crossed = [];

            for (let e = 0; e < 4; e++)
            {
                if (high[e] !== high[(e + 1) % 4])
                {
                    crossed.push(e);
                }
            }

            if (!crossed.length)
            {
                continue;
            }

            const edgePoint = e => interpolateEdge(corners[e], corners[(e + 1) % 4], elevationMeters);
            const pairs = [];

            if (crossed.length === 2)
            {
                pairs.push([crossed[0], crossed[1]]);
            }
            else if (crossed.length === 4)
            {
                ambiguousCells++;
                const centerHigh = z.reduce((total, value) => total + value, 0) / 4 >= elevationMeters;

                for (let corner = 0; corner < 4; corner++)
                {
                    if (high[corner] !== centerHigh)
                    {
                        pairs.push([(corner + 3) % 4, corner]);
                    }
                }
            }

            for (const [fromEdge, toEdge] of pairs)
            {
                const a = edgePoint(fromEdge);
                const b = edgePoint(toEdge);
                const lengthMeters = marsDistance(fractionalGeo(dem, a), fractionalGeo(dem, b));

                if (lengthMeters <= 1e-9)
                {
                    continue;
                }

                if (segments.length >= maxSegments)
                {
                    return { segments, totalLengthMeters, ambiguousCells, skippedNoDataCells, truncated: true, levelMeters: elevationMeters };
                }

                totalLengthMeters += lengthMeters;
                segments.push({ a, b, lengthMeters });
            }
        }
    }

    return { segments, totalLengthMeters, ambiguousCells, skippedNoDataCells, truncated: false, levelMeters: elevationMeters };
}

// Exact empirical expected shortfall: weighted average of the upper tail 1-alpha.
// Handles a fractional number of samples, unlike simply rounding tail length.
export function empiricalCvar(values, alpha = 0.9)
{
    const sorted = checkSamples(values);

    if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1)
    {
        throw new Error("CVaR confidence level must lie strictly between zero and one.");
    }

    const count = sorted.length;
    let remaining = (1 - alpha) * count;
    let weighted = 0;

    for (let i = count - 1; i >= 0 && remaining > 1e-11; i--)
    {
        const weight = Math.min(1, remaining);
        weighted += weight * sorted[i];
        remaining -= weight;
    }

    return { alpha, cvar: weighted / ((1 - alpha) * count), mean: sorted.reduce((total, v) => total + v, 0) / count, var: sorted[Math.max(0, Math.ceil(alpha * count) - 1)], samples: count };
}

// Exact 1D empirical Wasserstein-1 distance for potentially unequal sample counts.
// Integrates the absolute difference of empirical quantile functions.
export function empiricalWasserstein1(a, b)
{
    const left = checkSamples(a);
    const right = checkSamples(b);
    let i = 0;
    let j = 0;
    let previous = 0;
    let cost = 0;

    while (i < left.length && j < right.length)
    {
        const next = Math.min((i + 1) / left.length, (j + 1) / right.length);
        cost += Math.max(0, next - previous) * Math.abs(left[i] - right[j]);
        previous = next;

        if ((i + 1) / left.length <= next + 1e-12)
        {
            i++;
        }

        if ((j + 1) / right.length <= next + 1e-12)
        {
            j++;
        }
    }

    return cost;
}

function mulberry32(seed)
{
    let state = seed >>> 0;
    return () =>
    {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

// Both routes receive identical uniform perturbations (common random numbers).
// Monte Carlo input distributions are deliberately hypothetical.
export function compareResourceDistributions(distanceA, distanceB, settings = {}, options = {})
{
    if (![distanceA, distanceB].every(value => Number.isFinite(value) && value >= 0))
    {
        throw new Error("Route distances must be nonnegative finite meters.");
    }

    const assumptions = validateEvaAssumptions(settings);
    const samples = options.samples ?? 500;
    const seed = options.seed ?? 2026;
    const variationPercent = options.variationPercent ?? 20;
    const alpha = options.alpha ?? 0.9;

    if (!Number.isInteger(samples) || samples < 10 || samples > 3000 || !Number.isSafeInteger(seed) || !Number.isFinite(variationPercent) || variationPercent < 0 || variationPercent > 60)
    {
        throw new Error("Invalid distribution comparison configuration.");
    }

    const random = mulberry32(seed);
    const spread = variationPercent / 100;
    const result = { durationHours: [[], []], oxygenKg: [[], []], batteryWh: [[], []] };

    for (let i = 0; i < samples; i++)
    {
        const speed = assumptions.speedKmh * (1 + spread * (2 * random() - 1));
        const oxygenRate = assumptions.oxygenKgPerHour * (1 + spread * (2 * random() - 1));
        const batteryWatts = assumptions.batteryWatts * (1 + spread * (2 * random() - 1));

        for (const [index, meters] of [distanceA, distanceB].entries())
        {
            const hours = meters * (assumptions.retraceReturn ? 2 : 1) / 1000 / speed + assumptions.observationMinutes / 60;
            result.durationHours[index].push(hours);
            result.oxygenKg[index].push(hours * oxygenRate);
            result.batteryWh[index].push(hours * batteryWatts);
        }
    }

    const metrics = {};

    for (const [name, arrays] of Object.entries(result))
    {
        metrics[name] = {
            reference: empiricalCvar(arrays[0], alpha),
            alternative: empiricalCvar(arrays[1], alpha),
            wasserstein1: empiricalWasserstein1(arrays[0], arrays[1])
        };
    }

    return {
        metrics,
        seed,
        samples,
        alpha,
        variationPercent,
        distanceA,
        distanceB,
        caveat: "Synthetic independent uniform variations, paired across routes. CVaR and Wasserstein measure hypothetical resource distributions, NOT NASA-calibrated probabilities or EVA safety."
    };
}
