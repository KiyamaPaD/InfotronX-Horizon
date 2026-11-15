import test from "node:test";
import assert from "node:assert/strict";
import { MARS_SITES, SITE_TYPES, WAYPOINT_PRESETS, siteById } from "../src/mars-sites.js";
import { WAYPOINT_CATEGORIES } from "../src/waypoint-editor.js";
import { MARKER_ICONS } from "../src/marker-icons.js";

test("every built-in place is complete and inside the globe", () =>
{
    const ids = new Set();

    for (const site of MARS_SITES)
    {
        assert.ok(site.id && !ids.has(site.id), "unique id " + site.id);
        ids.add(site.id);
        assert.ok(site.name.length > 3);
        assert.ok(site.lat >= -90 && site.lat <= 90, site.id + " latitude");
        assert.ok(site.lon >= -180 && site.lon <= 180, site.id + " longitude");
        assert.ok(SITE_TYPES[site.type], site.id + " type");
        assert.ok(site.query.length > 5);
        assert.ok(site.summary.length > 30 && site.summary.length < 260, site.id + " summary length");
        assert.ok(site.facts.length >= 3, site.id + " facts");
    }

    assert.ok(MARS_SITES.length >= 15);
    assert.equal(siteById("jezero").name, "Jezero Crater");
});

test("the landing sites sit where the missions are known to have landed", () =>
{
    const near = (id, lat, lon) =>
    {
        const site = siteById(id);
        assert.ok(Math.abs(site.lat - lat) < 1 && Math.abs(site.lon - lon) < 1, id);
    };

    near("jezero", 18.4, 77.5);
    near("gale", -5.4, 137.8);
    near("olympus", 18.65, -133.8);
    near("opportunity", -1.95, -5.5);
    near("spirit", -14.6, 175.5);
});

test("waypoint presets use categories and symbols the app understands", () =>
{
    const categories = new Set(WAYPOINT_CATEGORIES.map(item => item.id));
    const icons = new Set(MARKER_ICONS.map(item => item.id));

    for (const preset of WAYPOINT_PRESETS)
    {
        assert.ok(categories.has(preset.category), preset.id + " category");
        assert.ok(icons.has(preset.icon), preset.id + " icon");
        assert.match(preset.color, /^#[0-9a-f]{6}$/i);
        assert.ok(preset.todo.length > 20);
    }

    const hazard = WAYPOINT_PRESETS.find(preset => preset.category === "hazard");
    assert.match(hazard.todo, /hypothetical/i);
});
