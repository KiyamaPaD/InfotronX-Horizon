import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../src/", import.meta.url);
const host = readFileSync(new URL("science-workbench.js", root), "utf8");
const ui = readFileSync(new URL("advanced-math-ui.js", root), "utf8");
const css = readFileSync(new URL("science.css", root), "utf8");

test("math lab mounts in existing science sidebar and participates in Mission Brief", () =>
{
    assert.match(host, /mountAdvancedMathematics/);
    assert.match(host, /mathematics\.refresh\(\)/);
    assert.match(host, /mathematics\.brief\(\)/);
    assert.match(ui, /id="math-run-contours"/);
    assert.match(ui, /id="math-run-hypsometry"/);
    assert.match(ui, /id="math-run-risk"/);
    assert.match(css, /advanced-math-section/);
});

test("math lab explains model provenance and keeps human manual routes unmodified", () =>
{
    assert.match(ui, /not mission failure probabilities/);
    assert.match(ui, /source vertical datum/);
    assert.match(ui, /not calibrated operational risk/);
    assert.doesNotMatch(ui, /store\.save\(|store\.movePoint\(|store\.addRoute\(/);
});
