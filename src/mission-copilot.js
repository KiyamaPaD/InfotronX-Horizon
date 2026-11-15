import { analyzeRoute } from "./geo.js";
import { estimateMarswalk } from "./resources.js";
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
        alternatives: mission.routes.slice(0,15).map((item, index) => ({
            index:index + 1,
            waypointCount:item.points.length,
            distanceMeters:Math.round(analyzeRoute(item.points).totalDistance * 100) / 100
        })),
        resourceScenario: (() =>
        {
            const estimate = estimateMarswalk(summary.totalDistance, mission.evaScenario || {});
            return { durationHours:estimate.durationHours, oxygenKg:estimate.oxygenKg,
                batteryWh:estimate.batteryWh, retraceReturn:estimate.assumptions.retraceReturn,
                speedKmh:estimate.assumptions.speedKmh, illustrative:true };
        })(),
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
        const populated = (facts.alternatives || []).filter(item => item.waypointCount >= 2).length;
        lines.push(populated
            ? "The active route has fewer than two waypoints. Another saved route has data: select it in Route Planner before running analysis."
            : "Add at least two manually controlled waypoints before comparing routes.");
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

// Supported mission questions are answered from calculated facts, without a model or network.
export function localMissionAnswer(facts, question)
{
    const text = normalizeCopilotQuestion(question).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const label = 'LOCAL ANALYSIS · No AI model or external request\n\n';

    if (/\b(safe|safety|sigur|sigura|siguranta|pericol)\b/.test(text))
    {
        return label + 'These data cannot establish safe traversability. DEM models omit soil strength, rocks, wheel slip and current hazards. Exclusions are user assumptions. Inspect terrain evidence and model constraints before comparing candidates.';
    }

    if (/compar|alternativ|shortest|scurt/.test(text))
    {
        const routes = facts.alternatives.filter(item => item.waypointCount >= 2).sort((a,b) => a.distanceMeters - b.distanceMeters);
        if (routes.length < 2)
        {
            return label + 'At least two routes with two waypoints each are needed for a distance comparison. Create another route manually, or use Preview DEM route options. Empty routes are excluded.';
        }
        return label + routes.map(item => 'Route ' + item.index + ': ' + item.distanceMeters.toFixed(2) + ' m · ' + item.waypointCount + ' waypoints').join('\n') +
            '\n\nShortest waypoint polyline: route ' + routes[0].index + ' (ties may exist). This ranks spherical distance only. DEM-grid costs and physical traversability are separate questions.';
    }

    if (/terrain|elevation|slope|dem|teren|altitud|panta|pante/.test(text))
    {
        if (!facts.hasNumericDem)
        {
            return label + 'Load the numeric Jezero DEM in Terrain first. Satellite imagery supplies visual context; its colors do not provide numeric elevation. The bundled DEM covers a limited study area.';
        }
        return label + 'Elevation source: ' + facts.demSource + '.\n' + facts.demCoveredWaypoints + '/' + facts.waypointCount + ' waypoint positions have DEM samples. Coverage at the waypoints does not establish continuous coverage between them.\n' +
            (facts.modeledMaxGradePercent === null ? 'No saved routing-grade result is available for the active route. Open Terrain to inspect its profile or preview route options.' : 'Saved maximum adjacent-cell grade: ' + facts.modeledMaxGradePercent.toFixed(2) + '%. This stored model is unverified and does not certify safety.');
    }

    if (/resource|oxygen|oxigen|battery|bater|energy|energie|duration|durat|time|timp/.test(text))
    {
        if (facts.waypointCount < 2)
        {
            return label + 'Select a route with at least two waypoints before estimating travel resources. An empty route is not a completed zero-cost mission.';
        }
        const scenario = facts.resourceScenario;
        const minutes = Math.round(scenario.durationHours * 60);
        return label + 'Using your saved resource assumptions:\n' + Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm total · ' + scenario.oxygenKg.toFixed(3) + ' kg O₂ · ' + Math.round(scenario.batteryWh) + ' Wh.\n' +
            'Walking speed: ' + scenario.speedKmh + ' km/h; ' + (scenario.retraceReturn ? 'includes retracing the route to return.' : 'one-way travel.') +
            '\nThese are illustrative scenario estimates. They exclude terrain-dependent walking effects and are not measured suit telemetry.';
    }

    if (/route|mission|summar|overview|distance|ruta|rute|misiun|rezum|distanta/.test(text))
    {
        return localMissionExplanation(facts);
    }

    return label + 'I can explain route distance, compare alternatives, summarize terrain coverage and estimate resource scenarios. Try “Compare routes”, “Explain terrain” or “Estimate resources”. Free-form conversation requires a separate language model; this assistant uses local calculations.';
}
