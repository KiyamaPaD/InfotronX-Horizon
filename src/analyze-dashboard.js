// Big visual summary shown at the Analyze step. It only reads the active mission; nothing here edits a route.
// Numbers are labelled "Calculated" (distances on Mars's radius, heights sampled from the bundled USGS CTX DEM).
import { analyzeRoute, formatDistance } from "./geo.js";
import { loadJezeroDem } from "./bundled-dem.js";
import { profileRouteOnDem } from "./terrain.js";
import { summarizeTerrainProfile } from "./terrain-profile-v2.js";
import { animateNumber, prefersReducedMotion } from "./motion.js";

const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const CHART = { width: 640, height: 230, left: 46, right: 14, top: 14, bottom: 30 };
let demPromise = null;

function loadDem()
{
    demPromise ??= loadJezeroDem().catch(() => null);
    return demPromise;
}

function elevationChart(samples, summary)
{
    const known = samples.filter(sample => typeof sample.elevationMeters === "number");

    if (known.length < 2)
    {
        return `<div class="ad-empty-chart"><strong>No elevation data on this route</strong><span>The bundled height model covers only the delta front. Treat anything outside it as unknown, never as safe.</span></div>`;
    }

    const minimum = summary.minimumElevationMeters, maximum = summary.maximumElevationMeters;
    const span = Math.max(1, maximum - minimum), length = Math.max(1, samples.at(-1).distanceMeters);
    const plotWidth = CHART.width - CHART.left - CHART.right, plotHeight = CHART.height - CHART.top - CHART.bottom;
    const x = sample => CHART.left + sample.distanceMeters / length * plotWidth;
    const y = sample => CHART.top + (1 - (sample.elevationMeters - minimum) / span) * plotHeight;
    const runs = [];
    let run = [];

    for (const sample of samples)
    {
        if (typeof sample.elevationMeters === "number") run.push(sample);
        else if (run.length) { runs.push(run); run = []; }
    }

    if (run.length) runs.push(run);
    const baseline = CHART.top + plotHeight;
    const lines = runs.filter(item => item.length > 1).map(item => "M" + item.map(sample => x(sample).toFixed(1) + " " + y(sample).toFixed(1)).join(" L"));
    const areas = runs.filter(item => item.length > 1).map(item => "M" + x(item[0]).toFixed(1) + " " + baseline + " L" + item.map(sample => x(sample).toFixed(1) + " " + y(sample).toFixed(1)).join(" L") + " L" + x(item.at(-1)).toFixed(1) + " " + baseline + " Z");
    const grid = [0, 0.5, 1].map(t => `<line x1="${CHART.left}" x2="${CHART.width - CHART.right}" y1="${CHART.top + t * plotHeight}" y2="${CHART.top + t * plotHeight}" class="ad-grid"/><text x="${CHART.left - 8}" y="${CHART.top + t * plotHeight + 4}" class="ad-axis" text-anchor="end">${Math.round(maximum - t * span)}</text>`).join("");
    const ticks = [0, 0.5, 1].map(t => `<text x="${CHART.left + t * plotWidth}" y="${CHART.height - 8}" class="ad-axis" text-anchor="${t === 0 ? "start" : t === 1 ? "end" : "middle"}">${formatDistance(t * length)}</text>`).join("");

    return `<div class="ad-chart-wrap"><svg class="ad-chart" viewBox="0 0 ${CHART.width} ${CHART.height}" role="img" aria-label="Elevation along the route, ${Math.round(minimum)} to ${Math.round(maximum)} metres">
        <defs><linearGradient id="ad-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e39165" stop-opacity=".55"/><stop offset="1" stop-color="#e39165" stop-opacity="0"/></linearGradient></defs>
        ${grid}${ticks}
        ${areas.map(path => `<path d="${path}" fill="url(#ad-fill)" class="ad-area"/>`).join("")}
        ${lines.map(path => `<path d="${path}" pathLength="1" class="ad-line"/>`).join("")}
        <g class="ad-scrub" hidden><line class="ad-scrub-line" y1="${CHART.top}" y2="${baseline}"/><circle r="5" class="ad-scrub-dot"/></g>
        <rect class="ad-hit" x="${CHART.left}" y="${CHART.top}" width="${plotWidth}" height="${plotHeight}" fill="transparent"/>
    </svg><div class="ad-tip" hidden></div></div>
    <p class="ad-note">Heights in metres relative to the Mars datum, sampled from the USGS CTX DEM (20 m grid). Calculated, not surveyed on the ground.</p>`;
}

