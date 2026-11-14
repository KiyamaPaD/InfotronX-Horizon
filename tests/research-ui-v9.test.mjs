import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMission } from "../src/store.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const panel = read("../src/mission-research-ui.js");
const workbench = read("../src/science-workbench.js");
const css = read("../src/science.css");

test("V9 mounts four independent advanced research tools into the Science sidebar", () =>
{
    assert.match(workbench, /mountMissionResearch/);
    assert.match(workbench, /advancedResearch\.refresh\(\)/);
    assert.match(workbench, /advancedResearch\.brief\(\)/);

    for (const id of ["v9-init-dstar", "v9-replan-dstar", "v9-run-pareto", "v9-run-topology", "v9-run-audit", "v9-reference-file", "v9-run-posterior"])
    {
        assert.match(panel, new RegExp(`id="${id}"`));
    }

    assert.match(panel, /role="status"/);
    assert.match(panel, /Intermediate manual science anchors are never omitted/);
    assert.match(css, /\.math-research-v9/);
    assert.match(css, /min-height:44px/);
});

test("V9 never silently invents Bayesian inputs and blocks stale DEM comparison", () =>
{
    assert.match(panel, /complete every/i);
    assert.match(panel, /comparedDemKey !== comparisonKey/);
    assert.match(panel, /data-pareto-index/);
    assert.match(panel, /maxLabelsPerCell: 12/);
    assert.match(panel, /A\* cost disagreement/);
    assert.match(panel, /Math\.abs\(result\.costMeters - check\.costMeters\) < 1e-4/);
});

test("Pareto method metadata survives mission validation but remains unverified", () =>
{
    const mission = {
        title: "Test",
        activeRouteId: "a",
        routes: [{ id: "a", name: "Pareto", points: [{ lat: 18.44, lon: 77.45 }, { lat: 18.45, lon: 77.46 }], terrainModel: { source: "Synthetic DEM", stats: { distanceMeters: 100, ascentMeters: 3, descentMeters: 2, maxGradePercent: 6 }, scenario: { model: "Two-objective Pareto on sampled DEM", maxSlopePercent: 20, slopePenalty: 3, verified: true } } }],
        observations: []
    };
    const valid = validateMission(mission);
    assert.equal(valid.routes[0].terrainModel.scenario.model, "Two-objective Pareto on sampled DEM");
    assert.equal(valid.routes[0].terrainModel.scenario.verified, false);
    assert.equal(valid.routes[0].terrainModel.unverified, true);
});
