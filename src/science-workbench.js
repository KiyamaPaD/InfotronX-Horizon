import { analyzeRoute, formatDistance } from "./geo.js";
import { estimateMarswalk, DEFAULT_EVA_ASSUMPTIONS } from "./resources.js";
import { planRouteOnDem, validateDem } from "./terrain.js";
import { compareTerrainStrategies, estimateResourceEnvelope } from "./mission-scenarios.js";
import { explainTerrainRouteChoice } from "./route-decision.js";
import { renderRouteDecision } from "./route-explainer-ui.js";
import { createScientificComparisonReport } from "./scientific-export.js";
import { downloadFile } from "./share.js";
import { loadJezeroDem } from "./bundled-dem.js";
import { mountTerrainIntelligence } from "./terrain-intelligence-ui.js";
import { mountInteractiveTerrainProfile } from "./terrain-profile-v2-ui.js";
import { mountAdvancedMathematics } from "./advanced-math-ui.js";
import { mountMissionResearch } from "./mission-research-ui.js";
import { mountTerrain3D } from "./terrain-3d-ui.js";

const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const formatHours = value => `${Math.floor(value)}h ${String(Math.round((value % 1) * 60)).padStart(2, "0")}m`;
const formatNumber = (value, decimals = 1) => Number(value).toLocaleString("en-US", { maximumFractionDigits: decimals });

function budgetMarkup(title, used, available, unit)
{
    const ratio = available > 0 ? used / available : 0;
    const percent = Math.max(0, Math.min(100, ratio * 100));
    const over = used > available;

    return `<div class="eva-budget ${over ? "eva-over" : ""}"><div class="eva-budget-heading"><span>${escapeText(title)}</span><strong>${formatNumber(used, 2)} / ${formatNumber(available, 2)} ${unit}</strong></div><div class="eva-track" role="meter" aria-label="${escapeText(title)} budget used" aria-valuemin="0" aria-valuemax="${available}" aria-valuenow="${Math.min(used, available)}"><span style="width:${percent}%"></span></div><small>${over ? "Above the illustrative reserve-adjusted budget" : "Within the numerical scenario budget, not a safety assessment"}</small></div>`;
}