function wireScrubber(root, samples, summary)
{
    const svg = root.querySelector(".ad-chart");

    if (!svg) return;

    const known = samples.filter(sample => typeof sample.elevationMeters === "number");
    const minimum = summary.minimumElevationMeters, span = Math.max(1, summary.maximumElevationMeters - minimum), length = Math.max(1, samples.at(-1).distanceMeters);
    const plotWidth = CHART.width - CHART.left - CHART.right, plotHeight = CHART.height - CHART.top - CHART.bottom;
    const scrub = svg.querySelector(".ad-scrub"), tip = root.querySelector(".ad-tip");

    svg.addEventListener("pointermove", event =>
    {
        const box = svg.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, ((event.clientX - box.left) / box.width * CHART.width - CHART.left) / plotWidth));
        const target = t * length;
        const sample = known.reduce((best, item) => Math.abs(item.distanceMeters - target) < Math.abs(best.distanceMeters - target) ? item : best);
        const px = CHART.left + sample.distanceMeters / length * plotWidth, py = CHART.top + (1 - (sample.elevationMeters - minimum) / span) * plotHeight;
        scrub.hidden = false;
        scrub.querySelector("line").setAttribute("x1", px); scrub.querySelector("line").setAttribute("x2", px);
        scrub.querySelector("circle").setAttribute("cx", px); scrub.querySelector("circle").setAttribute("cy", py);
        tip.hidden = false;
        tip.textContent = formatDistance(sample.distanceMeters) + " · " + Math.round(sample.elevationMeters) + " m";
        tip.style.left = (px / CHART.width * 100) + "%";
    });
    svg.addEventListener("pointerleave", () => { scrub.hidden = true; tip.hidden = true; });
}

function segmentBars(analysis)
{
    const longest = Math.max(...analysis.segments.map(segment => segment.distance), 1);
    return analysis.segments.map((segment, index) =>
        `<div class="ad-bar${segment.distance === longest ? " is-longest" : ""}" style="--w:${(segment.distance / longest * 100).toFixed(1)}%;--d:${index * 70}ms"><span class="ad-bar-label">Leg ${segment.index}</span><span class="ad-bar-track"><i></i></span><span class="ad-bar-value">${formatDistance(segment.distance)}</span></div>`).join("");
}

function routeComparison(routes, activeId)
{
    const rows = routes.filter(route => route.points.length >= 2).map(route => ({ route, distance: analyzeRoute(route.points).totalDistance }));

    if (rows.length < 2)
    {
        return `<p class="ad-note">Create a second route (Duplicate or Simulate a detour) to compare them here.</p>`;
    }

    const longest = Math.max(...rows.map(row => row.distance)), shortest = Math.min(...rows.map(row => row.distance));
    return rows.map((row, index) =>
        `<div class="ad-bar${row.route.id === activeId ? " is-active" : ""}" style="--w:${(row.distance / longest * 100).toFixed(1)}%;--c:${escapeText(row.route.color)};--d:${index * 90}ms"><span class="ad-bar-label">${escapeText(row.route.name)}</span><span class="ad-bar-track"><i></i></span><span class="ad-bar-value">${formatDistance(row.distance)}${row.distance === shortest ? ' <b>shortest</b>' : ""}</span></div>`).join("") +
        `<p class="ad-note">"Shortest" means the shortest of the routes you calculated. Shorter does not mean safer.</p>`;
}

