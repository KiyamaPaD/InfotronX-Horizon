import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScientificComparisonReport } from "../src/scientific-export.js";
import { createJezeroReviewMission } from "../src/review-demo.js";
import { decodeBundledDem } from "../src/bundled-dem.js";
import { compareTerrainStrategies } from "../src/mission-scenarios.js";

const raw = JSON.parse(readFileSync(new URL("../assets/jezero_ctx_trn_dem_20m_clip.json", import.meta.url), "utf8"));
const dem = decodeBundledDem(raw);
const mission = createJezeroReviewMission();
const route = mission.routes[0];

function makeReport(overrides = {})
{
    const candidates = compareTerrainStrategies(dem, route.points, { maxSlopePercent: 18 });
    return createScientificComparisonReport({
        mission, route, dem, candidates, maxSlopePercent: 18,
        exclusionZones: [], preference: "balanced", ...overrides
    });
}

test("scientific export is grounded in the actual bundled numeric Jezero clip", () =>
{
    const result = makeReport();
    assert.match(result, /Scientific route comparison/);
    assert.match(result, /CTX/);
    assert.match(result, /18\.445° N, 77\.451° E/);
    assert.match(result, /18\.451° N, 77\.460° E/);
    assert.match(result, /3,396,190 m/);
    assert.match(result, /λ = 6/);
    assert.match(result, /Shortest modeled/);
    assert.match(result, /Balanced/);
    assert.match(result, /Slope-conscious/);
    assert.match(result, /Cost identity verified/);
    assert.match(result, /Generated from the current on-screen comparison/);
    assert.match(result, /NOT NASA telemetry/);
    assert.doesNotMatch(result, /NaN|Infinity|undefined|Secret|sb_publishable_/);
});

test("the scientific report is deterministic for unchanged data and assumptions", () =>
{
    assert.equal(makeReport(), makeReport());
    assert.match(makeReport({ preference: "gentle" }), /Preference used for the ranking: gentle \(λ = 24\)/);
});

test("invalid report requests fail, rather than inventing a science result", () =>
{
    assert.throws(() => makeReport({ candidates: [] }), /loaded numeric DEM/);
    assert.throws(() => makeReport({ dem: null }), /loaded numeric DEM/);
    assert.throws(() => makeReport({ maxSlopePercent: 0 }), /loaded numeric DEM/);
});

test("hypothetical observations are explicitly labeled, with exact values", () =>
{
    const zone = { lat: 18.44745, lon: 77.45585, radiusMeters: 80,
        title: 'Survey | hypothesis <not NASA>' };
    const result = makeReport({ exclusionZones: [zone] });
    assert.match(result, /radius 80\.000 m/);
    assert.match(result, /Survey   hypothesis  not NASA/);
    assert.match(result, /not a verified NASA hazard/);
});

test("science UI export action exists and invalidates when route changes", () =>
{
    const code = readFileSync(new URL("../src/science-workbench.js", import.meta.url), "utf8");
    assert.match(code, /id="terrain-evidence-export"/);
    assert.match(code, /evidenceButton\.disabled = true/);
    assert.match(code, /comparisonSource\.signature === JSON\.stringify\(route\.points\)/);
    assert.match(code, /createScientificComparisonReport/);
    assert.match(code, /downloadFile\("mars-atlas-scientific-comparison\.md"/);
});
