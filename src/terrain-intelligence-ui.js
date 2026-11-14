import { analyzeLineOfSight, analyzeTerrainSurface, computeReachability } from "./terrain-intelligence.js";
import { formatDistance } from "./geo.js";
import { analyzeHaarTerrain } from "./measure-theory.js";

const number = (value, digits = 1) => Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });

function colorRamp(value, cap, mode)
{
    if (!Number.isFinite(value))
    {
        return [60, 72, 84, 230];
    }

    const fraction = Math.max(0, Math.min(1, value / Math.max(cap, 0.001)));

    if (mode === "roughness")
    {
        return [Math.round(62 + 175 * fraction), Math.round(185 - 104 * fraction), Math.round(188 - 112 * fraction), 255];
    }

    return [Math.round(59 + 198 * fraction), Math.round(192 - 113 * fraction), Math.round(205 - 147 * fraction), 255];
}

function paintRaster(canvas, width, height, values, mode, cap)
{
    const context = canvas.getContext("2d");

    if (!context)
    {
        return false;
    }

    canvas.width = width;
    canvas.height = height;
    const pixels = context.createImageData(width, height);

    for (let i = 0; i < values.length; i++)
    {
        const rgba = mode === "reachability"
            ? [[28, 38, 52, 255], [87, 210, 198, 255], [130, 180, 232, 255], [220, 178, 107, 255], [234, 117, 100, 255]][values[i]]
            : colorRamp(values[i], cap, mode);
        pixels.data.set(rgba, i * 4);
    }

    context.putImageData(pixels, 0, 0);
    return true;
}