function routeStage(points, color)
{
    const latitudes = points.map(point => point.lat), longitudes = points.map(point => point.lon);
    const west = Math.min(...longitudes), south = Math.min(...latitudes);
    const scaleX = Math.max(1e-9, Math.max(...longitudes) - west) * Math.cos(points[0].lat * Math.PI / 180);
    const scaleY = Math.max(1e-9, Math.max(...latitudes) - south);
    const scale = 80 / Math.max(scaleX, scaleY);
    const place = point => [(10 + ((point.lon - west) * Math.cos(points[0].lat * Math.PI / 180)) * scale).toFixed(1), (90 - (point.lat - south) * scale).toFixed(1)];
    const coordinates = points.map(place);
    const path = coordinates.map(pair => pair.join(",")).join(" ");
    return `<div class="ad-stage"><div class="ad-plane"><svg viewBox="0 0 100 100" aria-hidden="true">
        <polyline points="${path}" class="ad-route-shadow"/>
        <polyline points="${path}" class="ad-route-line" style="stroke:${escapeText(color)}" pathLength="1"/>
        ${coordinates.map((pair, index) => `<circle cx="${pair[0]}" cy="${pair[1]}" r="${index === 0 || index === coordinates.length - 1 ? 2.6 : 1.7}" class="ad-route-dot${index === 0 ? " is-start" : ""}"/>`).join("")}
    </svg></div></div>`;
}

