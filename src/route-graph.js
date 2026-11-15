import { marsDistance, formatDistance } from "./geo.js";
import { normalizeColor } from "./waypoint-editor.js";

const escapeMarkup = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

export function buildRouteGraph(routes, activeRouteId)
{
    return routes.map(route =>
    {
        const points = Array.isArray(route.points) ? route.points : [];
        const nodes = points.map((point, index) => ({
            index, id: point.id, label: point.name || `Waypoint ${index + 1}`
        }));
        const edges = points.slice(1).map((point, index) => ({
            from: index, to: index + 1, distanceMeters: marsDistance(points[index], point)
        }));

        return {
            id: route.id, name: route.name, color: normalizeColor(route.color, "#ec9976"),
            active: route.id === activeRouteId, nodes, edges,
            distanceMeters: edges.reduce((sum, edge) => sum + edge.distanceMeters, 0)
        };
    });
}

export function drawRouteGraph(container, routes, activeRouteId)
{
    const graph = buildRouteGraph(routes, activeRouteId);
    const display = graph.filter(route => route.nodes.length).slice(0, 5);

    if (!display.length)
    {
        container.innerHTML = '<p class="empty-inline">Place two waypoints to see an abstract route graph and segment connections.</p>';
        return;
    }

    const height = 24 + display.length * 80;
    const drawings = display.map((route, row) =>
    {
        const y = 34 + row * 80;
        const segmentCount = Math.max(1, route.nodes.length - 1);
        const x = index => 20 + index / segmentCount * 290;
        const caption = `${escapeMarkup(route.name)} · ${formatDistance(route.distanceMeters)}`;
        const edges = route.edges.map(edge =>
        {
            const midX = (x(edge.from) + x(edge.to)) / 2;
            const label = route.nodes.length <= 7 ?
                `<text x="${midX.toFixed(1)}" y="${y - 12}" text-anchor="middle" class="route-graph-weight">${escapeMarkup(formatDistance(edge.distanceMeters))}</text>` : "";
            return `<line x1="${x(edge.from)}" y1="${y}" x2="${x(edge.to)}" y2="${y}"
                stroke="${route.color}" stroke-width="${route.active ? 3 : 2}" stroke-linecap="round"/>${label}`;
        }).join("");
        const nodes = route.nodes.map(node =>
        {
            const pos = x(node.index);
            const marker = route.nodes.length > 30 ? 3 : 5;
            return `<circle cx="${pos.toFixed(1)}" cy="${y}" r="${marker}" stroke="#092331" stroke-width="1.5" fill="${route.color}">
                <title>${escapeMarkup(node.label)} · node ${node.index + 1}</title></circle>`;
        }).join("");

        return `<text x="19" y="${y - 25}" class="route-graph-label">${caption}</text>
            ${edges}${nodes}
            <text x="19" y="${y + 21}" class="route-graph-label-mini">START</text>
            <text x="310" y="${y + 21}" text-anchor="end" class="route-graph-label-mini">END</text>`;
    }).join("");

    container.innerHTML = `<div class="route-graph-view"><svg viewBox="0 0 330 ${height}"
        role="img" aria-label="Abstract route connectivity graph with waypoint nodes and segment distances">${drawings}</svg></div>
        <small class="route-graph-footnote">Each node is a user waypoint; edges follow manual route order.
        Positions are evenly spaced for readability, NOT to geographic scale.
        ${graph.length > 5 ? `Showing 5 of ${graph.length} routes.` : ""}</small>`;
}
