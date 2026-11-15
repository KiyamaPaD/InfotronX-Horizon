import { normalizeMarkerIcon } from "./marker-icons.js";

export const WAYPOINT_CATEGORIES = Object.freeze([
    { id: "navigation", label: "Navigation" },
    { id: "science", label: "Science target" },
    { id: "sample", label: "Sample site" },
    { id: "landmark", label: "Landmark" },
    { id: "hazard", label: "Hypothetical hazard" },
    { id: "other", label: "Other" }
]);

export const MARKER_COLORS = Object.freeze([
    "#ec9976", "#75d1c8", "#e2c77d", "#b1a8f1",
    "#77aaf1", "#f1b4c6", "#e8e6e1", "#92c279"
]);

export function normalizeColor(value, fallback = null)
{
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
        ? value.toLowerCase() : fallback;
}

export function normalizeCategory(value)
{
    return WAYPOINT_CATEGORIES.some(item => item.id === value) ? value : "navigation";
}

export function cleanWaypointMetadata(source)
{
    if (!source || typeof source !== "object")
    {
        return {};
    }

    const meta = {};

    if (typeof source.name === "string")
    {
        meta.name = source.name.trim().slice(0, 80);
    }

    if (typeof source.category === "string")
    {
        meta.category = normalizeCategory(source.category);
    }

    if (typeof source.description === "string")
    {
        meta.description = source.description.trim().slice(0, 500);
    }

    if (typeof source.icon === "string")
    {
        meta.icon = normalizeMarkerIcon(source.icon);
    }

    if (source.color === null || source.color === "")
    {
        meta.color = null;
    }
    else if (typeof source.color === "string")
    {
        const valid = normalizeColor(source.color);

        if (valid)
        {
            meta.color = valid;
        }
    }

    return meta;
}

export function waypointLabel(point, index)
{
    return String(point.name || "").trim() || `Waypoint ${index + 1}`;
}

export function categoryLabel(value)
{
    return WAYPOINT_CATEGORIES.find(item => item.id === value)?.label || "Navigation";
}
