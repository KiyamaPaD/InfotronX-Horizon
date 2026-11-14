import { DStarLite } from "./dstar-lite.js";
import { paretoTerrainRoutes } from "./pareto-routes.js";
import { analyzeTerrainTopology } from "./terrain-topology.js";
import { auditDemMetadata, compareAlignedDems, posteriorVerticalBias } from "./dem-audit.js";
import { compactGridPath } from "./graph-grid.js";
import { marsDistance } from "./geo.js";
import { calculateGrade, findTerrainPath, validateDem } from "./terrain.js";

const number = (value, decimals = 2) => Number(value).toLocaleString("en-US", { maximumFractionDigits: decimals });

export function mountMissionResearch({ panel, before, store, map, readDem, readContext, notify })
{
    const section = document.createElement("section");
    section.className = "panel-section math-research-v9";
    section.setAttribute("aria-labelledby", "v9-heading");
    section.innerHTML = `
        <div class="panel-title-row"><h2 id="v9-heading" class="section-label">ADVANCED ALGORITHMS</h2><span class="tiny-pill">ROUTING</span></div>
        <p class="section-help">Incremental graph search, distance/ascent tradeoffs, topological structure and scientific DEM comparisons. <strong>Manual routes stay in your control.</strong></p>
        <div class="intel-stack">
            <div class="intel-tool">
                <h3>1 · D* Lite incremental replanning</h3>
                <p class="section-help">First find the route without exclusions. Then change the what-if field-note zone in DEM Route Lab and update only affected graph vertices. Cost is cross-checked against a fresh A* solution.</p>
                <div class="v9-actions"><button type="button" class="btn btn-outline wide" id="v9-init-dstar">Initialize baseline D* Lite</button><button type="button" class="btn btn-accent wide" id="v9-replan-dstar">Replan with current exclusion</button></div>
                <div id="v9-dstar-status" class="intel-output" role="status">Load a numeric DEM and choose exactly two manual waypoints.</div>
            </div>
            <div class="intel-tool">
                <h3>2 · Bounded Pareto route explorer</h3>
                <p class="section-help">Compare distance and cumulative uphill ascent using nondominated graph labels. The number of labels is capped; if truncated, the global Pareto frontier is <strong>not</strong> claimed.</p>
                <button type="button" class="btn btn-outline wide" id="v9-run-pareto">Compute distance/ascent tradeoffs</button>
                <div id="v9-pareto-status" class="intel-output" role="status">Two waypoints are needed. Other science stops are never silently skipped.</div>
                <div id="v9-pareto-cards" class="v9-results"></div>
            </div>
            <div class="intel-tool">
                <h3>3 · Persistent terrain topology</h3>
                <p class="section-help">Track upper and lower elevation sets as the altitude threshold changes. Detect finite topological peak/basin contrasts at 4-connected DEM resolution, not actual rock formations.</p>
                <label class="science-label">Minimum peak/basin persistence <small>meters</small><input type="number" id="v9-persistence" min="0" max="1000" step="0.5" value="2" /></label>
                <button type="button" class="btn btn-outline wide" id="v9-run-topology">Analyze elevation connectivity</button>
                <div id="v9-topology-result" class="intel-output" role="status">Load a DEM, then identify prominent changes in connected height regions.</div>
            </div>
            <div class="intel-tool">
                <h3>4 · DEM uncertainty and reference audit</h3>
                <p class="section-help">Show the difference between raster posting and validated effective terrain detail. Optional independent DEM comparison requires documented matching horizontal and vertical datums.</p>
                <button type="button" class="btn btn-outline wide" id="v9-run-audit">Audit loaded DEM metadata</button>
                <div id="v9-audit-result" class="intel-output" role="status">No independently aligned HiRISE comparison is included. Local height accuracy is currently unknown.</div>
                <label class="btn btn-outline wide terrain-upload">↑ Compare my independent DEM JSON<input type="file" id="v9-reference-file" accept=".json,application/json" hidden /></label>
                <div id="v9-compare-result" class="intel-output" role="status">No independently sourced reference DEM loaded. Published Jezero statistics are not a substitute for local validation.</div>
                <details class="science-details"><summary>Conditional Bayesian height-offset calculator</summary>
                    <p class="section-help">Only usable after reference comparison. You must provide your own justified uncertainty and effective independent-sample count. A DEM's many spatially correlated pixels are not automatically independent.</p>
                    <div class="v9-parameter-grid">
                        <label>Prior mean (m)<input id="v9-prior-mean" type="number" step="any" placeholder="Required" /></label>
                        <label>Prior SD (m)<input id="v9-prior-sd" type="number" min="0.001" step="any" placeholder="Required" /></label>
                        <label>Observation SD (m)<input id="v9-obs-sd" type="number" min="0.001" step="any" placeholder="Required" /></label>
                        <label>Effective sample count<input id="v9-effective-n" type="number" min="1" step="1" placeholder="Justified" /></label>
                    </div>
                    <button type="button" class="btn btn-outline wide" id="v9-run-posterior">Calculate conditional posterior</button>
                    <div id="v9-posterior-result" class="intel-output" role="status">No posterior without both matched measurements and explicit, defensible inputs.</div>
                </details>
            </div>
        </div>
        <p class="science-footnote">A* / D* Lite / Pareto use height differences from a sampled DEM. They ignore rocks, wheel slip, soil bearing, radiation and astronaut mobility limits. Scientific uncertainties cannot be inferred from the number of image pixels.</p>
    `;
    panel.insertBefore(section, before);

    const get = selector => section.querySelector(selector);
    const dstarStatus = get("#v9-dstar-status");
    const paretoStatus = get("#v9-pareto-status");
    const paretoCards = get("#v9-pareto-cards");
    const topoStatus = get("#v9-topology-result");
    const auditStatus = get("#v9-audit-result");
    const compareStatus = get("#v9-compare-result");
    const posteriorStatus = get("#v9-posterior-result");
    let planner = null, plannerKey = "", baselineCost = null;
    let alternatives = [], paretoSignature = "", reference = null, compared = null, comparedDemKey = "";
    let reportRecords = [], reportSignature = "";

    function routeKey()
    {
        const route = store.activeRoute;
        const dem = readDem();
        const ctx = readContext();
        return JSON.stringify([store.current.id, route.id, route.points.map(p => [p.lat, p.lon]), dem?.source, dem?.width, dem?.height, dem?.north, ctx.maxSlopePercent, ctx.slopePenalty]);
    }

    function contextSignature()
    {
        const ctx = readContext();
        return JSON.stringify([routeKey(), ctx.zones]);
    }

    function twoPointScenario()
    {
        const dem = readDem();

        if (!dem)
        {
            throw new Error("Load the official Jezero CTX DEM or an independently sourced numeric DEM first.");
        }

        if (store.activeRoute.points.length !== 2)
        {
            throw new Error("Use a two-waypoint route for this planner. Intermediate manual science anchors are never omitted without consent.");
        }

        return { dem, waypoints: store.activeRoute.points, context: readContext() };
    }

    function saveRecord(startsWith, line)
    {
        reportRecords = reportRecords.filter(value => !value.startsWith(startsWith));
        reportRecords.push(line);
        reportSignature = contextSignature();
    }

    function refresh()
    {
        const key = routeKey();

        if (planner && plannerKey !== key)
        {
            planner = null;
            baselineCost = null;
            dstarStatus.textContent = "Route or DEM changed. Initialize D* Lite again.";
        }

        if (alternatives.length && paretoSignature !== contextSignature())
        {
            alternatives = [];
            paretoCards.replaceChildren();
            paretoStatus.textContent = "Route or assumptions changed. Recompute Pareto alternatives.";
        }

        if (reportSignature && reportSignature !== contextSignature())
        {
            reportRecords = [];
            reportSignature = "";
        }

        const available = Boolean(readDem());
        const currentDem = readDem();
        const comparisonKey = currentDem ? JSON.stringify([currentDem.source, currentDem.width, currentDem.height, currentDem.north, currentDem.west, currentDem.latStep, currentDem.lonStep]) : "";

        if (compared && comparedDemKey !== comparisonKey)
        {
            compared = null;
            reference = null;
            comparedDemKey = "";
            compareStatus.textContent = "Active DEM changed. Independent reference comparison invalidated; upload it again.";
            posteriorStatus.textContent = "The prior height comparison is no longer valid.";
        }

        for (const selector of ["#v9-init-dstar", "#v9-replan-dstar", "#v9-run-pareto", "#v9-run-topology", "#v9-run-audit"])
        {
            get(selector).disabled = !available;
        }
    }

    get("#v9-init-dstar").addEventListener("click", () =>
    {
        try
        {
            const { dem, waypoints, context } = twoPointScenario();
            planner = new DStarLite(dem, waypoints[0], waypoints[1], { maxSlopePercent: context.maxSlopePercent, slopePenalty: context.slopePenalty });
            plannerKey = routeKey();
            const result = planner.compute();
            baselineCost = result.ok ? result.costMeters : null;
            dstarStatus.textContent = result.ok ? `Unexcluded baseline: ${number(result.distanceMeters)} m, ${number(result.ascentMeters)} m uphill, modeled cost ${number(result.costMeters)}; ${result.expanded} vertices expanded. Now set an exclusion in DEM Route Lab and press Replan.` : result.reason;
            saveRecord("D* Lite:", `D* Lite: baseline ${result.ok ? `${result.costMeters.toFixed(2)} modeled cost meters` : "unreachable"} before hypothetical exclusions. No safety certification.`);
        }
        catch (error)
        {
            dstarStatus.textContent = error.message;
        }
    });

    get("#v9-replan-dstar").addEventListener("click", () =>
    {
        try
        {
            const { dem, waypoints, context } = twoPointScenario();

            if (!planner || plannerKey !== routeKey())
            {
                throw new Error("Initialize the unexcluded D* Lite baseline first. The current route or terrain assumptions have changed.");
            }

            const edit = planner.updateExclusions(context.zones);
            const result = planner.compute();
            const check = findTerrainPath(dem, waypoints[0], waypoints[1], { maxSlopePercent: context.maxSlopePercent, slopePenalty: context.slopePenalty, exclusionZones: context.zones });
            const match = result.ok === check.ok && (!result.ok || Math.abs(result.costMeters - check.costMeters) < 1e-4);

            if (!match)
            {
                throw new Error("D* Lite / A* cost disagreement. Result withheld; investigate graph consistency before presenting it.");
            }

            const text = result.ok ? `Updated route: ${number(result.distanceMeters)} m, ${number(result.ascentMeters)} m ascent, cost ${number(result.costMeters)}. ${result.expanded} vertices expanded (fresh A* visited ${check.visited}); ${edit.changedCells} cells changed, ${edit.reprocessedVertices} vertices reconsidered. A* cost matches. ${baselineCost === null ? "" : `Baseline modeled cost ${number(baselineCost)}.`}` : `Replanned scenario has no feasible modeled route: ${result.reason}. A* independently confirms infeasibility.`;
            dstarStatus.textContent = text;
            saveRecord("D* Lite:", `D* Lite: ${text} All limitations remain scenario-only.`);
        }
        catch (error)
        {
            dstarStatus.textContent = error.message;
        }
    });

    get("#v9-run-pareto").addEventListener("click", () =>
    {
        try
        {
            const { dem, waypoints, context } = twoPointScenario();
            const results = paretoTerrainRoutes(dem, waypoints, { maxSlopePercent: context.maxSlopePercent, slopePenalty: context.slopePenalty, exclusionZones: context.zones, maxLabelsPerCell: 12, maxExpansions: 45000, maxResults: 5 });
            paretoCards.replaceChildren();
            alternatives = results.ok ? results.routes : [];
            paretoSignature = contextSignature();
            paretoStatus.textContent = results.ok ? `${results.allGoalLabels} nondominated goal labels found · ${results.expanded} expansions · ${results.clipped} clipped labels. ${results.warning}` : results.reason;

            if (results.ok)
            {
                for (const [index, route] of results.routes.entries())
                {
                    const line = document.createElement("div");
                    line.className = "v9-route-option";
                    const summary = document.createElement("strong");
                    summary.textContent = `Candidate ${index + 1}: ${number(route.distanceMeters)} m · +${number(route.ascentMeters)} m ascent`;
                    const note = document.createElement("small");
                    const reduced = compactGridPath(route.cells, dem.width);
                    note.textContent = `${route.cells.length} DEM cells → ${reduced.length} turning points. ${results.truncated ? "Bounded approximation" : "Non-dominated in explored exact grid"}.`;
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "btn btn-outline wide";
                    button.dataset.paretoIndex = String(index);
                    button.textContent = "Add as editable route";
                    button.disabled = reduced.length > 80;
                    line.append(summary, note, button);
                    paretoCards.appendChild(line);
                }
            }

            saveRecord("Pareto:", `Pareto: ${results.ok ? `${results.routes.length} displayed distance/ascent routes; ${results.allGoalLabels} nondominated goal labels, expanded ${results.expanded}; truncated ${results.truncated}` : results.reason}. User-assumed grades and bounded search only.`);
        }
        catch (error)
        {
            paretoStatus.textContent = error.message;
            alternatives = [];
            paretoCards.replaceChildren();
        }
    });

    paretoCards.addEventListener("click", event =>
    {
        const button = event.target.closest("[data-pareto-index]");

        if (!button)
        {
            return;
        }

        try
        {
            if (!alternatives.length || paretoSignature !== contextSignature())
            {
                throw new Error("Pareto comparison became stale. Recalculate before adding a route.");
            }

            const routeOption = alternatives[Number(button.dataset.paretoIndex)];
            const dem = readDem();
            const reduced = compactGridPath(routeOption.cells, dem.width);

            if (reduced.length > 80 || store.current.routes.length >= 15)
            {
                throw new Error("Route exceeds the mission limit (80 turning points or 15 routes). No points were discarded.");
            }

            const context = readContext();
            const route = store.addRoute("Pareto distance/ascent · scenario");

            if (!route)
            {
                throw new Error("Cannot add another mission route.");
            }

            route.points = reduced.map(i => ({ id: crypto.randomUUID(), ...routeOption.points[routeOption.cells.indexOf(i)] }));
            let descent = 0, maxGrade = 0;

            for (let i = 1; i < routeOption.cells.length; i++)
            {
                const earlier = routeOption.cells[i - 1], later = routeOption.cells[i];
                const elevationChange = dem.elevations[later] - dem.elevations[earlier];
                const distance = marsDistance(routeOption.points[i - 1], routeOption.points[i]);
                maxGrade = Math.max(maxGrade, Math.abs(calculateGrade(dem.elevations[earlier], dem.elevations[later], distance)));
                descent += Math.max(0, -elevationChange);
            }

            route.terrainModel = {
                source: dem.source,
                unverified: true,
                stats: { distanceMeters: routeOption.distanceMeters, ascentMeters: routeOption.ascentMeters, descentMeters: descent, maxGradePercent: maxGrade },
                scenario: { model: "Two-objective Pareto on sampled DEM", maxSlopePercent: context.maxSlopePercent, slopePenalty: context.slopePenalty, exclusionZones: context.zones, verified: false }
            };
            store.save();
            map?.focusRoute?.();
            notify("Pareto candidate added as editable mission route. It is not a certified traversability recommendation.");
        }
        catch (error)
        {
            paretoStatus.textContent = error.message;
        }
    });

    get("#v9-run-topology").addEventListener("click", () =>
    {
        try
        {
            const dem = readDem();
            const threshold = Number(get("#v9-persistence").value);

            if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1000)
            {
                throw new Error("Persistence threshold must be between 0 and 1000 meters.");
            }

            const result = analyzeTerrainTopology(dem, { minPersistenceMeters: threshold, maxFeatures: 8 });
            topoStatus.replaceChildren();
            const lead = document.createElement("strong");
            lead.textContent = `${number(result.inspectedCells, 0)} valid elevations · ${result.totalFinitePeaks} finite peak contrasts · ${result.totalFiniteBasins} basin contrasts`;
            topoStatus.append(lead);

            for (const [label, rows] of [["Peaks", result.peaks], ["Basins", result.basins]])
            {
                const heading = document.createElement("strong");
                heading.textContent = `${label} ≥ ${threshold} m contrast`;
                topoStatus.append(heading);
                const details = document.createElement("small");
                details.textContent = rows.length ? rows.map(f => `${number(f.birthMeters)} → ${number(f.mergeMeters)} m (${number(f.persistenceMeters)} m)`).join(" · ") : "None above this threshold";
                topoStatus.append(details);
            }

            const caveat = document.createElement("small");
            caveat.textContent = result.caveat;
            topoStatus.append(caveat);
            saveRecord("Topology:", `Topology: ${result.totalFinitePeaks} finite peak pairs / ${result.totalFiniteBasins} basin pairs on 4-neighbor sampled DEM; threshold ${threshold} m. Neither geology classification nor uncertainty calibration.`);
        }
        catch (error)
        {
            topoStatus.textContent = error.message;
        }
    });

    get("#v9-run-audit").addEventListener("click", () =>
    {
        try
        {
            const result = auditDemMetadata(readDem());
            auditStatus.replaceChildren();
            const lead = document.createElement("strong");
            lead.textContent = `${number(result.validCells, 0)} / ${number(result.totalCells, 0)} numeric cells · ${number(result.coverageFraction * 100, 1)}% coverage`;
            const detail = document.createElement("small");
            detail.textContent = `Sample posting near center: ${number(result.eastPostingMeters)} m east × ${number(result.northPostingMeters)} m north. CRS: ${result.horizontalDatum}. Height reference: ${result.verticalDatum}.`;
            const warning = document.createElement("small");
            warning.textContent = result.notes.join(" ");
            auditStatus.append(lead, detail, warning);
            saveRecord("DEM audit:", `DEM audit: posting ${result.eastPostingMeters.toFixed(2)} × ${result.northPostingMeters.toFixed(2)} m; ${result.validCells}/${result.totalCells} valid cells; local precision uncalibrated.`);
        }
        catch (error)
        {
            auditStatus.textContent = error.message;
        }
    });

    get("#v9-reference-file").addEventListener("change", async event =>
    {
        const file = event.target.files[0];
        event.target.value = "";

        if (!file)
        {
            return;
        }

        try
        {
            if (file.size > 4500000)
            {
                throw new Error("Reference DEM JSON is limited to 4.5 MB. Prepare a smaller independent clip.");
            }

            reference = validateDem(JSON.parse(await file.text()));
            compared = compareAlignedDems(readDem(), reference, { sampleStride: 2 });
            const sourceDem = readDem();
            comparedDemKey = JSON.stringify([sourceDem.source, sourceDem.width, sourceDem.height, sourceDem.north, sourceDem.west, sourceDem.latStep, sourceDem.lonStep]);
            compareStatus.textContent = compared.ok ? `Paired ${compared.pairedSamples} grid samples · primary minus reference mean ${number(compared.biasMeters)} m · RMS difference ${number(compared.rmsDifferenceMeters)} m · residual scatter ${number(compared.residualScatterMeters)} m. ${compared.caveat}` : compared.reason;
            saveRecord("DEM comparison:", compared.ok ? `DEM comparison: ${compared.pairedSamples} matched sample pairs, residual bias ${compared.biasMeters.toFixed(2)} m and RMS ${compared.rmsDifferenceMeters.toFixed(2)} m. Reference ${reference.source}; local accuracy not yet certified.` : `DEM comparison: ${compared.reason}`);
        }
        catch (error)
        {
            compared = null;
            reference = null;
            comparedDemKey = "";
            compareStatus.textContent = `Reference comparison rejected: ${error.message}`;
        }
    });

    get("#v9-run-posterior").addEventListener("click", () =>
    {
        try
        {
            if (!compared?.ok)
            {
                throw new Error("A successful independent DEM comparison is required before a conditional Bayesian update.");
            }

            const n = Number(get("#v9-effective-n").value);
            const fields = ["#v9-prior-mean", "#v9-prior-sd", "#v9-obs-sd", "#v9-effective-n"];

            if (fields.some(selector => !get(selector).value.trim()))
            {
                throw new Error("Complete every prior, measurement SD and effective independent-sample field; nothing is assumed for you.");
            }

            const posterior = posteriorVerticalBias(compared.biasMeters, { priorMeanMeters: Number(get("#v9-prior-mean").value), priorStdMeters: Number(get("#v9-prior-sd").value), observationStdMeters: Number(get("#v9-obs-sd").value), effectiveIndependentSamples: n });
            posteriorStatus.textContent = `Conditional mean ${number(posterior.posteriorMeanMeters)} m; 95% Gaussian interval [${number(posterior.conditionalInterval95Meters[0])}, ${number(posterior.conditionalInterval95Meters[1])}] m. ${posterior.caveat}`;
            saveRecord("Bayesian:", `Bayesian: conditional posterior mean ${posterior.posteriorMeanMeters.toFixed(2)} m for paired DEM height bias. User-provided prior, SD and effective sample count, not a calibrated NASA precision statement.`);
        }
        catch (error)
        {
            posteriorStatus.textContent = error.message;
        }
    });

    return {
        refresh,
        brief()
        {
            return reportRecords.length && reportSignature === contextSignature() ? `\n## Research algorithms (experimental)\n${reportRecords.join("\n")}\nAll results are mathematical models on finite DEM samples; uncertainty and safe traversability are not certified.` : "";
        }
    };
}
