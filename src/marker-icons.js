export const MARKER_ICONS = Object.freeze([
    { id: "circle", symbol: "●", label: "Circle" },
    { id: "diamond", symbol: "◆", label: "Diamond" },
    { id: "square", symbol: "■", label: "Square" },
    { id: "triangle", symbol: "▲", label: "Triangle" },
    { id: "star", symbol: "★", label: "Star" }
]);

export function normalizeMarkerIcon(value)
{
    return MARKER_ICONS.some(icon => icon.id === value) ? value : "circle";
}

export function markerRadiusForZoom(zoom)
{
    return Math.max(3, Math.min(7, 3 + (zoom - 3) * 0.5));
}
