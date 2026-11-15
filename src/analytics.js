import { analyzeRoute, formatDistance, marsDistance } from "./geo.js";

export function renderSegmentChart(container, route)
{
    const { segments } = analyzeRoute(route.points);
    container.replaceChildren();

    if (!segments.length)
    {
        container.innerHTML = `<div class="empty-chart">Add at least two waypoints to see segment distances.</div>`;
        return;
    }

    const maxDistance = Math.max(...segments.map(segment => segment.distance), 1);
    const barContainer = document.createElement("div");
    barContainer.className = "segment-bars";

    segments.forEach(segment =>
{
        const row = document.createElement("div");
        row.className = "segment-bar-row";
        const label = document.createElement("span");
        label.textContent = `${String(segment.index).padStart(2, "0")} → ${String(segment.index + 1).padStart(2, "0")}`;
        const track = document.createElement("div");
        track.className = "bar-track";
        const bar = document.createElement("div");
        bar.className = "bar-fill";
        bar.style.width = `${Math.max(3, segment.distance / maxDistance * 100)}%`;
        bar.style.background = route.color;
        track.appendChild(bar);
        const value = document.createElement("strong");
        value.textContent = formatDistance(segment.distance);
        row.append(label, track, value);
        barContainer.appendChild(row);
    });

    container.appendChild(barContainer);
}

export function explainManualDistanceRoutes(routes, endpointToleranceMeters = 1)
{
    const rows = routes.filter(route => Array.isArray(route.points) && route.points.length >= 2)
        .map(route => ({ id: route.id, name: route.name, points: route.points,
            distanceMeters: analyzeRoute(route.points).totalDistance }));

    if (rows.length < 2)
    {
        return { comparable: false, status: "insufficient",
            explanation: "Add a second manually drawn route to compare alternatives by surface distance only." };
    }

    const reference = rows[0].points;
    const start = reference[0];
    const end = reference.at(-1);
    const equalEndpoints = rows.every(row =>
        marsDistance(start, row.points[0]) <= endpointToleranceMeters &&
        marsDistance(end, row.points.at(-1)) <= endpointToleranceMeters);

    if (!equalEndpoints)
    {
        return { comparable: false, status: "different-endpoints",
            explanation: "These routes do not share the same start and destination. Their distances describe different journeys; no shortest-route recommendation is justified." };
    }

    const min = Math.min(...rows.map(row => row.distanceMeters));
    const winners = rows.filter(row => Math.abs(row.distanceMeters - min) <= 0.05);
    const labels = winners.map(row => row.name).join(", ");

    return {
        comparable: true, status: winners.length > 1 ? "tie" : "shortest",
        minimumMeters: min, winnerIds: winners.map(row => row.id),
        explanation: (winners.length > 1
            ? "Several manual alternatives have equivalent spherical polyline lengths: "
            : "Shortest manually drawn spherical polyline among these alternatives: ") +
            labels + " (" + formatDistance(min) +
            "). This is a distance-only comparison, not a DEM traverse, terrain safety finding or proof that scientific objectives are equal."
    };
}

export function renderRouteComparison(container, routes, activeRouteId = null)
{
    container.replaceChildren();

    const rows = routes.filter(route => route.points.length > 1).map(route => ({ route, analysis: analyzeRoute(route.points) }));

    if (!rows.length)
    {
        container.innerHTML = `<div class="empty-chart">Draw a route to compare its distance with alternatives.</div>`;
        return;
    }

    const maximum = Math.max(...rows.map(item => item.analysis.totalDistance), 1);
    const active = rows.find(item => item.route.id === activeRouteId);
    const referenceDistance = active?.analysis.totalDistance || 0;
    const expanded = container.dataset.expanded === "true";
    const visibleRows = !expanded && rows.length > 4 ? rows.slice(-4) : [...rows];

    if (!expanded && rows.length > 4 && active && !visibleRows.some(item => item.route.id === activeRouteId))
    {
        visibleRows[0] = active;
    }

    container.classList.toggle("comparison-expanded", expanded);

    for (const item of visibleRows)
    {
        const wrapper = document.createElement("div");
        wrapper.className = "compare-row";
        const label = document.createElement("div");
        label.className = "compare-label";
        const title = document.createElement("span");
        title.textContent = item.route.name + (item.route.id === activeRouteId ? " · ACTIVE" : "");
        const value = document.createElement("strong");
        value.textContent = formatDistance(item.analysis.totalDistance);
        label.append(title, value);

        if (referenceDistance > 0 && item.route.id !== activeRouteId)
        {
            const comparison = document.createElement("small");
            const difference = (item.analysis.totalDistance - referenceDistance) / referenceDistance * 100;
            comparison.className = "comparison-delta";
            comparison.textContent = `${difference >= 0 ? "+" : ""}${difference.toFixed(1)}% vs active distance`;
            label.appendChild(comparison);
        }
        const track = document.createElement("div");
        track.className = "bar-track comparison-track";
        const bar = document.createElement("div");
        bar.className = "bar-fill";
        bar.style.width = `${item.analysis.totalDistance / maximum * 100}%`;
        bar.style.background = item.route.color;
        track.appendChild(bar);
        wrapper.append(label, track);
        container.appendChild(wrapper);
    }

    const explanation = document.createElement("p");
    explanation.className = "manual-comparison-explanation";
    explanation.textContent = explainManualDistanceRoutes(routes).explanation;
    container.appendChild(explanation);

    if (rows.length > 4)
    {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "comparison-toggle";
        toggle.textContent = expanded ? "Show fewer routes" : "Show all " + rows.length + " routes";
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.addEventListener("click", () =>
        {
            container.dataset.expanded = String(!expanded);
            renderRouteComparison(container, routes, activeRouteId);
        });
        container.appendChild(toggle);
    }
}