export function initScienceWorkbench({ store, map, notify, onTerrainChange = () => {} })
{
    const panel = document.querySelector("#analytics-panel");
    const inspector = document.querySelector("#route-inspector")?.closest(".panel-section");

    if (!panel || !inspector)
    {
        throw new Error("Science workspace host is missing.");
    }

    const resources = document.createElement("section");
    resources.className = "panel-section science-model-section";
    resources.setAttribute("aria-labelledby", "eva-model-heading");
    resources.innerHTML = `
        <div class="panel-title-row"><h2 id="eva-model-heading" class="section-label">MARSWALK RESOURCE MODEL</h2><span class="tiny-pill amber">SCENARIO</span></div>
        <p class="section-help">Compare time, O₂ and energy using your own assumptions. These are <strong>not NASA suit telemetry</strong> or a safety approval.</p>
        <div id="eva-results" class="eva-results" aria-live="polite"></div>
        <details class="science-details" id="eva-assumptions"><summary>Adjust model assumptions</summary>
            <form id="eva-form" class="eva-form">
                <label>Walking speed <small>km/h</small><input name="speedKmh" type="number" min="0.1" max="12" step="0.1" required /></label>
                <label>Science stops <small>minutes</small><input name="observationMinutes" type="number" min="0" max="720" step="1" required /></label>
                <label>O₂ use <small>kg/hour</small><input name="oxygenKgPerHour" type="number" min="0.001" max="3" step="0.001" required /></label>
                <label>O₂ available <small>kg</small><input name="oxygenAvailableKg" type="number" min="0.001" max="50" step="0.01" required /></label>
                <label>Suit power <small>watts</small><input name="batteryWatts" type="number" min="1" max="5000" step="1" required /></label>
                <label>Battery available <small>Wh</small><input name="batteryAvailableWh" type="number" min="1" max="30000" step="1" required /></label>
                <label>Reserve <small>percent</small><input name="reservePercent" type="number" min="0" max="90" step="1" required /></label>
                <label>Time allowance <small>hours</small><input name="maxDurationHours" type="number" min="0.1" max="48" step="0.1" required /></label>
                <label class="eva-checkbox"><input name="retraceReturn" type="checkbox" /> Retrace the route to return to base</label>
                <button type="submit" class="btn btn-accent wide">Calculate and save scenario</button>
                <button type="button" class="btn btn-outline wide" data-eva-reset>Reset example assumptions</button>
            </form>
        </details>
        <p class="science-footnote">Illustrative rates only. Walking time ignores vertical terrain, obstacles, rests and Earth/Mars physiological validation. Reserve applies to available oxygen, battery and time.</p>
    `;

    const stress = document.createElement("section");
    stress.className = "panel-section science-model-section";
    stress.setAttribute("aria-labelledby", "stress-heading");
    stress.innerHTML = `
        <div class="panel-title-row"><h2 id="stress-heading" class="section-label">MISSION STRESS LAB</h2><span class="tiny-pill">SENSITIVITY</span></div>
        <p class="section-help">Explore how uncertain speed and resource-use assumptions change the outcome. The frequencies below are <strong>synthetic model results</strong>, not calibrated mission risks.</p>
        <label class="science-label">Parameter variation <small>uniform, each parameter independent</small>
            <select id="stress-variation" class="science-select"><option value="10">±10%</option><option value="20" selected>±20%</option><option value="35">±35%</option><option value="50">±50%</option></select>
        </label>
        <button type="button" class="btn btn-outline wide" id="stress-run">Run 500 repeatable scenarios</button>
        <div id="stress-results" class="stress-results" aria-live="polite">Run the sensitivity model after setting your route and resource assumptions.</div>
    `;

    const terrain = document.createElement("section");
    terrain.className = "panel-section science-model-section";
    terrain.setAttribute("aria-labelledby", "terrain-model-heading");
    terrain.innerHTML = `
        <div class="panel-title-row"><h2 id="terrain-model-heading" class="section-label">DEM ROUTE LAB</h2><span class="tiny-pill">TERRAIN</span></div>
        <p class="section-help">Explore elevation data and compare routes around Jezero. Load the sample terrain grid or import your own.</p>
        <button type="button" class="btn btn-accent wide" id="dem-load-official">◉ Load Jezero terrain data</button>
        <label class="btn btn-outline wide terrain-upload">↑ Import terrain grid (.json)<input id="dem-file" type="file" accept=".json,application/json" hidden /></label>
        <div id="dem-status" class="dem-status" role="status">Load the Jezero elevation grid to analyze terrain routes.</div>
        <details class="science-details"><summary>Terrain cost assumptions</summary>
            <div class="eva-form terrain-options"><label>Max modeled grade <small>%</small><input id="terrain-grade" type="number" min="1" max="100" step="1" value="18" /></label>
            <label>Slope penalty <small>weight</small><input id="terrain-penalty" type="number" min="0" max="40" step="1" value="6" /></label></div>
            <p class="section-help">These thresholds are user-selected scenario parameters, not official NASA EVA or rover operating limits.</p>
        </details>
        <details class="science-details" id="scenario-exclusion"><summary>What-if: route around a note</summary>
            <p class="section-help">Select an existing <strong>user observation</strong> to test a hypothetical no-go area. This does not certify the observation as a real hazard.</p>
            <label class="science-label">Observation <select id="exclusion-note" class="science-select"><option value="">No exclusion area</option></select></label>
            <label class="science-label">Exclusion radius <small>meters</small><input id="exclusion-radius" type="number" min="10" max="1000" step="10" value="80" /></label>
            <p class="science-footnote">The shaded area is illustrative. A* cannot cross excluded cells or cut through excluded corners.</p>
        </details>
        <button class="btn btn-accent wide" id="terrain-plan" disabled>Generate a single A* candidate</button>
        <button class="btn btn-outline wide" id="terrain-compare" disabled>Compare 3 route strategies</button>
        <div id="terrain-strategies" class="terrain-strategies" aria-live="polite"></div>
        <section class="terrain-why" id="terrain-why" aria-label="Explainable route selection">
            <div class="terrain-why-title"><strong>WHY THIS ROUTE?</strong><span>EXPLAINABLE A* · NO AI SCORING</span></div>
            <p class="section-help">Understand exactly why a route is preferred under a chosen cost function. Change the preference to recompute scores without changing any saved waypoints.</p>
            <label class="science-label">Evaluation preference
                <select id="terrain-why-preference" class="science-select" disabled>
                    <option value="distance">Shortest modeled (λ = 0)</option>
                    <option value="balanced" selected>Balanced (λ = 6)</option>
                    <option value="gentle">Slope-conscious (λ = 24)</option>
                </select>
            </label>
            <div id="terrain-why-report" aria-live="polite" class="terrain-why-report"><p class="why-empty">Load a numeric DEM, add two waypoints and choose Compare 3 route strategies to see an evidence-based explanation.</p></div>
            <button type="button" id="terrain-evidence-export" class="btn btn-outline wide" disabled>↓ Export scientific comparison (.md)</button>
            <p class="science-footnote">Exports exact modeled assumptions and candidate metrics. No private account or photo data are included.</p>
        </section>
        <div id="terrain-report" class="terrain-report" aria-live="polite"></div>
        <div id="terrain-profile"></div>
        <p class="science-footnote">A* uses 8 neighboring grid cells; movement cost is distance × (1 + slope penalty × absolute grade). It prevents cutting diagonally through NoData corners. Imported DEM data must have documented provenance; user-provided grids are not automatically verified NASA data.</p>
    `;

    panel.insertBefore(resources, inspector);
    panel.insertBefore(stress, inspector);
    panel.insertBefore(terrain, inspector);

    const evaResults = resources.querySelector("#eva-results");
    const evaForm = resources.querySelector("#eva-form");
    const demFile = terrain.querySelector("#dem-file");
    const officialButton = terrain.querySelector("#dem-load-official");
    const demStatus = terrain.querySelector("#dem-status");
    const demReport = terrain.querySelector("#terrain-report");
    const demButton = terrain.querySelector("#terrain-plan");
    const compareButton = terrain.querySelector("#terrain-compare");
    const strategiesPanel = terrain.querySelector("#terrain-strategies");
    const whyPreference = terrain.querySelector("#terrain-why-preference");
    const whyPanel = terrain.querySelector("#terrain-why-report");
    const evidenceButton = terrain.querySelector("#terrain-evidence-export");
    const exclusionSelect = terrain.querySelector("#exclusion-note");
    const exclusionRadius = terrain.querySelector("#exclusion-radius");
    const stressRun = stress.querySelector("#stress-run");
    const stressOutput = stress.querySelector("#stress-results");
    const stressVariation = stress.querySelector("#stress-variation");
    let dem = null;
    let officialLoading = null;
    let datasetRequestId = 0;
    let candidates = [];
    let comparisonSource = null;
    let sensitivitySignature = null;
    let sensitivityReport = null;
    let observationsSignature = null;
    let terrainMessage = "";
    const terrain3D = mountTerrain3D({ panel, before: inspector, store, readDem: () => dem, notify });
    const interactiveProfile = mountInteractiveTerrainProfile({
        host: terrain.querySelector("#terrain-profile"), store, map, readDem: () => dem
    });
    let lastMissionId = null;
    let lastScenarioSignature = null;
    const intelligence = mountTerrainIntelligence({
        panel, before: inspector, store,
        readDem: () => dem,
        readContext: () => ({
            zones: scenarioZones(),
            maxSlopePercent: Number(terrain.querySelector("#terrain-grade").value),
            slopePenalty: Number(terrain.querySelector("#terrain-penalty").value),
            speedKmh: (store.current.evaScenario || DEFAULT_EVA_ASSUMPTIONS).speedKmh
        })
    });

    const mathematics = mountAdvancedMathematics({ panel, before: inspector, store, readDem: () => dem });
    const advancedResearch = mountMissionResearch({ panel, before: inspector, store, map, notify, readDem: () => dem, readContext: () => ({ zones: scenarioZones(), maxSlopePercent: Number(terrain.querySelector("#terrain-grade").value), slopePenalty: Number(terrain.querySelector("#terrain-penalty").value) }) });

    function applyAssumptions(assumptions)
    {
        for (const [key, value] of Object.entries(assumptions))
        {
            const input = evaForm.elements.namedItem(key);

            if (input)
            {
                if (input.type === "checkbox")
                {
                    input.checked = value;
                }
                else
                {
                    input.value = String(value);
                }
            }
        }
    }

    function scenarioZones()
    {
        const selected = store.current.observations.find(item => item.id === exclusionSelect.value);
        const radiusMeters = Number(exclusionRadius.value);

        if (!selected || !Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000)
        {
            return [];
        }

        return [{ id: selected.id, lat: selected.lat, lon: selected.lon, radiusMeters, title: selected.title }];
    }

    function syncObservationOptions()
    {
        const notes = store.current.observations;
        const signature = `${store.current.id}:${notes.map(item => `${item.id}:${item.title}:${item.lat}:${item.lon}`).join("|")}`;

        if (signature === observationsSignature)
        {
            return;
        }

        const previous = exclusionSelect.value;
        exclusionSelect.replaceChildren(new Option("No exclusion area", ""));

        for (const note of notes)
        {
            exclusionSelect.appendChild(new Option(note.title, note.id));
        }

        exclusionSelect.value = notes.some(note => note.id === previous) ? previous : "";
        observationsSignature = signature;
    }

    function candidateProvenance(zones, maxSlopePercent, slopePenalty)
    {
        return {
            model: "A* 8-neighbor numeric DEM scenario",
            maxSlopePercent,
            slopePenalty,
            exclusionZones: zones.map(zone => ({ observationId: zone.id, title: zone.title, lat: zone.lat, lon: zone.lon, radiusMeters: zone.radiusMeters })),
            verified: false
        };
    }

    function clearComparison()
    {
        candidates = [];
        comparisonSource = null;
        strategiesPanel.replaceChildren();
        whyPreference.disabled = true;
        evidenceButton.disabled = true;
        whyPanel.innerHTML = '<p class="why-empty">Comparison changed or no longer matches the mission. Run Compare 3 route strategies again.</p>';
    }

    function renderWhyRoute()
    {
        if (!comparisonSource || !candidates.length)
        {
            return;
        }

        const decision = explainTerrainRouteChoice(candidates, whyPreference.value);
        evidenceButton.disabled = false;
        renderRouteDecision(whyPanel, decision, {
            source: dem?.source,
            maxSlopePercent: comparisonSource.maxSlopePercent,
            exclusionCount: JSON.parse(comparisonSource.exclusions).length
        });
    }

    whyPreference.addEventListener("change", renderWhyRoute);

    evidenceButton.addEventListener("click", () =>
    {
        if (!dem || !comparisonSource || !candidates.length)
        {
            notify("Recompute the DEM route comparison before exporting evidence.");
            return;
        }

        const route = store.activeRoute;
        const zones = scenarioZones();
        const current = comparisonSource.missionId === store.current.id &&
            comparisonSource.routeId === route.id &&
            comparisonSource.signature === JSON.stringify(route.points) &&
            comparisonSource.exclusions === JSON.stringify(zones) &&
            comparisonSource.maxSlopePercent === Number(terrain.querySelector("#terrain-grade").value);

        if (!current)
        {
            clearComparison();
            notify("Mission inputs changed. Compare the routes again for current evidence.");
            return;
        }

        try
        {
            const report = createScientificComparisonReport({
                mission: store.current, route, dem, candidates,
                maxSlopePercent: comparisonSource.maxSlopePercent,
                exclusionZones: zones, preference: whyPreference.value
            });
            downloadFile("mars-atlas-scientific-comparison.md", report, "text/markdown");
            notify("Scientific comparison exported with model assumptions and limitations.");
        }
        catch (error)
        {
            notify(error.message);
        }
    });

    function render()
    {
        const route = store.activeRoute;
        const assumptions = store.current.evaScenario || DEFAULT_EVA_ASSUMPTIONS;
        const distanceMeters = analyzeRoute(route.points).totalDistance;
        const estimate = estimateMarswalk(distanceMeters, assumptions);

        const signature = JSON.stringify(assumptions);
        syncObservationOptions();
        map.setScenarioZones(scenarioZones());
        intelligence.refresh();
        mathematics.refresh();
        advancedResearch.refresh();

        if (lastMissionId !== store.current.id || lastScenarioSignature !== signature)
        {
            applyAssumptions(assumptions);
            lastMissionId = store.current.id;
            lastScenarioSignature = signature;
        }

        if (route.points.length < 2)
        {
            evaResults.innerHTML = `<div class="eva-empty">Add two waypoints to estimate the selected route. You can still edit the model assumptions below.</div>`;
        }
        else
        {
            const warning = estimate.warnings.length ? `<p class="eva-warning">${estimate.warnings.map(escapeText).join(" ")}</p>` : `<p class="eva-neutral">No numerical scenario budget exceeded. This does not mean the route is safe or realistic.</p>`;
            evaResults.innerHTML = `
                <div class="eva-readouts"><div><span>TRAVEL + STOPS</span><strong>${formatHours(estimate.durationHours)}</strong><small>${formatDistance(estimate.travelDistanceMeters)} modeled movement</small></div><div><span>OXYGEN DEMAND</span><strong>${formatNumber(estimate.oxygenKg, 3)} kg</strong><small>Hypothetical consumption</small></div><div><span>BATTERY DEMAND</span><strong>${formatNumber(estimate.batteryWh, 0)} Wh</strong><small>Constant power scenario</small></div></div>
                ${budgetMarkup("Oxygen", estimate.oxygenKg, estimate.usableOxygenKg, "kg")}
                ${budgetMarkup("Battery", estimate.batteryWh, estimate.usableBatteryWh, "Wh")}
                ${budgetMarkup("Time", estimate.durationHours, estimate.usableDurationHours, "h")}
                ${warning}
            `;
        }

        demButton.disabled = !dem || route.points.length < 2;
        compareButton.disabled = !dem || route.points.length < 2;
        stressRun.disabled = route.points.length < 2;
        const currentSensitivity = `${store.current.id}:${route.id}:${distanceMeters}:${signature}:${stressVariation.value}`;

        if (sensitivitySignature && sensitivitySignature !== currentSensitivity)
        {
            sensitivitySignature = null;
            sensitivityReport = null;
            stressOutput.textContent = "Route, mission, model or variation changed. Run sensitivity again for current inputs.";
        }

        if (comparisonSource && (comparisonSource.missionId !== store.current.id || comparisonSource.routeId !== route.id || comparisonSource.signature !== JSON.stringify(route.points) || comparisonSource.exclusions !== JSON.stringify(scenarioZones()) || comparisonSource.maxSlopePercent !== Number(terrain.querySelector("#terrain-grade").value)))
        {
            clearComparison();
        }

        interactiveProfile.refresh();
        terrain3D.refresh();

        if (route.terrainModel)
        {
            const t = route.terrainModel;
            const whatIf = t.scenario?.exclusionZones?.length ? `<small>What-if exclusion: ${t.scenario.exclusionZones.map(zone => `${escapeText(zone.title)} (${formatNumber(zone.radiusMeters, 0)} m)`).join(", ")}. This is a user-defined assumption, not a mapped hazard.</small>` : "";
            demReport.innerHTML = `<div class="dem-candidate"><strong>Active route derived from imported DEM</strong><span>Modeled distance ${formatDistance(t.stats.distanceMeters)} · ascent ${formatNumber(t.stats.ascentMeters)} m · max grade ${formatNumber(t.stats.maxGradePercent)}%</span>${whatIf}<small>Source: ${escapeText(t.source)} · User-imported / unverified · Not a safety certification</small></div>${terrainMessage ? `<p>${escapeText(terrainMessage)}</p>` : ""}`;
        }
        else
        {
            demReport.textContent = terrainMessage;
        }
    }

    stressRun.addEventListener("click", () =>
    {
        try
        {
            const route = store.activeRoute;
            const distance = analyzeRoute(route.points).totalDistance;
            const assumptions = store.current.evaScenario || DEFAULT_EVA_ASSUMPTIONS;
            const report = estimateResourceEnvelope(distance, assumptions, { variationPercent: Number(stressVariation.value), samples: 500, seed: 2026 });
            sensitivityReport = report;
            sensitivitySignature = `${store.current.id}:${route.id}:${distance}:${JSON.stringify(assumptions)}:${stressVariation.value}`;
            const percentage = value => `${(value * 100).toFixed(1)}%`;
            stressOutput.innerHTML = `
                <div class="stress-stat"><span>Duration, 10th–90th percentile</span><strong>${formatHours(report.durationHours.p10)} – ${formatHours(report.durationHours.p90)}</strong></div>
                <div class="stress-stat"><span>O₂ demand, 10th–90th percentile</span><strong>${formatNumber(report.oxygenKg.p10, 3)}–${formatNumber(report.oxygenKg.p90, 3)} kg</strong></div>
                <div class="stress-stat"><span>Energy, 10th–90th percentile</span><strong>${formatNumber(report.batteryWh.p10)}–${formatNumber(report.batteryWh.p90)} Wh</strong></div>
                <div class="stress-stat"><span>Runs exceeding any reserve-adjusted allowance</span><strong>${percentage(report.exceedanceFrequency.any)} · ${report.samples} artificial trials</strong></div>
                <p class="science-footnote">${escapeText(report.disclaimer)} Fixed seed ${report.seed}; repeating identical inputs produces the same results.</p>
            `;
            notify("Scenario sensitivity analysis completed. Numbers are illustrative only.");
        }
        catch (error)
        {
            stressOutput.textContent = error.message;
        }
    });

    stressVariation.addEventListener("change", () =>
    {
        sensitivitySignature = null;
        sensitivityReport = null;
        stressOutput.textContent = "Variation changed. Run the sensitivity model again.";
    });

    exclusionSelect.addEventListener("change", () =>
    {
        clearComparison();
        terrainMessage = scenarioZones().length ? "Selected user observation is modeled as a hypothetical no-go area." : "Exclusion scenario cleared.";
        render();
    });

    exclusionRadius.addEventListener("change", () =>
    {
        clearComparison();
        terrainMessage = "Exclusion radius changed. Recompute an A* route to use it.";
        render();
    });

    evaForm.addEventListener("submit", event =>
    {
        event.preventDefault();

        try
        {
            const next = {};

            for (const name of Object.keys(DEFAULT_EVA_ASSUMPTIONS))
            {
                const field = evaForm.elements.namedItem(name);
                next[name] = name === "retraceReturn" ? field.checked : Number(field.value);
            }

            store.setEvaScenario(next);
            applyAssumptions(store.current.evaScenario);
            notify("Marswalk scenario assumptions saved in this mission.");
        }
        catch (error)
        {
            notify(error.message);
        }
    });

    resources.querySelector("[data-eva-reset]").addEventListener("click", () =>
    {
        store.setEvaScenario(DEFAULT_EVA_ASSUMPTIONS);
        applyAssumptions(DEFAULT_EVA_ASSUMPTIONS);
        notify("Illustrative example parameters restored.");
    });

    async function loadBundledDem()
    {
        if (dem?.bundledSource)
        {
            return dem;
        }

        if (officialLoading)
        {
            return officialLoading;
        }

        const requestId = ++datasetRequestId;
        officialButton.disabled = true;
        demStatus.textContent = "Reading a real, numeric USGS/NASA CTX elevation clip for Jezero…";
        officialLoading = loadJezeroDem().then(loaded =>
        {
            if (requestId !== datasetRequestId)
            {
                return null;
            }

            dem = loaded;
            clearComparison();
            terrainMessage = "Official USGS/NASA CTX elevation sample loaded. A* works within this small Jezero clip. No EVA safety certification.";
            demStatus.innerHTML = `<strong>USGS CTX DTM · 20 m SOURCE · ${dem.width} × ${dem.height}</strong><small>${escapeText(dem.source)}</small><small>Real numeric elevations from a documented Mars raster; no-data, vertical datum and uncertainty matter. Study area: 18.438–18.470° N, 77.443–77.478° E.</small>`;
            notify("Real numeric Jezero CTX elevations loaded. Set your route inside the documented coverage.");
            render();
            onTerrainChange?.();
            return dem;
        }).catch(error =>
        {
            if (requestId !== datasetRequestId)
            {
                return null;
            }

            terrainMessage = `Jezero DEM unavailable: ${error.message}`;
            demStatus.textContent = terrainMessage;
            notify("Bundled elevation data did not load; importing a local DEM remains available.");
            return null;
        }).finally(() =>
        {
            if (requestId === datasetRequestId)
            {
                officialButton.disabled = false;
            }

            officialLoading = null;
        });
        return officialLoading;
    }

    officialButton.addEventListener("click", loadBundledDem);

    demFile.addEventListener("change", async event =>
    {
        const file = event.target.files[0];

        if (!file)
        {
            return;
        }

        try
        {
            if (file.size > 4500000)
            {
                throw new Error("DEM JSON exceeds 4.5 MB. Prepare a smaller clip.");
            }

            const imported = validateDem(JSON.parse(await file.text()));
            datasetRequestId++;
            officialButton.disabled = false;
            dem = imported;
            dem.bundledSource = false;
            clearComparison();
            terrainMessage = "Numeric DEM imported into this browser session. Adjust slope assumptions and request a route alternative.";
            demStatus.innerHTML = `<strong>GRID LOADED · ${dem.width} × ${dem.height} cells</strong><small>${escapeText(dem.source)} · ${escapeText(dem.resolution)}</small><small>Reference: ${escapeText(dem.horizontalDatum)} / ${escapeText(dem.verticalDatum)}. Provenance supplied by the importer; not independently verified.</small>`;
            notify("Numeric elevation grid imported; route planner enabled.");
        }
        catch (error)
        {
            terrainMessage = `DEM import rejected: ${error.message}`;
            notify(terrainMessage);
        }

        demFile.value = "";
        render();
        onTerrainChange();
    });

    demButton.addEventListener("click", () =>
    {
        if (!dem)
        {
            return;
        }

        const maxSlopePercent = Number(terrain.querySelector("#terrain-grade").value);
        const slopePenalty = Number(terrain.querySelector("#terrain-penalty").value);

        try
        {
            if (store.current.routes.length >= 15)
            {
                throw new Error("Mission route limit reached (15). Remove an unused route first.");
            }

            const zones = scenarioZones();
            const planned = planRouteOnDem(dem, store.activeRoute.points, { maxSlopePercent, slopePenalty, exclusionZones: zones, maxWaypoints: 80 });

            if (!planned.ok)
            {
                terrainMessage = planned.reason;
                render();
                notify("No terrain candidate created. Read the DEM Route Lab message.");
                return;
            }

            const route = store.addRoute("A* terrain candidate · unverified");

            if (!route)
            {
                throw new Error("Unable to create an alternative route.");
            }

            route.points = planned.points.map(point => ({ id: crypto.randomUUID(), lat: point.lat, lon: point.lon }));
            route.terrainModel = { source: planned.source, stats: planned.stats, scenario: candidateProvenance(zones, maxSlopePercent, slopePenalty), unverified: true };
            terrainMessage = `Created an editable A* candidate through ${planned.stats.cellCount} modeled grid cells${zones.length ? ", avoiding a hypothetical field-note exclusion" : ""}. Each manual waypoint remained an anchor. The DEM and scenario are not independently validated.`;
            store.save();
            map.focusRoute();
            notify("A* terrain candidate added to this mission. It remains manually editable and unverified.");
        }
        catch (error)
        {
            terrainMessage = error.message;
            render();
            notify(error.message);
        }
    });

    terrain.querySelector("#terrain-grade").addEventListener("change", () =>
    {
        clearComparison();
        terrainMessage = "Slope threshold changed. Recompute alternatives with the updated assumption.";
        render();
    });

    compareButton.addEventListener("click", () =>
    {
        if (!dem)
        {
            return;
        }

        const source = store.activeRoute;
        const zones = scenarioZones();
        const maxSlopePercent = Number(terrain.querySelector("#terrain-grade").value);

        try
        {
            const results = compareTerrainStrategies(dem, source.points, { maxSlopePercent, exclusionZones: zones, maxWaypoints: 80 });
            candidates = results;
            comparisonSource = { missionId: store.current.id, routeId: source.id, signature: JSON.stringify(source.points), exclusions: JSON.stringify(zones), maxSlopePercent };
            const header = '<div class="scenario-head">Three route cost preferences on the same numeric DEM and the same manual waypoint anchors. The ranking depends on the preference and is not a safety certification.</div>';
            const manualDistance = analyzeRoute(source.points).totalDistance;
            strategiesPanel.innerHTML = header + '<p class="science-footnote">Manual waypoint polyline: ' +
                formatDistance(manualDistance) + '. A* figures below use cell-by-cell gridded paths, so do not interpret their different lengths as a measured safety advantage over the manual polyline.</p>' +
                results.map((item, index) =>
                {
                    if (!item.ok)
                    {
                        return '<div class="strategy-card"><strong>' + escapeText(item.label) +
                            '</strong><p>' + escapeText(item.reason) + '</p></div>';
                    }

                    return '<div class="strategy-card"><strong>' + escapeText(item.label) +
                        '</strong><small>' + formatDistance(item.stats.distanceMeters) +
                        ' DEM-grid route · +' + formatNumber(item.stats.ascentMeters) +
                        ' m ascent · ' + formatNumber(item.stats.descentMeters) +
                        ' m descent · ' + formatNumber(item.stats.maxGradePercent) +
                        '% maximum adjacent-cell grade · ' + item.stats.visited +
                        ' explored grid nodes</small><button class="btn btn-outline wide" type="button" data-use-strategy="' +
                        index + '">Add editable candidate</button></div>';
                }).join("");
            whyPreference.disabled = false;
            renderWhyRoute();
            terrainMessage = "Route strategies computed from the selected numeric DEM. The model is not certified for astronaut or rover safety.";
            render();
        }
        catch (error)
        {
            terrainMessage = error.message;
            clearComparison();
            render();
        }
    });

    strategiesPanel.addEventListener("click", event =>
    {
        const button = event.target.closest("[data-use-strategy]");

        if (!button)
        {
            return;
        }

        const index = Number(button.dataset.useStrategy);
        const candidate = candidates[index];

        if (!candidate?.ok || !comparisonSource || store.activeRoute.id !== comparisonSource.routeId)
        {
            notify("This comparison is outdated. Run it again for the current route.");
            return;
        }

        if (store.current.routes.length >= 15)
        {
            notify("Mission route limit reached (15). Remove a route first.");
            return;
        }

        const sourceDetails = comparisonSource;
        const zones = scenarioZones();
        const route = store.addRoute(`${candidate.label} · numeric DEM candidate`);
        route.points = candidate.points.map(point => ({ id: crypto.randomUUID(), lat: point.lat, lon: point.lon }));
        route.terrainModel = { source: candidate.source, stats: candidate.stats, scenario: candidateProvenance(zones, sourceDetails.maxSlopePercent, candidate.slopePenalty), unverified: true };
        terrainMessage = "Added a manually editable candidate. DEM coverage and user-selected cost/exclusion assumptions do not certify real-world traversability.";
        clearComparison();
        store.save();
        map.focusRoute();
        notify("A* strategy added as a new editable route.");
    });

    return {
        render,
        loadBundledDem,
        get isDemReady()
        {
            return Boolean(dem);
        },
        get numericDem()
        {
            return dem;
        },
        getScenarioBrief()
        {
            const route = store.activeRoute;
            const distance = analyzeRoute(route.points).totalDistance;
            const report = estimateMarswalk(distance, store.current.evaScenario);
            const lines = [
                "## Illustrative Marswalk resource scenario",
                `Travel mode: ${report.assumptions.retraceReturn ? "Out-and-back by retracing the route" : "One-way"}`,
                `Walking speed assumption: ${report.assumptions.speedKmh} km/h`,
                `Science stop allowance: ${report.assumptions.observationMinutes} minutes`,
                `Modeled total duration: ${formatHours(report.durationHours)}`,
                `Oxygen model: ${report.oxygenKg.toFixed(3)} kg at ${report.assumptions.oxygenKgPerHour} kg/hour`,
                `Energy model: ${report.batteryWh.toFixed(1)} Wh at ${report.assumptions.batteryWatts} watts`,
                `Reserve rule: ${report.assumptions.reservePercent}% held back`,
                `Scenario flags: ${report.warnings.join(" ") || "No numerical allowance exceeded"}`,
                "All rates are user-specified scenario assumptions, not measured NASA telemetry. Terrain-dependent effects are excluded."
            ];
            const activeSensitivity = `${store.current.id}:${route.id}:${distance}:${JSON.stringify(report.assumptions)}:${stressVariation.value}`;

            if (sensitivityReport && sensitivitySignature === activeSensitivity)
            {
                lines.push("", "## Sensitivity envelope (illustrative)");
                lines.push(`Artificial uniform input variation: ±${sensitivityReport.variationPercent}% over ${sensitivityReport.samples} deterministic seeded trials`);
                lines.push(`Duration 10th–90th percentile: ${formatHours(sensitivityReport.durationHours.p10)} – ${formatHours(sensitivityReport.durationHours.p90)}`);
                lines.push(`Oxygen 10th–90th percentile: ${formatNumber(sensitivityReport.oxygenKg.p10, 3)}–${formatNumber(sensitivityReport.oxygenKg.p90, 3)} kg`);
                lines.push(`Energy 10th–90th percentile: ${formatNumber(sensitivityReport.batteryWh.p10)}–${formatNumber(sensitivityReport.batteryWh.p90)} Wh`);
                lines.push(`Artificial trial frequency beyond any allowance: ${formatNumber(sensitivityReport.exceedanceFrequency.any * 100)}%`);
                lines.push("Not calibrated NASA probabilities, measurements or safety certification.");
            }

            if (comparisonSource && candidates.length)
            {
                const decision = explainTerrainRouteChoice(candidates, whyPreference.value);
                const selected = decision.alternatives.find(item => decision.winners.includes(item.id));
                lines.push("", "## Why this route? (deterministic A* explanation)",
                    `Cost definition: C = D + ${decision.slopePenalty} × (ascent + descent), all terms in meters.`,
                    decision.explanation);

                if (selected)
                {
                    lines.push(`Preferred candidate: ${selected.label}. Model cost: ${selected.costMeters.toFixed(2)} m; grid distance: ${selected.distanceMeters.toFixed(2)} m; ascent + descent: ${selected.verticalMeters.toFixed(2)} m.`);
                }

                lines.push("Rankings use only the loaded numeric DEM, user-selected constraints and the tested candidates; not an astronaut safety assessment.");
            }

            const researchBrief = advancedResearch.brief();

            if (researchBrief)
            {
                lines.push(researchBrief);
            }

            const advancedBrief = mathematics.brief();

            if (advancedBrief)
            {
                lines.push(advancedBrief);
            }

            const profileBrief = interactiveProfile.brief();

            if (profileBrief)
            {
                lines.push(profileBrief);
            }

            const spatialBrief = intelligence.brief();

            if (spatialBrief)
            {
                lines.push(spatialBrief);
            }

            return lines.join("\n");
        }
    };
}
