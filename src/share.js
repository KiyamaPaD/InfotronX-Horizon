import { SHARE_HASH_PREFIX } from "./constants.js";
import { cleanWaypointMetadata } from "./waypoint-editor.js";
import { validateMission } from "./store.js";

function encodeUtf8(text)
{
    const bytes = new TextEncoder().encode(text);
    let binary = "";

    for (const byte of bytes)
    {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUtf8(encoded)
{
    const safe = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(safe), char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function createShareLink(mission)
{
    const link = new URL(window.location.href);
    link.hash = SHARE_HASH_PREFIX.slice(1) + encodeUtf8(JSON.stringify(mission));
    return link.toString();
}

export function readSharedMission()
{
    if (!window.location.hash.startsWith(SHARE_HASH_PREFIX))
    {
        return null;
    }

    try
    {
        const encoded = window.location.hash.slice(SHARE_HASH_PREFIX.length);

        if (encoded.length > 20000)
        {
            throw new Error("Shared mission is too large");
        }

        return validateMission(JSON.parse(decodeUtf8(encoded)));
    }
    catch
    {
        return null;
    }
}

export function downloadFile(filename, content, mimeType = "application/json")
{
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function toGeoJson(mission)
{
    const features = mission.routes.filter(route => route.points.length > 0).map(route => ({
        type: "Feature",
        properties: { name: route.name, color: route.color, waypoints: route.points.map(point => ({ ...cleanWaypointMetadata(point), id: point.id || null })), type: route.points.length === 1 ? "planned-waypoint" : "planned-route", body: "Mars", coordinates: "east-positive-planetocentric-degrees", validatedForTraversal: false, terrainModel: route.terrainModel ? { ...route.terrainModel, unverified: true } : null },
        geometry: route.points.length === 1 ? { type: "Point", coordinates: [route.points[0].lon, route.points[0].lat] } : { type: "LineString", coordinates: route.points.map(point => [point.lon, point.lat]) }
    }));

    features.push(...mission.observations.map(observation => ({
        type: "Feature",
        properties: { name: observation.title, note: observation.note, source: observation.source, type: "unverified-observation", body: "Mars" },
        geometry: { type: "Point", coordinates: [observation.lon, observation.lat] }
    })));

    return { type: "FeatureCollection", name: mission.title, properties: { body: "Mars", crsNote: "Planetocentric east-positive degrees, not WGS84" }, features };
}
