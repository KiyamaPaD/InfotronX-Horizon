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

export function buildAssistantView(facts, topic = "overview")
{
    const distance = value => value >= 1000 ? (value / 1000).toFixed(2) + ' km' : Math.round(value) + ' m';
    if (topic === 'terrain')
    {
        return facts.hasNumericDem ? {
            metrics:[{label:'Waypoints sampled',value:facts.demCoveredWaypoints + '/' + facts.waypointCount},
                {label:'Saved max. grade',value:facts.modeledMaxGradePercent === null ? '—' : facts.modeledMaxGradePercent.toFixed(1) + '%'}],
            source:facts.demSource,
            note:'Samples cover waypoint positions. Check the elevation profile for gaps along the route.'
        } : { metrics:[], note:'Load Jezero elevation data in Terrain to inspect this route.' };
    }
    if (topic === 'compare')
    {
        const routes = facts.alternatives.filter(route => route.waypointCount >= 2).sort((a,b) => a.distanceMeters - b.distanceMeters);
        return { metrics:[], routes:routes.map(route => ({index:route.index,value:distance(route.distanceMeters)})),
            note:routes.length < 2 ? 'Add another route with two waypoints to compare distances.' : 'Ordered by waypoint distance. Terrain cost and traversability may differ.' };
    }
    if (topic === 'resources')
    {
        if (facts.waypointCount < 2) return { metrics:[], note:'Add two waypoints to estimate travel resources.' };
        const s = facts.resourceScenario;
        const minutes = Math.round(s.durationHours * 60);
        return { metrics:[{label:'Duration',value:Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm'},
            {label:'Oxygen',value:s.oxygenKg.toFixed(3) + ' kg'}, {label:'Energy',value:Math.round(s.batteryWh) + ' Wh'}],
            note:'Scenario at ' + s.speedKmh + ' km/h, ' + (s.retraceReturn ? 'including return.' : 'one way.') + ' Estimates exclude terrain effects.' };
    }
    return { metrics:[{label:'Distance',value:distance(facts.horizontalDistanceMeters)},
        {label:'Waypoints',value:String(facts.waypointCount)}, {label:'Routes',value:String(facts.routeCount)},
        {label:'Field notes',value:String(facts.observationCount)}],
        note:facts.waypointCount < 2 ? 'Choose at least two waypoints to start your route.' : 'Distances follow your waypoints on a spherical Mars model.' };
}
