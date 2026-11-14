import { analyzeRoute, formatDistance } from "./geo.js";

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
