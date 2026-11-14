import { analyzeRoute } from "./geo.js";
import { DEFAULT_EVA_ASSUMPTIONS } from "./resources.js";
import { analyzeHypsometry, marchingSquares, compareResourceDistributions } from "./advanced-math.js";

const number = (value, digits = 2) => Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });

function drawContourMap(canvas, dem, elevationMeters, contour)
{
    canvas.width = dem.width * 3;
    canvas.height = dem.height * 3;
    const context = canvas.getContext("2d");

    if (!context)
    {
        return;
    }

    const pixels = context.createImageData(dem.width, dem.height);
    const valid = dem.elevations.filter(Number.isFinite);
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const span = Math.max(max - min, 0.001);

    for (let i = 0; i < dem.elevations.length; i++)
    {
        const z = dem.elevations[i];
        const t = Number.isFinite(z) ? (z - min) / span : null;
        pixels.data.set(t === null ? [35, 48, 62, 255] : [Math.round(35 + 116 * t), Math.round(83 + 82 * t), Math.round(105 + 47 * t), 255], i * 4);
    }

    const temporary = document.createElement("canvas");
    temporary.width = dem.width;
    temporary.height = dem.height;
    temporary.getContext("2d").putImageData(pixels, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(temporary, 0, 0, canvas.width, canvas.height);
    context.lineWidth = 1.8;
    context.strokeStyle = "#ffe2ac";
    context.lineCap = "round";
    context.beginPath();

    for (const segment of contour.segments)
    {
        context.moveTo(segment.a.column * 3 + 1.5, segment.a.row * 3 + 1.5);
        context.lineTo(segment.b.column * 3 + 1.5, segment.b.row * 3 + 1.5);
    }

    context.stroke();
    canvas.setAttribute("aria-label", `Jezero numeric elevation preview with ${number(contour.segments.length, 0)} model contour segments at ${number(elevationMeters)} meters. North is up. Unknown DEM cells are dark. Not a hazard map.`);
}

export function mountAdvancedMathematics({ panel, before, store, readDem })
{
    const section = document.createElement("section");
    section.className = "panel-section advanced-math-section";
    section.setAttribute("aria-labelledby", "advanced-math-heading");
    section.innerHTML = `
        <div class="panel-title-row"><h2 id="advanced-math-heading" class="section-label">ADVANCED MATHEMATICS LAB</h2><span class="tiny-pill">MATHEMATICS</span></div>
        <p class="section-help">Numerical geomorphometry and decision analysis: <strong>elevation measures, contour geometry, CVaR and optimal transport</strong>. All manual routes remain editable.</p>
        <div class="intel-stack">
            <div class="intel-tool">
                <h3>1 · Elevation distribution</h3>
                <p class="section-help">Hypsometric distribution weighted by the Mars spherical-area measure. Each bar reports sampled area in an elevation interval.</p>
                <button id="math-run-hypsometry" class="btn btn-outline wide" type="button">Analyze elevation bands</button>
                <div id="math-hypsometry" class="intel-output" role="status">Load the numeric Jezero DEM first.</div>
            </div>
            <div class="intel-tool">
                <h3>2 · Marching Squares contours</h3>
                <p class="section-help">Linearly interpolate equal-elevation segments. Saddle cells use an explicit center-value tie rule; NoData cells are excluded.</p>
                <label class="science-label">Contour elevation <small>m, source vertical datum</small><input id="math-contour-level" type="number" step="1" value="-2570" /></label>
                <button id="math-run-contours" class="btn btn-outline wide" type="button">Trace contour and measure length</button>
                <div id="math-contour-result" class="intel-output" role="status">Choose an elevation after loading the DEM.</div>
                <div class="math-map-wrap"><canvas id="math-contour-map" width="312" height="288" role="img" aria-label="No DEM contour has been computed"></canvas><small>North ↑ · Gold: interpolated elevation contour · Blue/teal: DEM elevations · Dark: NoData</small></div>
            </div>
            <div class="intel-tool">
                <h3>3 · CVaR &amp; Wasserstein route comparison</h3>
                <p class="section-help">Compare your active route with another manually created route. The same seeded artificial speed, O₂ and power perturbations are applied to both. Results are <strong>not mission failure probabilities</strong>.</p>
                <label class="science-label">Alternative route <select id="math-route-choice" class="science-select"><option value="">Draw a second route first</option></select></label>
                <label class="science-label">Independent input variation <select id="math-variation" class="science-select"><option value="10">±10%</option><option value="20" selected>±20%</option><option value="35">±35%</option><option value="50">±50%</option></select></label>
                <button id="math-run-risk" class="btn btn-accent wide" type="button">Compare 500 paired scenarios</button>
                <div id="math-risk-result" class="intel-output" role="status">Create another route with at least two points to compare distributions.</div>
            </div>
        </div>
        <p class="science-footnote">Contours and hypsometry use sampled USGS/NASA elevation data; continuous geology and elevation uncertainty are not certified. CVaR/Wasserstein inputs are illustrative, user-defined resource assumptions.</p>
    `;
    panel.insertBefore(section, before);

    const histogramButton = section.querySelector("#math-run-hypsometry");
    const histogramOutput = section.querySelector("#math-hypsometry");
    const contourButton = section.querySelector("#math-run-contours");
    const contourInput = section.querySelector("#math-contour-level");
    const contourOutput = section.querySelector("#math-contour-result");
    const canvas = section.querySelector("#math-contour-map");
    const riskButton = section.querySelector("#math-run-risk");
    const riskOutput = section.querySelector("#math-risk-result");
    const choice = section.querySelector("#math-route-choice");
    const variation = section.querySelector("#math-variation");
    let previousDem = null;
    let previousSignature = null;
    let recorded = [];

    function signature()
    {
        return JSON.stringify({ mission: store.current.id, activeRoute: store.activeRoute.id, routes: store.current.routes.map(route => [route.id, route.points.map(point => [point.lat, point.lon])]), assumptions: store.current.evaScenario, dem: readDem()?.source, grid: readDem()?.width, contourLevel: contourInput.value, variation: variation.value, comparisonRoute: choice.value });
    }

    function refresh()
    {
        const dem = readDem();
        const sig = signature();
        histogramButton.disabled = !dem;
        contourButton.disabled = !dem;
        const alternatives = store.current.routes.filter(route => route.id !== store.activeRoute.id && route.points.length > 1);
        const previous = choice.value;
        const entries = alternatives.map(route => [route.id, route.name]);
        const existing = Array.from(choice.options).map(option => [option.value, option.textContent]);

        if (JSON.stringify(entries) !== JSON.stringify(existing))
        {
            choice.replaceChildren();

            if (!alternatives.length)
            {
                choice.appendChild(new Option("Draw a second complete route first", ""));
            }
            else
            {
                for (const route of alternatives)
                {
                    choice.appendChild(new Option(route.name, route.id));
                }
            }

            choice.value = alternatives.some(route => route.id === previous) ? previous : alternatives[0]?.id || "";
        }

        riskButton.disabled = store.activeRoute.points.length < 2 || !alternatives.length;

        if (previousDem !== dem)
        {
            previousDem = dem;
            canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            histogramOutput.textContent = dem ? "DEM ready. Analyze elevation bands." : "Load the numeric Jezero DEM first.";
            contourOutput.textContent = dem ? "Select a level inside the DEM elevation range." : "Load numeric elevations first.";
            contourInput.value = dem ? String(Math.round((Math.min(...dem.elevations.filter(Number.isFinite)) + Math.max(...dem.elevations.filter(Number.isFinite))) / 2)) : "-2570";
        }

        if (previousSignature !== null && previousSignature !== sig)
        {
            recorded = [];
            riskOutput.textContent = "Mission, route or assumptions changed. Re-run the comparison.";
        }

        previousSignature = sig;
    }

    histogramButton.addEventListener("click", () =>
    {
        try
        {
            const summary = analyzeHypsometry(readDem(), 10);
            histogramOutput.replaceChildren();
            const lead = document.createElement("strong");
            lead.textContent = `${number(summary.totalAreaSqKm, 3)} km² valid spherical-area samples · ${number(summary.validCells, 0)} cells`;
            const sub = document.createElement("small");
            sub.textContent = `Mean ${number(summary.areaWeightedMeanMeters, 2)} m · median ${number(summary.areaWeightedMedianMeters, 2)} m · range ${number(summary.minElevationMeters, 2)} to ${number(summary.maxElevationMeters, 2)} m`;
            histogramOutput.append(lead, sub);

            for (const bin of summary.bins)
            {
                const row = document.createElement("div");
                row.className = "math-band";
                const label = document.createElement("span");
                label.textContent = `${number(bin.lower, 0)} to ${number(bin.upper, 0)} m`;
                const track = document.createElement("div");
                track.className = "math-track";
                const fill = document.createElement("span");
                fill.style.width = `${bin.areaFraction * 100}%`;
                track.appendChild(fill);
                const amount = document.createElement("strong");
                amount.textContent = `${number(bin.areaFraction * 100, 1)}%`;
                row.append(label, track, amount);
                histogramOutput.appendChild(row);
            }

            recorded = recorded.filter(value => !value.startsWith("Hypsometry:"));
            recorded.push(`Hypsometry: ${summary.totalAreaSqKm.toFixed(3)} km² reference sphere sampled area, weighted mean ${summary.areaWeightedMeanMeters.toFixed(2)} m, median ${summary.areaWeightedMedianMeters.toFixed(2)} m.`);
            previousSignature = signature();
        }
        catch (error)
        {
            histogramOutput.textContent = error.message;
        }
    });

    contourButton.addEventListener("click", () =>
    {
        try
        {
            const dem = readDem();
            const elevation = Number(contourInput.value);
            const result = marchingSquares(dem, elevation);
            drawContourMap(canvas, dem, elevation, result);
            contourOutput.textContent = `${number(result.segments.length, 0)} interpolated segments · ${number(result.totalLengthMeters / 1000, 3)} km total segment length · ${number(result.ambiguousCells, 0)} saddle cells · ${result.skippedNoDataCells} skipped NoData cells${result.truncated ? " · truncated" : ""}. Contours at the clip boundary are open.`;
            recorded = recorded.filter(value => !value.startsWith("Contours:"));
            recorded.push(`Contours: ${result.segments.length} Marching Squares segments at ${elevation.toFixed(2)} m; total modeled length ${(result.totalLengthMeters / 1000).toFixed(3)} km; ${result.ambiguousCells} saddle cells, NoData excluded.`);
            previousSignature = signature();
        }
        catch (error)
        {
            contourOutput.textContent = error.message;
        }
    });

    riskButton.addEventListener("click", () =>
    {
        try
        {
            const alternative = store.current.routes.find(route => route.id === choice.value);

            if (!alternative || alternative.points.length < 2)
            {
                throw new Error("Choose another route with at least two waypoints.");
            }

            const a = analyzeRoute(store.activeRoute.points).totalDistance;
            const b = analyzeRoute(alternative.points).totalDistance;
            const summary = compareResourceDistributions(a, b, store.current.evaScenario || DEFAULT_EVA_ASSUMPTIONS, { variationPercent: Number(variation.value) });
            riskOutput.replaceChildren();
            const lead = document.createElement("strong");
            lead.textContent = `Active ${number(a / 1000, 2)} km vs alternative ${number(b / 1000, 2)} km`;
            riskOutput.appendChild(lead);
            const units = { durationHours: "h", oxygenKg: "kg", batteryWh: "Wh" };
            const labels = { durationHours: "Duration", oxygenKg: "O₂", batteryWh: "Energy" };
            const results = [];

            for (const [metric, value] of Object.entries(summary.metrics))
            {
                const line = document.createElement("div");
                line.className = "math-risk-row";
                const title = document.createElement("strong");
                title.textContent = labels[metric];
                const comparison = document.createElement("small");
                comparison.textContent = `CVaR90 active ${number(value.reference.cvar, 3)} ${units[metric]} · alternative ${number(value.alternative.cvar, 3)} ${units[metric]} · W₁ ${number(value.wasserstein1, 3)} ${units[metric]}`;
                line.append(title, comparison);
                riskOutput.appendChild(line);
                results.push(`${labels[metric]}: CVaR90 active ${value.reference.cvar.toFixed(3)} / alternate ${value.alternative.cvar.toFixed(3)} ${units[metric]}, W1 ${value.wasserstein1.toFixed(3)} ${units[metric]}`);
            }

            const warning = document.createElement("small");
            warning.textContent = `500 paired, seeded ±${summary.variationPercent}% uniform synthetic scenarios; zero NASA-calibrated reliability claims. W₁ compares whole outcome distributions, CVaR averages the worst 10% of modeled costs.`;
            riskOutput.appendChild(warning);
            recorded = recorded.filter(value => !value.startsWith("Synthetic risk comparison:"));
            recorded.push(`Synthetic risk comparison: ${alternative.name.replace(/[\r\n]+/g, " ").slice(0, 70)}; ${results.join("; ")}. 500 seeded paired uniform trials, illustrative only.`);
            previousSignature = signature();
        }
        catch (error)
        {
            riskOutput.textContent = error.message;
        }
    });

    return {
        refresh,
        brief()
        {
            return previousSignature === signature() && recorded.length ? `\n## Advanced mathematics (scenario and DEM analysis)\n${recorded.join("\n")}\nContour and hypsometry results use the selected numeric DEM. Empirical CVaR/Wasserstein here use hypothetical uniform input variations, not calibrated operational risk.` : "";
        }
    };
}
