import { analyzeRoute } from "./geo.js";
import { sampleElevation } from "./terrain.js";

export function buildMissionFacts(mission, dem = null)
{
    if (!mission || !Array.isArray(mission.routes))
    {
        throw new Error("A mission is required.");
    }

    const route = mission.routes.find(item => item.id === mission.activeRouteId) || mission.routes[0];
    const points = Array.isArray(route?.points) ? route.points : [];
    const summary = analyzeRoute(points);
    const terrain = route?.terrainModel || null;
    let coveredWaypoints = null;

    if (dem)
    {
        coveredWaypoints = points.filter(point => sampleElevation(dem,point) !== null).length;
    }

    return {
        routeCount: mission.routes.length,
        waypointCount: points.length,
        observationCount: Array.isArray(mission.observations) ? mission.observations.length : 0,
        horizontalDistanceMeters: Math.round(summary.totalDistance * 100) / 100,
        hasNumericDem: Boolean(dem),
        demSource: typeof dem?.source === "string" ? dem.source.slice(0,160) : null,
        demCoveredWaypoints: coveredWaypoints,
        modeledGridDistanceMeters: Number.isFinite(terrain?.stats?.distanceMeters) ?
            Math.round(terrain.stats.distanceMeters * 100) / 100 : null,
        modeledMaxGradePercent: Number.isFinite(terrain?.stats?.maxGradePercent) ?
            Math.round(terrain.stats.maxGradePercent * 100) / 100 : null,
        terrainModelUnverified: true
    };
}

export function localMissionExplanation(facts)
{
    const lines = [
        "DETERMINISTIC MISSION ANALYSIS — not generative AI",
        "",
        "Routes: " + facts.routeCount + " · Active waypoints: " + facts.waypointCount +
            " · User notes: " + facts.observationCount,
        "Manual spherical route distance: " + facts.horizontalDistanceMeters.toFixed(2) + " m."
    ];

    if (facts.waypointCount < 2)
    {
        lines.push("Add at least two manually controlled waypoints before comparing routes.");
    }

    if (!facts.hasNumericDem)
    {
        lines.push("Numeric DEM not loaded. Altitudes, slopes and terrain safety cannot be derived from the imagery.");
    }
    else
    {
        lines.push("Numeric DEM source: " + facts.demSource + ". " +
            facts.demCoveredWaypoints + "/" + facts.waypointCount + " waypoint positions have valid DEM samples.");
    }

    if (facts.modeledGridDistanceMeters !== null)
    {
        lines.push("Saved A* grid route length: " + facts.modeledGridDistanceMeters.toFixed(2) +
            " m; maximum adjacent-cell grade: " +
            (facts.modeledMaxGradePercent === null ? "not recorded" : facts.modeledMaxGradePercent.toFixed(2) + "%") + ".");
        lines.push("This is a stored model result, not a revalidation after edits.");
    }

    lines.push("An optimal cost inside a DEM grid does not prove physical rover or astronaut safety.");
    lines.push("All edits, sharing and exporting remain under manual user control.");
    return lines.join("\n");
}

export function normalizeCopilotQuestion(value)
{
    const text = String(value || "").trim();

    if (!text || text.length > 240)
    {
        throw new Error("Write a question between 1 and 240 characters.");
    }

    return text;
}
