import { MARS_RADIUS_METERS } from "./constants.js";

const TO_RADIANS = Math.PI / 180;

export function clamp(value, min, max)
{
    return Math.max(min, Math.min(max, value));
}

export function isValidCoordinate(point)
{
    return Number.isFinite(point?.lat) && Number.isFinite(point?.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

export function marsDistance(start, end)
{
    if (!isValidCoordinate(start) || !isValidCoordinate(end))
    {
        return 0;
    }

    const deltaLatitude = (end.lat - start.lat) * TO_RADIANS;
    const deltaLongitude = (end.lon - start.lon) * TO_RADIANS;
    const latitude1 = start.lat * TO_RADIANS;
    const latitude2 = end.lat * TO_RADIANS;
    const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;

    return 2 * MARS_RADIUS_METERS * Math.asin(Math.sqrt(clamp(a, 0, 1)));
}

export function analyzeRoute(points)
{
    const segments = [];
    let totalDistance = 0;

    for (let i = 1; i < points.length; i++)
    {
        const distance = marsDistance(points[i - 1], points[i]);
        totalDistance += distance;
        segments.push({ index: i, distance, cumulative: totalDistance });
    }

    return { totalDistance, segments, count: points.length };
}

export function formatDistance(meters)
{
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

export function formatCoordinate(value, axis)
{
    return `${Math.abs(value).toFixed(5)}° ${axis === "lat" ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W")}`;
}

export function project(point, zoom)
{
    const scale = 256 * 2 ** zoom;

    return { x: (point.lon + 180) / 360 * scale * 2, y: (90 - point.lat) / 180 * scale };
}

export function unproject(pixel, zoom)
{
    const scale = 256 * 2 ** zoom;

    return { lat: clamp(90 - pixel.y / scale * 180, -90, 90), lon: clamp(pixel.x / (scale * 2) * 360 - 180, -180, 180) };
}

export function generateDetour(points, distanceMeters = 180)
{
    if (points.length < 2)
    {
        return null;
    }

    let longestIndex = 1;
    let longestLength = 0;

    for (let i = 1; i < points.length; i++)
    {
        const distance = marsDistance(points[i - 1], points[i]);

        if (distance > longestLength)
        {
            longestLength = distance;
            longestIndex = i;
        }
    }

    const first = points[longestIndex - 1];
    const second = points[longestIndex];
    const midLatitude = (first.lat + second.lat) / 2;
    const longitudeDelta = (second.lon - first.lon) * Math.cos(midLatitude * TO_RADIANS);
    const latitudeDelta = second.lat - first.lat;
    const length = Math.hypot(latitudeDelta, longitudeDelta);

    if (!length)
    {
        return null;
    }

    const offsetDegrees = distanceMeters / MARS_RADIUS_METERS / TO_RADIANS;
    const detour = {
        id: crypto.randomUUID(),
        lat: midLatitude - longitudeDelta / length * offsetDegrees,
        lon: (first.lon + second.lon) / 2 + latitudeDelta / length * offsetDegrees / Math.cos(midLatitude * TO_RADIANS)
    };

    return [...points.slice(0, longestIndex), detour, ...points.slice(longestIndex)];
}
