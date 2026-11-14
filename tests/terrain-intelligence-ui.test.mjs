import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const science = readFileSync(new URL("../src/science-workbench.js", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/terrain-intelligence-ui.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/science.css", import.meta.url), "utf8");

test("spatial tools are integrated into the existing human-first science sidebar", () =>
{
    assert.match(science, /mountTerrainIntelligence/);
    assert.match(science, /intelligence\.refresh\(\)/);
    assert.match(science, /intelligence\.brief\(\)/);
    assert.match(panel, /3 × 3 least-squares terrain plane/);
    assert.match(panel, /id="intel-run-los"/);
    assert.match(panel, /id="intel-run-reach"/);
    assert.match(panel, /id="intel-run-surface"/);
    assert.match(styles, /terrain-intelligence-section/);
});

test("the spatial analysis UI discloses the scientific exclusions and exposes live results", () =>
{
    assert.match(panel, /role="status"/);
    assert.match(panel, /not a hazard map/);
    assert.match(panel, /No rock mapping/);
    assert.match(panel, /not predict radio link quality/);
    assert.match(panel, /Low modeled clearance/);
    assert.match(panel, /Budget changed|Time budget changed/);
});