export function mountAnalyzeDashboard({ shell, store })
{
    const host = shell.querySelector(".center-column");
    const mapWrap = shell.querySelector(".map-wrap");

    if (!host || !mapWrap || shell.querySelector(".analyze-dashboard"))
    {
        return null;
    }

    const dashboard = document.createElement("section");
    dashboard.className = "analyze-dashboard";
    dashboard.setAttribute("aria-label", "Route analysis");
    dashboard.hidden = true;
    host.appendChild(dashboard);
    let token = 0;

    const visible = () => shell.dataset.step === "analyze";

    function place()
    {
        dashboard.style.setProperty("--dash-top", mapWrap.offsetTop + "px");
    }

    async function render()
    {
        if (!visible())
        {
            dashboard.hidden = true;
            return;
        }

        place();
        dashboard.hidden = false;
        const id = ++token;
        const route = store.activeRoute;
        const points = route.points;

        if (points.length < 2)
        {
            dashboard.innerHTML = `<div class="ad-empty"><div class="ad-empty-orb" aria-hidden="true"></div><h2>Your analysis starts with a route</h2><p>Add two or more waypoints and this page fills with distance, slope, elevation and a 3D view of your route.</p><div class="ad-actions"><button class="btn btn-accent" type="button" data-ad="plan">Draw a route</button><button class="btn btn-outline" type="button" data-ad="demo">Open the example mission</button></div></div>`;
            return;
        }

        const analysis = analyzeRoute(points);
        const dem = await loadDem();

        if (id !== token || !visible()) return;

        const profile = dem ? profileRouteOnDem(dem, points) : { samples: [] };
        const summary = dem ? summarizeTerrainProfile(dem, points, profile) : null;
        const hasHeights = Boolean(summary && summary.knownCount >= 2);
        const longest = analysis.segments.reduce((best, segment) => segment.distance > best.distance ? segment : best, analysis.segments[0]);
        const kpi = (label, valueHtml, note, tag, hint = "") => `<div class="ad-kpi"><span class="ad-kpi-label">${label}</span><strong>${valueHtml}</strong><small>${note}</small><em${hint ? ` title="${hint}"` : ""}>${tag}</em></div>`;

        const total = analysis.totalDistance;
        const share = Math.round(longest.distance / Math.max(1, total) * 100);
        const others = store.current.routes.filter(item => item.id !== route.id && item.points.length >= 2).map(item => ({ item, distance: analyzeRoute(item.points).totalDistance }));
        const gradeLimit = 18;
        const steepest = hasHeights ? summary.maxAbsoluteGradePercent : null;
        const coverage = hasHeights ? Math.round(summary.coverageFraction * 100) : 0;
        const diff = others.length ? others.reduce((best, row) => Math.abs(row.distance - total) < Math.abs(best.distance - total) ? row : best) : null;
        const sentences = {
            size: `Your route is ${formatDistance(total)} long, in ${analysis.segments.length} leg${analysis.segments.length === 1 ? "" : "s"}. The longest leg is ${formatDistance(longest.distance)}.`,
            height: hasHeights
                ? `You climb ${Math.round(summary.ascentMeters)} m and descend ${Math.round(summary.descentMeters)} m.${steepest === null ? "" : ` The steepest measured slope is ${steepest.toFixed(1)}%, ${steepest <= gradeLimit ? "under" : "over"} the planner's default limit of ${gradeLimit}%.`}${coverage < 100 ? ` Height data covers ${coverage}% of the route; the rest is unknown.` : ""}`
                : "There is no height data for this route, so slope and climb are unknown. That is not the same as flat or safe.",
            legs: `Leg ${longest.index} is the longest and makes up ${share}% of the route.${share >= 50 && analysis.segments.length > 1 ? " Consider adding a waypoint inside it." : ""}`,
            compare: diff
                ? `Compared with "${escapeText(diff.item.name)}", this route is ${formatDistance(Math.abs(total - diff.distance))} ${total >= diff.distance ? "longer" : "shorter"}.`
                : "You have one route so far. Duplicate it or simulate a detour to have something to compare.",
            threeD: "Open the 3D terrain to check what the numbers cannot show: hills, crater rims and where your route crosses them."
        };
        const checks = [
            [points.length >= 2, "The route has at least two waypoints"],
            [hasHeights && coverage === 100, hasHeights ? `Height data covers the whole route (${coverage}%)` : "Height data covers the route"],
            [steepest !== null && steepest <= gradeLimit, steepest === null ? "Steepest slope is known" : `Steepest slope ${steepest.toFixed(1)}% is within ${gradeLimit}%`],
            [others.length > 0, "You compared at least two routes"]
        ];
        const passed = checks.filter(item => item[0]).length;
        const stepHead = (number, title, help) => `<div class="ad-step-head"><span class="ad-step-no">${number}</span><div><h3>${title}</h3><p>${help}</p></div></div>`;
        const stepFoot = (number, sentence) => `<div class="ad-result"><span>IN YOUR CASE</span><p>${sentence}</p></div>${number < 6 ? `<button class="ad-next" type="button" data-ad-go="${number + 1}">Next step →</button>` : ""}`;
        const chips = [["1", "Size"], ["2", "Height"], ["3", "Legs"], ["4", "Compare"], ["5", "3D"], ["6", "Decide"]].map(([n, label]) => `<button type="button" class="ad-chip" data-ad-go="${n}"><b>${n}</b> ${label}</button>`).join("");

        dashboard.innerHTML = `
            <header class="ad-head">
                <div><span class="ad-eyebrow">ROUTE ANALYSIS · STEP BY STEP</span><h2>${escapeText(route.name)}</h2></div>
                <div class="ad-actions">
                    <button class="btn btn-accent" type="button" data-ad="3d">◈ View in 3D</button>
                    <button class="btn btn-outline" type="button" data-ad="guide">How to choose a route</button>
                    <button class="btn btn-quiet" type="button" data-ad="tools">Detailed tools</button>
                </div>
            </header>
            <nav class="ad-chips" aria-label="Analysis steps">${chips}</nav>
            <section class="ad-step" id="ad-step-1">
                ${stepHead(1, "How big is the route?", "Distance and number of legs tell you how long the trip is and how many stops it has.")}
                <div class="ad-kpis">
                    ${kpi("DISTANCE", `<span data-count="${total}" data-kind="distance">0 m</span>`, "Along the surface of Mars", "Calculated")}
                    ${kpi("WAYPOINTS", `<span data-count="${points.length}" data-kind="integer">0</span>`, `${analysis.segments.length} legs`, "Your plan")}
                    ${kpi("LONGEST LEG", `<span data-count="${longest.distance}" data-kind="distance">0 m</span>`, `Leg ${longest.index}`, "Calculated")}
                    ${hasHeights
                        ? kpi("HEIGHT CHANGE", `<span data-count="${summary.ascentMeters}" data-kind="meters">0 m</span> <small class="ad-split">up · ${Math.round(summary.descentMeters)} m down</small>`, steepest === null ? "Steepest slope unknown" : `Steepest slope ${steepest.toFixed(1)}%: ${steepest.toFixed(1)} m of rise per 100 m`, "Calculated · DEM", "DEM = digital elevation model, a grid of heights (USGS CTX, 20 m cells)")
                        : kpi("ELEVATION", "—", "No height data here", "Unknown")}
                </div>
                <p class="ad-note"><b>Distance</b> is measured along the surface using Mars's radius. <b>Height change</b> adds up every climb and every descent between samples, using the DEM (digital elevation model: a grid of heights derived from orbital images). <b>Slope %</b> is metres of rise per 100 m travelled. A route with no height data is marked Unknown, never assumed flat.</p>
                ${stepFoot(1, sentences.size)}
            </section>
            <section class="ad-step" id="ad-step-2">
                ${stepHead(2, "How much up and down?", "Climbing costs time and energy, and steep stretches are the risky part. The chart shows height along the route; move the mouse over it.")}
                <div class="ad-card">${elevationChart(hasHeights ? profile.samples : [], hasHeights ? summary : {})}</div>
                ${stepFoot(2, sentences.height)}
            </section>
            <section class="ad-step" id="ad-step-3">
                ${stepHead(3, "Which part is the longest?", "The longest leg is where you go furthest between stops. Splitting it gives you more places to check and adjust.")}
                <div class="ad-card"><div class="ad-bars">${segmentBars(analysis)}</div></div>
                ${stepFoot(3, sentences.legs)}
            </section>
            <section class="ad-step" id="ad-step-4">
                ${stepHead(4, "Is there a better option?", "Put two routes side by side. A shorter route is not automatically safer, so look at distance and slope together.")}
                <div class="ad-card"><div class="ad-bars">${routeComparison(store.current.routes, route.id)}</div></div>
                ${stepFoot(4, sentences.compare)}
            </section>
            <section class="ad-step" id="ad-step-5">
                ${stepHead(5, "What does the terrain look like?", "Numbers hide shape. The 3D view shows the hills and crater rims around your route.")}
                <div class="ad-card ad-card-3d">${routeStage(points, route.color)}<button class="btn btn-accent" type="button" data-ad="3d">◈ Open the 3D terrain</button></div>
                ${stepFoot(5, sentences.threeD)}
            </section>
            <section class="ad-step" id="ad-step-6">
                ${stepHead(6, "Can I decide?", "A quick checklist built from the numbers above. It helps you choose; the decision stays yours.")}
                <div class="ad-card"><ul class="ad-checks">${checks.map(([ok, text]) => `<li class="${ok ? "is-ok" : "is-open"}"><span aria-hidden="true">${ok ? "✓" : "○"}</span>${text}</li>`).join("")}</ul></div>
                <div class="ad-result"><span>IN YOUR CASE</span><p>${passed === checks.length ? "Every check passes, so this is a reasonable candidate among the routes you calculated." : `${passed} of ${checks.length} checks pass. Open items are things to look at before you decide.`} Planning aid only, not a safety or navigation approval.</p></div>
            </section>`;

        for (const element of dashboard.querySelectorAll("[data-count]"))
        {
            const value = Number(element.dataset.count);
            const format = { distance: formatDistance, integer: number => String(Math.round(number)), meters: number => Math.round(number) + " m" }[element.dataset.kind];
            element.dataset.motionValue = "0";
            animateNumber(element, value, format, prefersReducedMotion() ? 0 : 1100);
        }

        if (hasHeights) wireScrubber(dashboard, profile.samples, summary);
    }

    dashboard.addEventListener("click", event =>
    {
        const go = event.target.closest("[data-ad-go]")?.dataset.adGo;

        if (go)
        {
            dashboard.querySelector("#ad-step-" + go)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
            return;
        }

        const action = event.target.closest("[data-ad]")?.dataset.ad;

        if (action === "3d") shell.querySelector('[data-action="open-3d"]')?.click();
        else if (action === "guide") shell.querySelector('[data-action="show-route-guide"]')?.click();
        else if (action === "tools") shell.querySelector(".workflow-all")?.click();
        else if (action === "plan") shell.querySelector('.workflow-step[data-step="plan"]')?.click();
        else if (action === "demo") shell.querySelector('[data-action="load-review-demo"]')?.click();
    });

    // The 3D view lives inside the map, so the dashboard steps aside while it is open.
    new MutationObserver(() => dashboard.classList.toggle("is-peeking", Boolean(mapWrap.querySelector(".map-3d-layer")))).observe(mapWrap, { childList: true });
    new MutationObserver(() => render()).observe(shell, { attributes: true, attributeFilter: ["data-step"] });
    let queued = false;
    store.subscribe(() => { if (!queued && visible()) { queued = true; requestAnimationFrame(() => { queued = false; render(); }); } });
    addEventListener("resize", place);
    render();

    return { render };
}
