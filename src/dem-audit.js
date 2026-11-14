import { gridCoordinate } from "./terrain.js";
import { sampleElevationBilinear } from "./terrain-intelligence.js";

const RAD = Math.PI / 180;
const MARS_RADIUS = 3396190;

export function auditDemMetadata(dem)
{
    const valid = dem.elevations.filter(Number.isFinite).length;
    const centerLat = (dem.north - (dem.height - 1) * dem.latStep / 2) * RAD;
    const eastPostingMeters = MARS_RADIUS * Math.cos(centerLat) * dem.lonStep * RAD;
    const northPostingMeters = MARS_RADIUS * dem.latStep * RAD;
    const notes = [
        "DEM posting is not the independently verified effective terrain-detail resolution.",
        "The 20 m CTX posting is not a 20 m rock-detection or safe-gradient guarantee.",
        "A valid elevation value alone does not certify registration, error variance or traversability."
    ];

    if (!dem.verticalDatum || dem.verticalDatum === "Not specified")
    {
        notes.push("Vertical reference not documented; refuse meaningful height-offset comparison.");
    }

    if (valid !== dem.elevations.length)
    {
        notes.push("NoData cells must be excluded from all comparisons and routes.");
    }

    return { source: dem.source, width: dem.width, height: dem.height, validCells: valid, totalCells: dem.elevations.length, coverageFraction: valid / dem.elevations.length, eastPostingMeters, northPostingMeters, horizontalDatum: dem.horizontalDatum, verticalDatum: dem.verticalDatum, notes, referenceComparisonAvailable: false };
}

export function compareAlignedDems(primary, reference, options = {})
{
    if (!primary?.source || !reference?.source || primary.source === reference.source)
    {
        throw new Error("Two independently sourced DEMs are required; comparing the DEM to itself does not measure accuracy.");
    }

    if (!primary.horizontalDatum || !reference.horizontalDatum || primary.horizontalDatum === "Not specified" || reference.horizontalDatum === "Not specified" || primary.horizontalDatum !== reference.horizontalDatum)
    {
        throw new Error("Matching, explicitly documented horizontal reference systems are required before an elevation comparison.");
    }

    if (!primary.verticalDatum || !reference.verticalDatum || primary.verticalDatum === "Not specified" || reference.verticalDatum === "Not specified" || primary.verticalDatum !== reference.verticalDatum)
    {
        throw new Error("Matching vertical datums are required; no implicit height-shift conversion is permitted.");
    }

    const stride = options.sampleStride ?? 2;
    const offsetLatDegrees = options.offsetLatDegrees ?? 0;
    const offsetLonDegrees = options.offsetLonDegrees ?? 0;

    if (!Number.isInteger(stride) || stride < 1 || stride > 20 || !Number.isFinite(offsetLatDegrees) || !Number.isFinite(offsetLonDegrees) || Math.abs(offsetLatDegrees) > 0.1 || Math.abs(offsetLonDegrees) > 0.1)
    {
        throw new Error("DEM sampling step or test alignment offset is invalid.");
    }

    let count = 0, sum = 0, sumSq = 0, absSum = 0, sumHeight = 0, residualMin = Infinity, residualMax = -Infinity;

    for (let row = 0; row < primary.height; row += stride)
    {
        for (let col = 0; col < primary.width; col += stride)
        {
            const value = primary.elevations[row * primary.width + col];

            if (!Number.isFinite(value))
            {
                continue;
            }

            const point = gridCoordinate(primary, row, col);
            const compared = sampleElevationBilinear(reference, { lat: point.lat + offsetLatDegrees, lon: point.lon + offsetLonDegrees });

            if (!Number.isFinite(compared))
            {
                continue;
            }

            const delta = value - compared;
            count++;
            sum += delta;
            sumSq += delta * delta;
            absSum += Math.abs(delta);
            sumHeight += value;
            residualMin = Math.min(residualMin, delta);
            residualMax = Math.max(residualMax, delta);
        }
    }

    if (count < 10)
    {
        return { ok: false, count, reason: "At least 10 paired elevations are required. Check overlapping coverage, NoData, projection and datums." };
    }

    const biasMeters = sum / count;
    const scatterMeters = Math.sqrt(Math.max(0, sumSq / count - biasMeters ** 2));

    return {
        ok: true, pairedSamples: count, biasMeters,
        rmsDifferenceMeters: Math.sqrt(sumSq / count),
        residualScatterMeters: scatterMeters,
        meanAbsoluteDifferenceMeters: absSum / count,
        residualMinMeters: residualMin, residualMaxMeters: residualMax,
        meanPrimaryElevationMeters: sumHeight / count,
        comparisonMethod: "Sample primary grid in geographic Mars coordinates; bilinear interpolate independently sourced reference with matching declared datums.",
        caveat: "Paired residuals include both products' errors and possible spatial registration and spatial correlation. They do NOT give the accuracy of either DEM alone, or independent samples for a statistical confidence interval."
    };
}

// Normal-normal posterior for a *mean offset only*, conditional on effective
// independent-sample count and an externally justified measurement variance.
// Spatially correlated DEM pixels are never implicitly counted as independent.
export function posteriorVerticalBias(sampleMeanMeters, options = {})
{
    const { priorMeanMeters, priorStdMeters, observationStdMeters, effectiveIndependentSamples } = options;

    if (![sampleMeanMeters, priorMeanMeters, priorStdMeters, observationStdMeters, effectiveIndependentSamples].every(Number.isFinite) || priorStdMeters <= 0 || observationStdMeters <= 0 || effectiveIndependentSamples < 1 || !Number.isInteger(effectiveIndependentSamples))
    {
        throw new Error("Bayesian bias needs a justified Gaussian prior, observation standard deviation and effective independent-sample count. No default uncertainty is fabricated.");
    }

    const priorPrecision = 1 / priorStdMeters ** 2;
    const dataPrecision = effectiveIndependentSamples / observationStdMeters ** 2;
    const posteriorVariance = 1 / (priorPrecision + dataPrecision);
    const mean = posteriorVariance * (priorMeanMeters * priorPrecision + sampleMeanMeters * dataPrecision);
    const sd = Math.sqrt(posteriorVariance);

    return { posteriorMeanMeters: mean, posteriorStdMeters: sd, conditionalInterval95Meters: [mean - 1.95996398454 * sd, mean + 1.95996398454 * sd], caveat: "Conditional Gaussian posterior given user-supplied prior, observation variance and effective independent sample count; not an independently calibrated NASA vertical error." };
}
