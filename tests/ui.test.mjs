import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/design.css", import.meta.url), "utf8");
const template = main.match(/app\.innerHTML = `([\s\S]*?)`;\s*\n\s*const get/)?.[1];

test("the mission interface defines its accessible regions only once", () =>
{
    assert.ok(template, "App template exists");
    const ids = [...template.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.match(template, /id="map-root" role="region" tabindex="-1"/);
    assert.match(template, /class="skip-link" href="#map-root"/);
});

test("the help guide and mobile navigation are accessible", () =>
{
    assert.match(template, /id="guide-modal" aria-labelledby="guide-title"/);
    assert.match(template, /class="mobile-dock" aria-label="Mobile workspace navigation"/);
    assert.match(main, /case "show-planner":/);
    assert.match(main, /case "show-analytics":/);
    assert.match(main, /function setMobilePanel\(panel\)/);
    assert.match(main, /button\.setAttribute\("aria-pressed", String\(active\)\)/);
});

test("route editing remains manual with full waypoint control", () =>
{
    assert.match(main, /case "add-coordinates":/);
    assert.match(main, /case "duplicate-route":/);
    assert.match(main, /case "save-checkpoint":/);
});

test("new design has responsive layout and respects reduced motion", () =>
{
    assert.match(html, /src\/design\.css/);
    assert.match(css, /@media\(max-width:1200px\)/);
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
    assert.match(css, /focus-visible/);
});
