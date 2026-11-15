import { explainTerrainRouteChoice, routeCostBreakdown } from "./route-decision.js";

const literal = value => String(value ?? "").replace(/[\r\n\t|<>\\`]/g, " ").trim().slice(0, 180);
const decimal = value => Number(value).toFixed(3);

function coordinate(value)
{
    if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lon))
    {
        throw new Error("Route evidence requires valid numeric Mars waypoint coordinates.");
    }

    return decimal(value.lat) + "° N, " + decimal(value.lon) + "° E";
}

export function createScientificComparisonReport({
    mission, route, dem, candidates, maxSlopePercent, exclusionZones = [], preference = "balanced"
})
{
    if (!mission?.title || !route?.name || !Array.isArray(route.points) || route.points.length < 2 ||
        !dem || !Array.isArray(candidates) || candidates.length < 1 ||
        !Number.isFinite(maxSlopePercent) || maxSlopePercent < 1 || maxSlopePercent > 100 ||
        !Array.isArray(exclusionZones))
    {
        throw new Error("Generate a route comparison from a loaded numeric DEM before exporting evidence.");
    }

    const decision = explainTerrainRouteChoice(candidates, preference);
    const lines = [
        "# MARS ATLAS — Scientific route comparison",
        "",
        "This is a reproducible snapshot of a user-selected mission analysis, not a NASA-certified traverse.",
        "",
        "## Mission and source",
        "",
        "- Mission: " + literal(mission.title),
        "- Manually selected route: " + literal(route.name),
        "- Numeric elevation source: " + literal(dem.source || "Not provided"),
        "- Origin: " + (dem.bundledSource ? "Bundled CTX-derived numeric Jezero sample" :
            "User-imported numeric DEM; provenance must be independently checked"),
        "- Grid: " + dem.width + " columns × " + dem.height + " rows",
        "- Geographic coordinates: planetocentric latitude, east-positive longitude (degrees)",
        "- Horizontal geometry: spherical Mars reference radius 3,396,190 m",
        "- Slope constraint: " + decimal(maxSlopePercent) + "% maximum modeled adjacent-cell grade",
        "- Objective: C = D + λ × (A + H), all terms expressed in model-cost meters",
        "- Interpretation: D is DEM-grid spherical horizontal path length; A is cumulative ascent; H is cumulative descent",
        "- Preference used for the ranking: " + literal(decision.preference) + " (λ = " + decision.slopePenalty + ")",
        "",
        "## Manually entered waypoint anchors",
        ""
    ];

    route.points.forEach((point, index) => lines.push(
        (index + 1) + ". " + literal(point.name || "Waypoint " + (index + 1)) + " — " + coordinate(point)
    ));

    lines.push("", "## What-if exclusions", "");

    if (exclusionZones.length)
    {
        exclusionZones.forEach((zone, index) =>
        {
            if (!Number.isFinite(zone.radiusMeters) || zone.radiusMeters < 1)
            {
                throw new Error("Exclusion evidence needs a valid radius.");
            }

            lines.push((index + 1) + ". " + literal(zone.title || "Illustrative exclusion") +
                " — " + coordinate(zone) + "; radius " + decimal(zone.radiusMeters) +
                " m; explicitly hypothetical, not a verified NASA hazard");
        });
    }
    else
    {
        lines.push("None; no hypothetical exclusion zone applied.");
    }

    lines.push("", "## Modeled candidates", "",
        "| Model candidate | Generation λ | Grid D (m) | Ascent A (m) | Descent H (m) | Cost at selected λ (model m) | Cost identity verified |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- |");

    for (const candidate of candidates)
    {
        if (!candidate.ok)
        {
            lines.push("| " + literal(candidate.label || candidate.id || "Unavailable") +
                " | — | — | — | — | — | Unavailable: " + literal(candidate.reason || "No feasible path") + " |");
            continue;
        }

        const own = routeCostBreakdown(candidate.stats, candidate.slopePenalty);
        const rank = routeCostBreakdown(candidate.stats, decision.slopePenalty);
        const stored = candidate.stats.costMeters;
        const consistent = Number.isFinite(stored) &&
            Math.abs(stored - own.costMeters) <= Math.max(1e-5, own.costMeters * 1e-9);
        lines.push("| " + literal(candidate.label || candidate.id) +
            " | " + candidate.slopePenalty + " | " + decimal(own.distanceMeters) +
            " | " + decimal(own.ascentMeters) + " | " + decimal(own.descentMeters) +
            " | " + decimal(rank.costMeters) + " | " + (consistent ? "YES" : "UNVERIFIED") + " |");
    }

    lines.push("", "## Decision", "",
        decision.explanation, "",
        "Selected modeled candidate IDs: " + (decision.winners.join(", ") || "None feasible"),
        "",
        "## Scientific scope and limitations", "",
        "- These are deterministic A* graph-model outputs from the stated DEM and user constraints.",
        "- The winner minimizes the cost only among the generated candidates under the selected objective.",
        "- The manually drawn waypoint polyline is distinct from any grid-following A* path.",
        "- Image mosaics and colors are NOT numerical elevation observations.",
        "- This comparison ignores fine rocks, soil mechanics, instrument limits, lighting, communication and actual EVA/rover safety.",
        "- A missing DEM value or a blocked route must not be replaced with invented terrain data.",
        "- Any resource/oxygen scenario in the app is hypothetical and is NOT NASA telemetry.",
        "- Software unit and browser tests do not establish field-operational validity.",
        "",
        "NASA / USGS dataset citation: https://doi.org/10.5066/P906QQT8",
        "MARS ATLAS source: https://github.com/KiyamaPaD/Mars-Atlas",
        "",
        "Generated from the current on-screen comparison. No generative AI score or safety approval was involved."
    );

    return lines.join("\n") + "\n";
}
