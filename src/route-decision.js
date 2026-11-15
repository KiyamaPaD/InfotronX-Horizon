// Deterministic explanation of the A* model; no AI scores or invented terrain facts.
export const ROUTE_PREFERENCES = Object.freeze([
    { id: "distance", label: "Minimize grid distance", slopePenalty: 0 },
    { id: "balanced", label: "Balance distance and elevation change", slopePenalty: 6 },
    { id: "gentle", label: "Penalize elevation changes strongly", slopePenalty: 24 }
]);

function nonnegative(value)
{
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function routeCostBreakdown(stats, slopePenalty)
{
    if (!stats || ![stats.distanceMeters, stats.ascentMeters, stats.descentMeters].every(nonnegative) ||
        !nonnegative(slopePenalty) || slopePenalty > 100)
    {
        throw new Error("A* route cost needs finite, non-negative distance, elevation changes and penalty.");
    }

    const verticalMeters = stats.ascentMeters + stats.descentMeters;
    const penaltyMeters = slopePenalty * verticalMeters;

    return {
        distanceMeters: stats.distanceMeters,
        ascentMeters: stats.ascentMeters,
        descentMeters: stats.descentMeters,
        verticalMeters,
        slopePenalty,
        penaltyMeters,
        costMeters: stats.distanceMeters + penaltyMeters
    };
}

function dominates(candidate, alternative, tolerance = 1e-7)
{
    const distanceBetter = candidate.distanceMeters <= alternative.distanceMeters + tolerance;
    const verticalBetter = candidate.verticalMeters <= alternative.verticalMeters + tolerance;
    const strictlyBetter = candidate.distanceMeters < alternative.distanceMeters - tolerance ||
        candidate.verticalMeters < alternative.verticalMeters - tolerance;

    return distanceBetter && verticalBetter && strictlyBetter;
}

export function explainTerrainRouteChoice(candidates, preference = "balanced")
{
    const mode = ROUTE_PREFERENCES.find(item => item.id === preference) || ROUTE_PREFERENCES[1];

    if (!Array.isArray(candidates))
    {
        throw new Error("Candidate routes must be an array.");
    }

    const rejected = [];
    const alternatives = [];

    for (const item of candidates)
    {
        if (!item?.ok)
        {
            rejected.push({ id: String(item?.id || ""), label: String(item?.label || "Unavailable"),
                reason: String(item?.reason || "No feasible modeled path") });
            continue;
        }

        const ownPenalty = Number(item.slopePenalty);
        const own = routeCostBreakdown(item.stats, ownPenalty);
        const selected = routeCostBreakdown(item.stats, mode.slopePenalty);
        const reported = item.stats.costMeters;
        const verifiedCost = nonnegative(reported) ?
            Math.abs(own.costMeters - reported) <= Math.max(1e-5, 1e-9 * own.costMeters) : null;

        alternatives.push({
            id: String(item.id || ""), label: String(item.label || "Route candidate"),
            distanceMeters: own.distanceMeters,
            ascentMeters: own.ascentMeters,
            descentMeters: own.descentMeters,
            verticalMeters: own.verticalMeters,
            maxGradePercent: Number.isFinite(item.stats.maxGradePercent) ? item.stats.maxGradePercent : null,
            visited: Number.isFinite(item.stats.visited) ? item.stats.visited : null,
            generatingPenalty: ownPenalty,
            generatingCostMeters: own.costMeters,
            reportedCostMeters: nonnegative(reported) ? reported : null,
            costConsistent: verifiedCost,
            costMeters: selected.costMeters,
            penaltyMeters: selected.penaltyMeters,
            onFrontier: false
        });
    }

    if (!alternatives.length)
    {
        return {
            preference: mode.id, slopePenalty: mode.slopePenalty,
            alternatives: [], rejected, winners: [], equivalent: false,
            explanation: "No feasible A* candidate was found for the DEM and selected constraints. No optimal route can be claimed."
        };
    }

    for (const target of alternatives)
    {
        target.onFrontier = !alternatives.some(other => other !== target && dominates(other, target));
    }

    const minimum = Math.min(...alternatives.map(item => item.costMeters));
    const tolerance = Math.max(1e-5, 1e-9 * Math.max(1, minimum));
    const winners = alternatives.filter(item => Math.abs(item.costMeters - minimum) <= tolerance).map(item => item.id);
    const selected = alternatives.find(item => item.id === winners[0]);
    const equivalent = alternatives.every(item =>
        Math.abs(item.distanceMeters - selected.distanceMeters) <= tolerance &&
        Math.abs(item.verticalMeters - selected.verticalMeters) <= tolerance);

    const explanation = equivalent
        ? "The available strategies produce equivalent distance and elevation-change results. The data do not justify calling one safer or better."
        : winners.length > 1
            ? "Multiple A* candidates have the same minimum cost under this preference; no unique winner is justified."
            : "Under the chosen model preference, " + selected.label +
              " minimizes the cost among these computed candidates. The cost is grid distance plus " +
              mode.slopePenalty + " times cumulative absolute height change.";

    return {
        preference: mode.id,
        slopePenalty: mode.slopePenalty,
        alternatives,
        rejected,
        winners,
        equivalent,
        explanation,
        warning: "An A* optimum is defined only for this numeric DEM grid, waypoint anchors, slope threshold and hypothetical exclusions. It is NOT a NASA-certified safe route."
    };
}
