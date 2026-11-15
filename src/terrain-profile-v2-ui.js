import { formatDistance } from "./geo.js";
import { profileRouteOnDem } from "./terrain.js";
import { nearestSampleIndex, profileSvgPaths, summarizeTerrainProfile } from "./terrain-profile-v2.js";

const fmt = (number, digits = 1) => Number(number).toLocaleString("en-US", { maximumFractionDigits: digits });
const safe = text => String(text ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function elevationText(value)
{
    return Number.isFinite(value) ? `${fmt(value)} m` : "NoData";
}

function gradeText(value)
{
    return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${fmt(value, 2)}%` : "Unknown";
}

export function mountInteractiveTerrainProfile({ host, store, map, readDem })
{
    host.classList.add("terrain-profile-v2");
    host.innerHTML = `
        <div class="terrain-profile-head"><h3>Interactive elevation profile</h3><span>NUMERIC DEM ONLY</span></div>
        <p class="section-help">Move across the graph or use the slider to inspect real grid samples. The selected location is marked on the Mars map.</p>
        <div id="terrain-v2-summary" class="terrain-v2-summary" role="status">Load the numeric Jezero DEM to start.</div>
        <div class="terrain-v2-graph">
            <svg id="terrain-v2-svg" viewBox="0 0 320 148" role="img" tabindex="0" aria-label="DEM elevation profile. Arrow keys work on the slider below.">
                <line x1="16" x2="304" y1="121" y2="121" stroke="#516777" />
                <line x1="16" x2="16" y1="27" y2="121" stroke="#516777" />
                <g id="terrain-v2-lines"></g>
                <line id="terrain-v2-cursor" x1="16" x2="16" y1="22" y2="122" stroke="#ffd597" stroke-dasharray="4 3" hidden />
                <circle id="terrain-v2-dot" r="4.5" fill="#ffd597" stroke="#0d1d2b" stroke-width="1.4" hidden/>
            </svg>
            <input id="terrain-v2-slider" type="range" min="0" max="0" step="1" value="0" disabled aria-label="Selected elevation sample along route"/>
            <div class="terrain-v2-readout" id="terrain-v2-readout" aria-live="polite">Select a location on the profile.</div>
            <div class="terrain-v2-controls"><button class="btn btn-outline small" type="button" id="terrain-v2-focus" disabled>⌖ Locate on Mars map</button><button class="btn btn-outline small" type="button" id="terrain-v2-clear" disabled>Clear marker</button></div>
        </div>
        <div class="terrain-v2-waypoints" id="terrain-v2-waypoints"></div>
        <p class="science-footnote" id="terrain-v2-caveat">DEM altitudes are sampled at the nearest numeric grid cell. Missing cells remain unknown. Slopes and distances are geometric estimates, not terrain safety ratings.</p>
    `;

    const summaryElement = host.querySelector("#terrain-v2-summary");
    const graph = host.querySelector("#terrain-v2-svg");
    const paths = host.querySelector("#terrain-v2-lines");
    const cursor = host.querySelector("#terrain-v2-cursor");
    const dot = host.querySelector("#terrain-v2-dot");
    const slider = host.querySelector("#terrain-v2-slider");
    const readout = host.querySelector("#terrain-v2-readout");
    const focus = host.querySelector("#terrain-v2-focus");
    const clear = host.querySelector("#terrain-v2-clear");
    const waypointTable = host.querySelector("#terrain-v2-waypoints");
    const caveat = host.querySelector("#terrain-v2-caveat");
    let demSource = null;
    let signature = "";
    let currentSamples = [];
    let currentSummary = null;
    let selectedIndex = -1;
    let queuedPointer = null;
    let pointerScheduled = false;

    function clearProbe()
    {
        selectedIndex = -1;
        cursor.hidden = true;
        dot.hidden = true;
        focus.disabled = true;
        clear.disabled = true;
        readout.textContent = "Select a location on the profile.";
        map.setTerrainProbe?.(null);
    }

    function setSelection(index)
    {
        if (!currentSamples.length)
        {
            return;
        }

        const next = Math.max(0, Math.min(currentSamples.length - 1, Math.round(index)));

        if (next === selectedIndex)
        {
            return;
        }

        selectedIndex = next;
        const sample = currentSamples[next];
        const known = currentSamples.filter(item => Number.isFinite(item.elevationMeters));
        const low = known.length ? Math.min(...known.map(item => item.elevationMeters)) : 0;
        const high = known.length ? Math.max(...known.map(item => item.elevationMeters)) : 1;
        const span = Math.max(1, high - low);
        const distanceSpan = Math.max(1, currentSamples.at(-1).distanceMeters);
        const x = 16 + sample.distanceMeters / distanceSpan * 288;
        const y = Number.isFinite(sample.elevationMeters) ?
            121 - (sample.elevationMeters - low) / span * 94 : 121;

        cursor.setAttribute("x1", String(x));
        cursor.setAttribute("x2", String(x));
        cursor.hidden = false;
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.hidden = !Number.isFinite(sample.elevationMeters);
        slider.value = String(next);
        focus.disabled = false;
        clear.disabled = false;
        readout.textContent = `${formatDistance(sample.distanceMeters)} along route · ${elevationText(sample.elevationMeters)} · ${fmt(sample.lat, 5)}° N, ${fmt(sample.lon, 5)}° E`;
        map.setTerrainProbe?.(sample);
    }

    function selectAtEvent(event)
    {
        if (!currentSamples.length)
        {
            return;
        }

        const rect = graph.getBoundingClientRect();

        if (!rect.width)
        {
            return;
        }

        const x = (event.clientX - rect.left) / rect.width * 320;
        const fraction = Math.max(0, Math.min(1, (x - 16) / 288));
        const target = fraction * currentSamples.at(-1).distanceMeters;
        const index = nearestSampleIndex(currentSamples, target);
        setSelection(index);
    }

    graph.addEventListener("click", selectAtEvent);
    graph.addEventListener("pointermove", event =>
    {
        if (event.pointerType === "touch" || !currentSamples.length)
        {
            return;
        }

        queuedPointer = { clientX: event.clientX };

        if (pointerScheduled)
        {
            return;
        }

        pointerScheduled = true;
        requestAnimationFrame(() =>
        {
            pointerScheduled = false;

            if (queuedPointer)
            {
                selectAtEvent(queuedPointer);
                queuedPointer = null;
            }
        });
    });

    slider.addEventListener("input", () => setSelection(Number(slider.value)));
    focus.addEventListener("click", () =>
    {
        if (selectedIndex >= 0)
        {
            map.flyTo(currentSamples[selectedIndex], Math.min(11, map.layerMaxZoom));
        }
    });
    clear.addEventListener("click", clearProbe);
    waypointTable.addEventListener("click", event =>
    {
        const item = event.target.closest("[data-profile-waypoint]");

        if (!item || !currentSamples.length)
        {
            return;
        }

        const index = Number(item.dataset.profileWaypoint);
        const waypoint = currentSummary?.waypoints[index];

        if (waypoint)
        {
            const sampleIndex = nearestSampleIndex(currentSamples, waypoint.distanceMeters);
            setSelection(sampleIndex);
        }
    });

    function refresh()
    {
        const dem = readDem();
        const route = store.activeRoute;
        const nextSignature = JSON.stringify({
            mission: store.current.id, route: route.id,
            points: route.points.map(point => [point.lat, point.lon, point.id, point.name])
        });

        if (nextSignature === signature && demSource === dem)
        {
            return;
        }

        signature = nextSignature;
        demSource = dem;
        currentSamples = [];
        currentSummary = null;
        clearProbe();
        paths.replaceChildren();
        slider.disabled = true;
        slider.value = "0";
        summaryElement.textContent = "";
        waypointTable.replaceChildren();

        if (!dem)
        {
            summaryElement.textContent = "Load Jezero terrain data in DEM Route Lab or import a numeric DEM first.";
            caveat.textContent = "No numeric elevation dataset loaded. Satellite image brightness is not elevation.";
            return;
        }

        const profile = profileRouteOnDem(dem, route.points);
        const report = summarizeTerrainProfile(dem, route.points, profile);
        currentSummary = report;
        currentSamples = profile.samples;
        const knownPercentage = Math.round(report.coverageFraction * 100);
        const knownLabel = report.minimumElevationMeters !== null
            ? `${elevationText(report.minimumElevationMeters)} to ${elevationText(report.maximumElevationMeters)}` : "Unknown";
        const metric = (label, value) => `<div><span>${label}</span><strong>${value}</strong></div>`;
        summaryElement.innerHTML = `
            <div class="terrain-v2-metrics">
                ${metric("SAMPLED ALTITUDE", knownLabel)}
                ${metric("SAMPLED ASCENT", report.ascentMeters !== null ? `${fmt(report.ascentMeters)} m` : "Unknown")}
                ${metric("SAMPLED DESCENT", report.descentMeters !== null ? `${fmt(report.descentMeters)} m` : "Unknown")}
                ${metric("DATA COVERAGE", profile.samples.length ? `${knownPercentage}% (${report.knownCount}/${report.sampleCount})` : "No route samples")}
            </div>`;

        waypointTable.innerHTML = `<h4>Waypoint elevation &amp; segment grade</h4><div class="terrain-v2-waypoint-list">${report.waypoints.map((point, index) =>
            `<button type="button" class="terrain-v2-waypoint" data-profile-waypoint="${index}" title="Locate this waypoint on the profile">
                <span><strong>${safe(point.name)}</strong><small>${index ? `${formatDistance(point.segmentMeters)} segment` : "Route start"}</small></span>
                <span><strong>${elevationText(point.elevationMeters)}</strong><small>${index ? `${point.changeMeters === null ? "Unknown Δheight" : `${point.changeMeters >= 0 ? "+" : ""}${fmt(point.changeMeters)} m`} · ${gradeText(point.meanGradePercent)} mean grade` : "First waypoint"}</small></span>
            </button>`).join("")}</div>`;

        if (profile.samples.length < 2)
        {
            readout.textContent = "Add two waypoints to inspect an elevation profile.";
            caveat.textContent = "Waypoint elevations are nearest-cell samples. Add a second point to measure segment distance and grade.";
            return;
        }

        const lines = profileSvgPaths(profile.samples).map(path => `<path d="${path}" stroke="#93dac9" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
        paths.innerHTML = lines;
        slider.max = String(profile.samples.length - 1);
        slider.disabled = false;
        caveat.textContent = `${profile.complete ? "DEM samples cover this polyline at sampled positions." : "Partial or missing DEM coverage: profile gaps remain unconnected, and ascent/descent values are partial."} Source: ${dem.bundledSource ? "bundled USGS/NASA CTX clip" : "user-provided grid (not independently verified)"}; vertical datum and actual surface roughness require separate validation. Segment grades are mean endpoint differences, not maximum safe traversal slopes.`;
    }

    return {
        refresh,
        clear: clearProbe,
        brief()
        {
            if (!currentSummary || !currentSummary.sampleCount)
            {
                return "";
            }

            return `Interactive profile (numeric DEM): ${currentSummary.knownCount}/${currentSummary.sampleCount} sampled locations known; sampled ascent ${elevationText(currentSummary.ascentMeters)}; sampled descent ${elevationText(currentSummary.descentMeters)}. Partial data are not replaced with invented elevations; not a safety certification.`;
        }
    };
}
