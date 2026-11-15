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

export function spreadNearbyMarkers(positions, minimumSpacing = 32)
{
    const result = positions.map(point => ({ x: point.x, y: point.y, shifted: false }));
    const visited = new Set();

    for (let index = 0; index < positions.length; index++)
    {
        if (visited.has(index))
        {
            continue;
        }

        const group = [index];
        visited.add(index);

        for (let cursor = 0; cursor < group.length; cursor++)
        {
            const current = positions[group[cursor]];

            for (let next = 0; next < positions.length; next++)
            {
                if (visited.has(next) || Math.hypot(current.x - positions[next].x, current.y - positions[next].y) >= minimumSpacing)
                {
                    continue;
                }

                visited.add(next);
                group.push(next);
            }
        }

        if (group.length < 2)
        {
            continue;
        }

        group.sort((a, b) => a - b);
        const centerX = group.reduce((sum, item) => sum + positions[item].x, 0) / group.length;
        const centerY = group.reduce((sum, item) => sum + positions[item].y, 0) / group.length;
        const radius = Math.max(26, group.length * 8);

        group.forEach((item, offset) =>
        {
            const angle = -Math.PI / 2 + 2 * Math.PI * offset / group.length;
            result[item] = { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), shifted: true };
        });
    }

    return result;
}

export function edgeFadeMask(fadeLeft, fadeRight, fadeTop, fadeBottom, fadePixels = 44)
{
    function axis(direction, start, end)
    {
        if (start && end)
        {
            return `linear-gradient(to ${direction}, transparent 0px, black ${fadePixels}px, black calc(100% - ${fadePixels}px), transparent 100%)`;
        }

        if (start)
        {
            return `linear-gradient(to ${direction}, transparent 0px, black ${fadePixels}px)`;
        }

        if (end)
        {
            return `linear-gradient(to ${direction}, black calc(100% - ${fadePixels}px), transparent 100%)`;
        }

        return `linear-gradient(to ${direction}, black, black)`;
    }

    return [axis("right", fadeLeft, fadeRight), axis("bottom", fadeTop, fadeBottom)].join(", ");
}
