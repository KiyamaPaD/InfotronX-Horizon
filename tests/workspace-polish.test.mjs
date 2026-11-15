import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = load("../index.html");
const main = load("../src/main.js");
const analytics = load("../src/analytics.js");
const map = load("../src/map.js");
const css = load("../src/workspace-polish.css");
const navigation = load("../src/workspace-ux.js");

test("workspace polish stylesheet and quick access are connected", () =>
{
    assert.match(html, /workspace-polish\.css/);
    assert.match(main, /setupAnalyticsNavigation\(get\("#analytics-panel"\),/);
    assert.match(navigation, /analytics-section-select/);
    assert.match(navigation, /scrollIntoView/);
    assert.match(navigation, /analytics-collapsed/);
    assert.match(css, /\.analytics-quickbar/);
});

test("the comparison handles numerous detours without filling the map viewport", () =>
{
    assert.match(analytics, /rows\.length > 4/);
    assert.match(analytics, /comparison-toggle/);
    assert.match(analytics, /container\.dataset\.expanded/);
    assert.match(css, /\.compare-label/);
    assert.match(css, /max-height:182px/);
});

test("map tiles survive short pans and metadata does not reload loaded images", () =>
{
    assert.match(map, /tileCacheLimit = 72/);
    assert.match(map, /tile\.style\.display = "none"/);
    assert.match(map, /previousZoom/);
    assert.match(map, /this\.capabilitiesReady = verifiedLayer \|\| this\.tileTemplates\.has\(this\.layer\.id\)/);
    assert.match(map, /this\.scheduleCapabilities\(\)/);
});
