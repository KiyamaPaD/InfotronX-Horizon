import { isValidCoordinate, marsDistance } from "./geo.js";
import { planRouteOnDem } from "./terrain.js";
import { validateEvaAssumptions } from "./resources.js";

const STRATEGIES = Object.freeze([
    { id: "distance", label: "Shortest modeled", slopePenalty: 0 },
    { id: "balanced", label: "Balanced", slopePenalty: 6 },
    { id: "gentle", label: "Slope-conscious", slopePenalty: 24 }
]);

export function compareTerrainStrategies(dem, waypoints, options = {})
{
    const maxSlopePercent = options.maxSlopePercent ?? 18;
    const exclusionZones = options.exclusionZones ?? [];
    const maxWaypoints = options.maxWaypoints ?? 80;

    return STRATEGIES.map(strategy =>
    {
        const result = planRouteOnDem(dem, waypoints, { maxSlopePercent, slopePenalty: strategy.slopePenalty, exclusionZones, maxWaypoints });
        return { id: strategy.id, label: strategy.label, slopePenalty: strategy.slopePenalty, ...result };
    });
}

function randomGenerator(seed)
{
    let state = seed >>> 0;

    return () =>
    {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function percentile(values, fraction)
{
    const position = (values.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function summarize(values)
{
    values.sort((a, b) => a - b);
    return { p10: percentile(values, 0.1), median: percentile(values, 0.5), p90: percentile(values, 0.9) };
}

export function estimateResourceEnvelope(distanceMeters, assumptions = {}, options = {})
{
    const settings = validateEvaAssumptions(assumptions);
    const samples = options.samples ?? 500;
    const seed = options.seed ?? 2026;
    const variationPercent = options.variationPercent ?? 20;

    if (!Number.isFinite(distanceMeters) || distanceMeters < 0 || !Number.isInteger(samples) || samples < 1 || samples > 3000 || !Number.isSafeInteger(seed) || variationPercent < 0 || variationPercent > 60 || !Number.isFinite(variationPercent))
    {
        throw new Error("Invalid sensitivity scenario configuration.");
    }

    const random = randomGenerator(seed);
    const spread = variationPercent / 100;
    const duration = [];
    const oxygen = [];
    const battery = [];
    let overTime = 0;
    let overOxygen = 0;
    let overBattery = 0;
    let anyExceeded = 0;

    for (let i = 0; i < samples; i++)
    {
        const speed = settings.speedKmh * (1 + spread * (random() * 2 - 1));
        const oxygenRate = settings.oxygenKgPerHour * (1 + spread * (random() * 2 - 1));
        const batteryPower = settings.batteryWatts * (1 + spread * (random() * 2 - 1));
        const travelMeters = distanceMeters * (settings.retraceReturn ? 2 : 1);
        const hours = travelMeters / 1000 / speed + settings.observationMinutes / 60;
        const oxygenDemand = hours * oxygenRate;
        const batteryDemand = hours * batteryPower;
        const usableFraction = 1 - settings.reservePercent / 100;

        duration.push(hours);
        oxygen.push(oxygenDemand);
        battery.push(batteryDemand);
        const t = hours > settings.maxDurationHours * usableFraction;
        const o = oxygenDemand > settings.oxygenAvailableKg * usableFraction;
        const b = batteryDemand > settings.batteryAvailableWh * usableFraction;
        overTime += Number(t);
        overOxygen += Number(o);
        overBattery += Number(b);
        anyExceeded += Number(t || o || b);
    }

    return {
        samples,
        seed,
        variationPercent,
        durationHours: summarize(duration),
        oxygenKg: summarize(oxygen),
        batteryWh: summarize(battery),
        exceedanceFrequency: { time: overTime / samples, oxygen: overOxygen / samples, battery: overBattery / samples, any: anyExceeded / samples },
        disclaimer: "Artificial uniform parameter variation, not calibrated probabilities or astronaut safety confidence."
    };
}

export function measureRouteChange(reference, candidate)
{
    if (!Array.isArray(reference) || !Array.isArray(candidate)
        || reference.length < 2 || candidate.length < 2
        || !reference.every(isValidCoordinate) || !candidate.every(isValidCoordinate))
    {
        throw new Error("Route comparison requires two or more valid Martian coordinates per route.");
    }

    const length = points => points.slice(1).reduce((sum, point, i) => sum + marsDistance(points[i], point), 0);
    const referenceMeters = length(reference);
    const candidateMeters = length(candidate);

    return {
        referenceMeters,
        candidateMeters,
        differenceMeters: candidateMeters - referenceMeters,
        differencePercent: referenceMeters > 0 ? (candidateMeters - referenceMeters) / referenceMeters * 100 : null
    };
}
