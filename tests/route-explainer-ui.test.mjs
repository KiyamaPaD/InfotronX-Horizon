import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { explainTerrainRouteChoice } from "../src/route-decision.js";
import { renderRouteDecision } from "../src/route-explainer-ui.js";

function fixtures()
{
    return [
        { id: "short", label: "Route <script>alert(1)</script>", ok: true, slopePenalty: 0,
            stats: { distanceMeters: 130, ascentMeters: 9, descentMeters: 10, maxGradePercent: 14, visited: 85, costMeters: 130 } },
        { id: "gentle", label: "Slope conscious", ok: true, slopePenalty: 24,
            stats: { distanceMeters: 150, ascentMeters: 2, descentMeters: 3, maxGradePercent: 6, visited: 112, costMeters: 270 } }
    ];
}

test("UI renders auditable cost breakdown and cross-preference comparative chart", () =>
{
    const target = { innerHTML: "" };
    renderRouteDecision(target, explainTerrainRouteChoice(fixtures(), "balanced"),
        { source: 'Dataset <img src=x onerror="alert(1)">', maxSlopePercent: 18, exclusionCount: 1 });

    assert.match(target.innerHTML, /C = D \+ λ × \(A \+ H\)/);
    assert.match(target.innerHTML, /why-data-table/);
    assert.match(target.innerHTML, /why-scatter/);
    assert.match(target.innerHTML, /why-bar-distance/);
    assert.match(target.innerHTML, /why-bar-height/);
    assert.match(target.innerHTML, /NON|MINIMUM MODELED COST|EQUIVALENT RESULTS|TIED BEST COST/i);
    assert.match(target.innerHTML, /maximum allowed adjacent-grid grade 18%/);
    assert.match(target.innerHTML, /NOT a NASA-certified safe route/);
    assert.match(target.innerHTML, /&lt;script&gt;/);
    assert.match(target.innerHTML, /&lt;img/);
    assert.doesNotMatch(target.innerHTML, /<script>|<img src=x/);
    assert.doesNotMatch(target.innerHTML, /NaN|Infinity/);
});

test("infeasible strategies never get a fabricated winner or score bar", () =>
{
    const target = { innerHTML: "" };
    const report = explainTerrainRouteChoice([{ id:"x", label:"X<script>", ok:false, reason:"NoData <cannot cross>" }]);
    renderRouteDecision(target, report);
    assert.match(target.innerHTML, /No valid modeled alternatives/);
    assert.match(target.innerHTML, /NoData &lt;cannot cross&gt;/);
    assert.match(target.innerHTML, /X&lt;script&gt;/);
    assert.doesNotMatch(target.innerHTML, /why-verdict|why-bar-row/);
});

test("the DEM route lab uses the explanation engine and resets stale model evidence", () =>
{
    const source = readFileSync(new URL("../src/science-workbench.js", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/science.css", import.meta.url), "utf8");
    assert.match(source, /id="terrain-why-preference"/);
    assert.match(source, /id="terrain-why-report"/);
    assert.match(source, /explainTerrainRouteChoice\(candidates, whyPreference\.value\)/);
    assert.match(source, /renderRouteDecision\(whyPanel, decision/);
    assert.match(source, /whyPreference\.addEventListener\("change"/);
    assert.match(source, /whyPreference\.disabled = true/);
    assert.match(source, /cost function|Cost definition: C = D/);
    assert.match(css, /\.why-bar-track/);
});