export function mountTerrainIntelligence({ panel, before, store, readDem, readContext })
{
    const section = document.createElement("section");
    section.className = "panel-section terrain-intelligence-section";
    section.setAttribute("aria-labelledby", "terrain-intel-heading");
    section.innerHTML = `
        <div class="panel-title-row"><h2 id="terrain-intel-heading" class="section-label">TERRAIN INTELLIGENCE</h2><span class="tiny-pill">SPATIAL TOOLS</span></div>
        <p class="section-help">Explore the same <strong>numeric DEM</strong> with a slope/roughness raster, a line-of-sight model and a time-limited reachability map. Inspired by NASA MMGIS and TIG; all calculations are independently implemented.</p>
        <div class="intel-stack">
            <div class="intel-tool"><h3>1 · Slope &amp; roughness</h3><p class="section-help">3 × 3 least-squares terrain plane; residual RMS indicates local height variation (not directly a rock or traction hazard).</p>
                <label class="science-label">Show surface <select id="intel-surface-mode" class="science-select"><option value="grade">Local gradient (%)</option><option value="roughness">Plane residual RMS (m)</option><option value="reachability">Modeled travel time bands</option></select></label>
                <button type="button" class="btn btn-outline wide" id="intel-run-surface">Analyze surface</button>
                <div id="intel-surface-result" role="status" class="intel-output">Load a numeric DEM in DEM Route Lab first.</div>
                <div class="intel-canvas-wrap"><canvas id="intel-raster" width="96" height="72" role="img" aria-label="Computed raster preview, north is up; darker cells indicate missing data or no modeled reachability"></canvas><div id="intel-raster-legend" class="intel-raster-legend">N ↑ · West ← → East · preview limited to imported DEM extent</div></div>
            </div>
            <div class="intel-tool"><h3>2 · Haar multi-scale terrain contrast</h3><p class="section-help">2 × 2 Haar decomposition of numeric elevations. Compare height differences across increasing spatial scales; this is not measured rock roughness or an obstacle map.</p>
                <button type="button" class="btn btn-outline wide" id="intel-run-haar">Analyze 5 scales</button>
                <div id="intel-haar-result" class="intel-output" role="status">Load a numeric DEM to inspect multi-scale height contrast.</div>
            </div>
            <div class="intel-tool"><h3>3 · Terrain line-of-sight</h3><p class="section-help">Sightline between the first and last waypoint. Does the modeled terrain rise above a straight ray? Includes approximate Mars curvature; does not predict radio link quality.</p>
                <div class="intel-input-row"><label>Observer above ground <small>m</small><input id="intel-observer" type="number" min="0" max="100" step="0.1" value="1.8"></label><label>Target above ground <small>m</small><input id="intel-target" type="number" min="0" max="100" step="0.1" value="1.8"></label></div>
                <button type="button" class="btn btn-outline wide" id="intel-run-los">Analyze line of sight</button>
                <div id="intel-los-result" class="intel-output" role="status">Add at least two waypoints within the DEM.</div>
            </div>
            <div class="intel-tool"><h3>4 · Time-reachability / isochrone</h3><p class="section-help">Dijkstra explores valid neighboring cells from your <strong>first waypoint</strong>, using your configured travel speed, slope penalty and hypothetical exclusion zone.</p>
                <label class="science-label">Maximum outward travel time <small>minutes</small><input id="intel-budget" type="number" min="1" max="480" step="1" value="15"></label>
                <button type="button" class="btn btn-accent wide" id="intel-run-reach">Compute reachable cells</button>
                <div id="intel-reach-result" class="intel-output" role="status">Run the time reachability model after loading DEM data.</div>
            </div>
        </div>
        <p class="science-footnote">No rock mapping, loose-soil measurements, DEM accuracy bounds, astronaut mobility certification or communications guarantee is inferred here. This terrain analysis does not establish route safety.</p>
    `;
    panel.insertBefore(section, before);
    const surfaceButton = section.querySelector("#intel-run-surface");
    const surfaceMode = section.querySelector("#intel-surface-mode");
    const rasterCanvas = section.querySelector("#intel-raster");
    const rasterLegend = section.querySelector("#intel-raster-legend");
    const surfaceResult = section.querySelector("#intel-surface-result");
    const haarButton = section.querySelector("#intel-run-haar");
    const haarResult = section.querySelector("#intel-haar-result");
    const losButton = section.querySelector("#intel-run-los");
    const losResult = section.querySelector("#intel-los-result");
    const reachButton = section.querySelector("#intel-run-reach");
    const reachResult = section.querySelector("#intel-reach-result");
    const observerInput = section.querySelector("#intel-observer");
    const targetInput = section.querySelector("#intel-target");
    const budgetInput = section.querySelector("#intel-budget");
    let surface = null;
    let haar = null;
    let lastDem = null;
    let reachability = null;
    let losResultData = null;
    let lastSignature = null;
    let lastReachBudget = null;
    let lastLosHeights = null;

    function signature()
    {
        const dem = readDem();
        const route = store.activeRoute;
        const context = readContext();
        return JSON.stringify({ dem: dem?.source, version: dem?.width, mission: store.current.id, route: route.id, points: route.points.map(item => [item.lat, item.lon]), zones: context.zones, maxSlope: context.maxSlopePercent, penalty: context.slopePenalty, speed: context.speedKmh });
    }

    function showCanvas(mode)
    {
        if (!surface || !lastDem)
        {
            return;
        }

        if (mode === "reachability")
        {
            if (!reachability)
            {
                rasterLegend.textContent = "Run Time Reachability first; gray means no modeled reachable cells.";
                return;
            }

            paintRaster(rasterCanvas, lastDem.width, lastDem.height, reachability.bands, mode);
            rasterLegend.textContent = "N ↑ · Teal 0–25% → blue 25–50% → amber 50–75% → coral 75–100% · dark = unavailable / unreachable";
            return;
        }

        const data = mode === "roughness" ? surface.roughness : surface.grade;
        const cap = mode === "roughness" ? Math.max(surface.maxRoughnessMeters, 0.01) : Math.max(surface.maxGradePercent, 0.01);
        paintRaster(rasterCanvas, lastDem.width, lastDem.height, data, mode, cap);
        rasterLegend.textContent = `N ↑ · Low = teal; high = coral; dark = NoData / edge. Scale 0–${number(cap, 2)} ${mode === "roughness" ? "m RMS" : "% local slope"}.`;
    }

    function refresh()
    {
        const dem = readDem();
        const current = signature();
        const route = store.activeRoute;
        const ready = Boolean(dem);
        surfaceButton.disabled = !ready;
        haarButton.disabled = !ready;
        losButton.disabled = !ready || route.points.length < 2;
        reachButton.disabled = !ready || route.points.length < 1;

        if (dem !== lastDem)
        {
            lastDem = dem;
            surface = null;
            haar = null;
            haarResult.textContent = ready ? "DEM loaded. Analyze five scales to see height contrast." : "Load a numeric DEM first.";
            reachability = null;
            losResultData = null;
            lastSignature = null;
            surfaceResult.textContent = ready ? "Numeric DEM ready. Analyze the 3 × 3 surface." : "Load a numeric DEM in DEM Route Lab first.";
            rasterLegend.textContent = "N ↑ · West ← → East · Raster from the selected DEM only";
            rasterCanvas.getContext("2d")?.clearRect(0, 0, rasterCanvas.width, rasterCanvas.height);
        }

        if (lastSignature && lastSignature !== current)
        {
            reachability = null;
            losResultData = null;
            haar = null;
            haarResult.textContent = "Mission context changed. Re-run multi-scale analysis if you need it in the Mission Brief.";
            lastSignature = null;
            reachResult.textContent = "Mission, route, exclusions or assumptions changed. Recompute reachability.";
            losResult.textContent = "Mission or route changed. Recompute line of sight.";

            if (surfaceMode.value === "reachability")
            {
                surfaceMode.value = "grade";
                showCanvas("grade");
            }
        }
    }

    surfaceButton.addEventListener("click", () =>
    {
        try
        {
            const dem = readDem();

            if (!dem)
            {
                return;
            }

            surface = analyzeTerrainSurface(dem);
            lastDem = dem;
            surfaceResult.innerHTML = `<strong>${number(surface.validCells, 0)} analyzed cells</strong><small>Maximum 3×3 modeled slope: ${number(surface.maxGradePercent, 2)}%; maximum residual roughness: ${number(surface.maxRoughnessMeters, 2)} m. Both depend on the DEM's effective spatial resolution.</small>`;
            showCanvas(surfaceMode.value);
        }
        catch (error)
        {
            surfaceResult.textContent = error.message;
        }
    });

    surfaceMode.addEventListener("change", () =>
    {
        if (surfaceMode.value !== "reachability" && !surface)
        {
            surfaceButton.click();
        }
        else
        {
            showCanvas(surfaceMode.value);
        }
    });

    haarButton.addEventListener("click", () =>
    {
        try
        {
            const dem = readDem();

            if (!dem)
            {
                return;
            }

            haar = analyzeHaarTerrain(dem, 5);
            lastSignature = signature();
            haarResult.replaceChildren();
            const table = document.createElement("div");
            table.className = "intel-haar-table";
            const heading = document.createElement("strong");
            heading.textContent = "Spatial footprint · RMS height contrast";
            table.appendChild(heading);

            for (const level of haar.levels)
            {
                const line = document.createElement("div");
                line.className = "intel-haar-row";
                const label = document.createElement("span");
                label.textContent = `≈ ${number(level.footprintMetersApprox, 0)} m`;
                const measurement = document.createElement("strong");
                measurement.textContent = level.rmsContrastMeters === null ? "NoData" : `${number(level.rmsContrastMeters, 2)} m`;
                line.append(label, measurement);
                table.appendChild(line);
            }

            const caveat = document.createElement("small");
            caveat.textContent = "Haar contrast also responds to ordinary slopes. No sub-pixel hazards or uncertainty margins are inferred.";
            haarResult.append(table, caveat);
        }
        catch (error)
        {
            haarResult.textContent = error.message;
        }
    });

    losButton.addEventListener("click", () =>
    {
        try
        {
            const points = store.activeRoute.points;
            const result = analyzeLineOfSight(readDem(), points[0], points.at(-1), { observerHeightMeters: Number(observerInput.value), targetHeightMeters: Number(targetInput.value) });
            losResultData = result;
            lastLosHeights = [Number(observerInput.value), Number(targetInput.value)];
            lastSignature = signature();
            const status = result.status === "unknown" ? "INSUFFICIENT DATA" : result.status === "blocked" ? "TERRAIN BLOCKS THE MODELED RAY" : "NO OBSTRUCTION AT THIS DEM RESOLUTION";
            const clearance = Number.isFinite(result.minimumClearanceMeters) ? ` · Minimum modeled clearance: ${number(result.minimumClearanceMeters, 2)} m` : "";
            const marginWarning = result.status === "visible" && result.minimumClearanceMeters < 2 ? " Low modeled clearance (<2 m): treat as inconclusive because no vertical uncertainty budget is available; 2 m is a conservative display flag, not a measured accuracy threshold." : "";
            losResult.innerHTML = `<strong>${status}</strong><small>${formatDistance(result.distanceMeters)} across ${result.sampleCount || "unknown"} interior height samples${clearance}. ${result.reason || "Only the numeric terrain ray is evaluated, not radio/Fresnel/atmospheric effects."}${marginWarning}</small>`;
        }
        catch (error)
        {
            losResult.textContent = error.message;
        }
    });

    reachButton.addEventListener("click", () =>
    {
        try
        {
            const points = store.activeRoute.points;
            const { zones, speedKmh, maxSlopePercent, slopePenalty } = readContext();
            const model = computeReachability(readDem(), points[0], { speedKmh, maxSlopePercent, slopePenalty, budgetMinutes: Number(budgetInput.value), exclusionZones: zones });

            if (!model.ok)
            {
                reachResult.textContent = model.reason;
                reachability = null;
                return;
            }

            reachability = model;
            lastReachBudget = Number(budgetInput.value);
            lastSignature = signature();
            reachResult.innerHTML = `<strong>${number(model.reachableCells, 0)} reachable cells · ${number(model.modeledAreaKm2, 2)} km² · ${number(model.reachableFractionOfValidTerrain * 100, 1)}% of valid DEM</strong><small>Farthest modeled straight-line range ${formatDistance(model.maxStraightLineRangeMeters)} in ${number(model.budgetMinutes, 0)} min maximum outward travel. ${model.areaMethod}. ${model.warning}</small>`;
            surfaceMode.value = "reachability";

            if (!surface)
            {
                surface = analyzeTerrainSurface(readDem());
            }

            showCanvas("reachability");
        }
        catch (error)
        {
            reachResult.textContent = error.message;
        }
    });

    for (const input of [observerInput, targetInput])
    {
        input.addEventListener("change", () =>
        {
            losResultData = null;
            losResult.textContent = "Endpoint heights changed. Run the visibility model again.";
        });
    }

    budgetInput.addEventListener("change", () =>
    {
        reachability = null;
        reachResult.textContent = "Time budget changed. Compute the isochrone again.";

        if (surfaceMode.value === "reachability")
        {
            surfaceMode.value = "grade";
            showCanvas("grade");
        }
    });

    return {
        refresh,
        brief()
        {
            if (!lastSignature || lastSignature !== signature())
            {
                return "";
            }

            const lines = ["", "## Additional DEM intelligence (scenario-only)"];

            if (haar)
            {
                const summary = haar.levels.filter(level => level.rmsContrastMeters !== null).map(level => `≈${level.footprintMetersApprox.toFixed(0)}m: ${level.rmsContrastMeters.toFixed(2)}m`).join("; ");
                lines.push(`Multi-scale Haar height contrast: ${summary}. Includes natural slopes; NOT a rock-hazard score.`);
            }

            if (losResultData && lastLosHeights?.[0] === Number(observerInput.value) && lastLosHeights?.[1] === Number(targetInput.value))
            {
                lines.push(`Line-of-sight: ${losResultData.status}; endpoint sensor heights ${lastLosHeights[0]} m / ${lastLosHeights[1]} m. Not a telecommunications prediction.`);
            }

            if (reachability && lastReachBudget === Number(budgetInput.value))
            {
                lines.push(`Time-reachability: ${reachability.reachableCells} reachable DEM cells, modeled ${reachability.modeledAreaKm2.toFixed(2)} km² within ${reachability.budgetMinutes} minutes.`);
            }

            lines.push("Calculations depend on user assumptions and finite DEM grid resolution, not certified traversability or EVA safety.");
            return lines.join("\n");
        }
    };
}
