import { marsDistance } from "./geo.js";
import { calculateGrade, sampleElevation } from "./terrain.js";

const validHeight = value => typeof value === "number" && Number.isFinite(value);

export function summarizeTerrainProfile(dem, points, profile)
{
    const samples = Array.isArray(profile?.samples) ? profile.samples : [];
    const known = samples.filter(sample => validHeight(sample.elevationMeters));
    let ascentMeters = 0;
    let descentMeters = 0;
    let observedDistanceMeters = 0;
    let maxAbsoluteGradePercent = null;
    let gradeMeasurements = 0;

    for (let index = 1; index < samples.length; index++)
    {
        const previous = samples[index - 1];
        const current = samples[index];
        const distance = current.distanceMeters - previous.distanceMeters;

        if (!validHeight(previous.elevationMeters) || !validHeight(current.elevationMeters) || distance <= 0)
        {
            continue;
        }

        const change = current.elevationMeters - previous.elevationMeters;
        ascentMeters += Math.max(0, change);
        descentMeters += Math.max(0, -change);
        observedDistanceMeters += distance;
        const grade = calculateGrade(previous.elevationMeters, current.elevationMeters, distance);

        if (grade !== null)
        {
            gradeMeasurements++;
            maxAbsoluteGradePercent = Math.max(maxAbsoluteGradePercent ?? 0, Math.abs(grade));
        }
    }

    let cumulativeDistance = 0;
    const waypoints = (Array.isArray(points) ? points : []).map((point, index) =>
    {
        const previous = points[index - 1];
        const segmentMeters = index && previous ? marsDistance(previous, point) : 0;
        cumulativeDistance += segmentMeters;
        const elevationMeters = sampleElevation(dem, point);
        const previousElevation = previous ? sampleElevation(dem, previous) : null;
        const changeMeters = validHeight(elevationMeters) && validHeight(previousElevation)
            ? elevationMeters - previousElevation : null;
        const meanGradePercent = changeMeters !== null && segmentMeters > 0
            ? changeMeters / segmentMeters * 100 : null;

        return {
            id: point.id || String(index),
            name: String(point.name || "").trim() || `Waypoint ${index + 1}`,
            lat: point.lat, lon: point.lon, distanceMeters: cumulativeDistance,
            segmentMeters, elevationMeters, changeMeters, meanGradePercent
        };
    });

    return {
        sampleCount: samples.length,
        knownCount: known.length,
        coverageFraction: samples.length ? known.length / samples.length : 0,
        complete: Boolean(samples.length && known.length === samples.length),
        totalDistanceMeters: samples.at(-1)?.distanceMeters ?? 0,
        observedDistanceMeters,
        minimumElevationMeters: known.length ? known.reduce((value, sample) => Math.min(value, sample.elevationMeters), Infinity) : null,
        maximumElevationMeters: known.length ? known.reduce((value, sample) => Math.max(value, sample.elevationMeters), -Infinity) : null,
        ascentMeters: known.length ? ascentMeters : null,
        descentMeters: known.length ? descentMeters : null,
        maxAbsoluteGradePercent,
        gradeMeasurements,
        waypoints
    };
}

export function nearestSampleIndex(samples, distanceMeters)
{
    if (!Array.isArray(samples) || !samples.length || !Number.isFinite(distanceMeters))
    {
        return -1;
    }

    let low = 0;
    let high = samples.length - 1;

    while (low < high)
    {
        const mid = Math.floor((low + high) / 2);

        if (samples[mid].distanceMeters < distanceMeters)
        {
            low = mid + 1;
        }
        else
        {
            high = mid;
        }
    }

    if (low > 0 && Math.abs(samples[low - 1].distanceMeters - distanceMeters) <=
        Math.abs(samples[low].distanceMeters - distanceMeters))
    {
        return low - 1;
    }

    return low;
}

export function profileSvgPaths(samples, maximumVertices = 420)
{
    if (!Array.isArray(samples) || !samples.length)
    {
        return [];
    }

    const known = samples.filter(sample => validHeight(sample.elevationMeters));

    if (!known.length)
    {
        return [];
    }

    const minimum = known.reduce((value, sample) => Math.min(value, sample.elevationMeters), Infinity);
    const maximum = known.reduce((value, sample) => Math.max(value, sample.elevationMeters), -Infinity);
    const heightSpan = Math.max(1, maximum - minimum);
    const distanceSpan = Math.max(1, samples.at(-1).distanceMeters);
    const lines = [];
    let run = [];

    function pushRun()
    {
        if (!run.length)
        {
            return;
        }

        const stride = Math.max(1, Math.ceil(run.length / Math.max(2, maximumVertices)));
        const chosen = run.filter((_, index) => index === 0 || index === run.length - 1 || index % stride === 0);
        lines.push(chosen.map((sample, index) =>
        {
            const x = 16 + sample.distanceMeters / distanceSpan * 288;
            const y = 121 - (sample.elevationMeters - minimum) / heightSpan * 94;
            return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" "));
        run = [];
    }

    for (const sample of samples)
    {
        if (validHeight(sample.elevationMeters))
        {
            run.push(sample);
        }
        else
        {
            pushRun();
        }
    }

    pushRun();
    return lines;
}
