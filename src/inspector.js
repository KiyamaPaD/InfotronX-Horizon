import { JEZERO } from "./constants.js";
import { analyzeRoute, marsDistance } from "./geo.js";

const TO_RADIANS = Math.PI / 180;
const CORRIDOR_METERS = 500;
const LONG_SEGMENT_METERS = 3000;
const REGION_DISTANCE_METERS = 75000;

function normalizeLongitude(delta)
{
    return ((delta + 540) % 360) - 180;
}

function localMeters(point, origin)
{
    const meanLatitude = (point.lat + origin.lat) / 2 * TO_RADIANS;
    const radius = 3396190;

    return {
        x: normalizeLongitude(point.lon - origin.lon) * TO_RADIANS * radius * Math.cos(meanLatitude),
        y: (point.lat - origin.lat) * TO_RADIANS * radius
    };
}

export function distanceToRoute(point, points)
{
    if (!points.length)
    {
        return Infinity;
    }

    if (points.length === 1)
    {
        return marsDistance(point, points[0]);
    }

    let nearest = Infinity;

    for (let i = 1; i < points.length; i++)
    {
        const a = localMeters(points[i - 1], point);
        const b = localMeters(points[i], point);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const fraction = lengthSquared ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared)) : 0;
        const distance = Math.hypot(a.x + fraction * dx, a.y + fraction * dy);
        nearest = Math.min(nearest, distance);
    }

    return nearest;
}

export function inspectRoute(route, observations = [])
{
    const points = route.points || [];
    const analysis = analyzeRoute(points);
    const findings = [];

    if (points.length < 2)
    {
        findings.push({ severity: "notice", title: "Route is incomplete", detail: "Place at least two waypoints to define a route." });
    }

    const duplicates = analysis.segments.filter(segment => segment.distance < 3);

    if (duplicates.length)
    {
        findings.push({ severity: "warning", title: "Repeated waypoints", detail: `${duplicates.length} segment(s) shorter than 3 m. Review overlapping points.` });
    }

    const longSegments = analysis.segments.filter(segment => segment.distance > LONG_SEGMENT_METERS);

    if (longSegments.length)
    {
        findings.push({ severity: "warning", title: "Long unverified segments", detail: `${longSegments.length} segment(s) exceed 3 km between waypoints. Consider adding inspection points. This is a planning heuristic, not a NASA safety limit.` });
    }

    if (points.some(point => marsDistance(point, JEZERO) > REGION_DISTANCE_METERS))
    {
        findings.push({ severity: "notice", title: "Outside local study area", detail: "At least one waypoint is over 75 km from the Jezero reference location. Check the selected NASA layer coverage." });
    }

    const nearby = observations.map(observation => ({
        observation,
        distance: distanceToRoute(observation, points)
    })).filter(entry => entry.distance <= CORRIDOR_METERS).sort((a, b) => a.distance - b.distance);

    if (!nearby.length && points.length >= 2)
    {
        findings.push({ severity: "notice", title: "No nearby field notes", detail: "No saved user observations lie within 500 m of this planned path." });
    }

    if (points.length >= 2)
    {
        findings.push({ severity: "warning", title: "Terrain not validated", detail: "No numeric DEM, slope, soil or EVA resource model is connected. A plotted line is not proof of a traversable route." });
    }

    return {
        findings,
        nearby,
        longSegmentCount: longSegments.length,
        duplicateCount: duplicates.length,
        totalDistance: analysis.totalDistance,
        complete: points.length >= 2,
        evidenceValidated: false
    };
}
