import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const open = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("scientific tools explain when DEM, routes and waypoints are required", () =>
{
    const nav = open("../src/workspace-ux.js");
    const main = open("../src/main.js");
    const science = open("../src/science-workbench.js");
    const css = open("../src/workspace-polish.css");

    assert.match(nav, /analytics-readiness/);
    assert.match(nav, /data-ready-item="route"/);
    assert.match(nav, /data-ready-item="dem"/);
    assert.match(nav, /data-ready-item="alternative"/);
    assert.match(nav, /onLoadDem/);
    assert.match(main, /analyticsNavigation\.refresh\(\)/);
    assert.match(science, /get isDemReady\(\)/);
    assert.match(css, /\.analytics-ready-item/);
});

test("waypoint metadata and controls use independent rows and do not split title character by character", () =>
{
    const main = open("../src/main.js");
    const css = open("../src/workspace-polish.css");
    assert.match(main, /<div class="waypoint-main">/);
    assert.match(main, /<div class="waypoint-actions"/);
    assert.match(main, /class="waypoint-location"/);
    assert.match(css, /#waypoint-list \.waypoint-row/);
    assert.match(css, /#waypoint-list \.waypoint-coordinates strong[\s\S]*?white-space:nowrap/);
    assert.match(css, /#waypoint-list \.waypoint-actions[\s\S]*?grid-template-columns/);
});
