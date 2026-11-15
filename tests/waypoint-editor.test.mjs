import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MissionStore, createMission, validateMission } from "../src/store.js";
import { toGeoJson } from "../src/share.js";
import { cleanWaypointMetadata, normalizeColor, WAYPOINT_CATEGORIES } from "../src/waypoint-editor.js";

function memoryStorage()
{
    const values = new Map();

    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value)
    };
}

test("marker metadata is sanitized and legacy coordinates remain valid", () =>
{
    const clean = cleanWaypointMetadata({
        name: "A".repeat(100), category: "unknown", description: "D".repeat(650),
        icon: "<svg>", color: "red; background:url(unsafe)"
    });

    assert.equal(clean.name.length, 80);
    assert.equal(clean.description.length, 500);
    assert.equal(clean.category, "navigation");
    assert.equal(clean.icon, "circle");
    assert.equal(clean.color, undefined);
    assert.equal(normalizeColor("#ABCDEF"), "#abcdef");
    assert.equal(normalizeColor("var(--accent)"), null);
    assert.ok(WAYPOINT_CATEGORIES.some(item => item.id === "hazard"));
    const legacy = validateMission({ title: "Legacy", routes: [{ points: [{ lat: 18.44, lon: 77.45 }] }] });
    assert.equal(legacy.routes[0].points.length, 1);
    assert.equal(legacy.routes[0].points[0].name, undefined);
});

test("waypoint editor preserves user fields across save, reload, checkpoint and export", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });

    store.addPoint({ lat: 18.44, lon: 77.45 });
    const id = store.activeRoute.points[0].id;
    assert.equal(store.setRouteColor("#123ABC"), true);
    assert.equal(store.updateWaypoint(id, {
        lat: 18.441, lon: 77.451, name: "Science station", category: "science",
        description: "Hypothesis awaiting verification.", icon: "star", color: "#22ccaa"
    }), true);

    store.saveCheckpoint("Before sample");
    const reloaded = new MissionStore({ userId: "test-user" });
    const point = reloaded.activeRoute.points[0];
    assert.equal(reloaded.activeRoute.color, "#123abc");
    assert.equal(point.name, "Science station");
    assert.equal(point.category, "science");
    assert.equal(point.description, "Hypothesis awaiting verification.");
    assert.equal(point.color, "#22ccaa");
    assert.equal(point.icon, "star");

    const validated = validateMission(JSON.parse(JSON.stringify(reloaded.current)));
    assert.equal(validated.checkpoints[0].routes[0].points[0].name, "Science station");
    assert.equal(validated.routes[0].color, "#123abc");

    const geojson = toGeoJson(reloaded.current);
    assert.deepEqual(geojson.features[0].geometry.coordinates, [77.451, 18.441]);
    assert.equal(geojson.features[0].properties.waypoints[0].name, "Science station");
    assert.equal(geojson.features[0].properties.waypoints[0].color, "#22ccaa");
});

test("changing metadata does not invalidate DEM, but moving coordinates does", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    store.addPoint({ lat: 18.44, lon: 77.45 });
    const point = store.activeRoute.points[0];
    store.activeRoute.terrainModel = { source: "test", stats: { distanceMeters: 0, ascentMeters: 0, descentMeters: 0, maxGradePercent: 0 } };
    store.save();
    const model = store.activeRoute.terrainModel;
    assert.equal(store.updateWaypoint(point.id, {
        lat: point.lat, lon: point.lon, name: "Renamed", description: "Manual",
        category: "navigation", icon: "diamond", color: null
    }), true);
    assert.deepEqual(store.activeRoute.terrainModel, model);
    assert.equal(store.updateWaypoint(point.id, { lat: 18.45, lon: 77.45 }), true);
    assert.equal(store.activeRoute.terrainModel, null);
    assert.equal(store.updateWaypoint(point.id, { lat: 180, lon: 77.45 }), false);
    assert.equal(store.activeRoute.points[0].lat, 18.45);
});

test("undo and redo cover edits, deletions, dragging and branch-off edits", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.canUndo, false);
    assert.equal(store.undo(), false);
    store.addPoint({ lat: 18.44, lon: 77.45 });
    const id = store.activeRoute.points[0].id;
    store.updateWaypoint(id, { lat: 18.44, lon: 77.45, name: "First", category: "sample", icon: "square" });
    assert.equal(store.canUndo, true);
    assert.equal(store.undo(), true);
    assert.equal(store.activeRoute.points[0].name, undefined);
    assert.equal(store.redo(), true);
    assert.equal(store.activeRoute.points[0].name, "First");

    store.movePoint(id, { lat: 18.46, lon: 77.49 }, false);
    store.save();
    assert.equal(store.undo(), true);
    assert.equal(store.activeRoute.points[0].lat, 18.44);
    assert.equal(store.redo(), true);
    assert.equal(store.activeRoute.points[0].lat, 18.46);

    store.removePoint(id);
    assert.equal(store.activeRoute.points.length, 0);
    assert.equal(store.undo(), true);
    assert.equal(store.activeRoute.points.length, 1);
    store.updateWaypoint(id, { lat: 18.46, lon: 77.49, name: "New direction" });
    assert.equal(store.canRedo, false);
});

test("switching missions clears edit history and cannot undo another mission", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    store.addPoint({ lat: 18.44, lon: 77.45 });
    const initialId = store.current.id;
    assert.equal(store.canUndo, true);
    store.addMission("Independent mission");
    assert.equal(store.canUndo, false);
    store.addPoint({ lat: 18.45, lon: 77.46 });
    assert.equal(store.canUndo, true);
    store.selectMission(initialId);
    assert.equal(store.canUndo, false);
    assert.equal(store.undo(), false);
    assert.equal(store.activeRoute.points.length, 1);
});

test("mission metadata and route colors reject unsafe values", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore({ userId: "test-user" });
    assert.equal(store.updateMissionDetails("  Lab A  ", "Field study"), true);
    assert.equal(store.current.title, "Lab A");
    assert.equal(store.current.description, "Field study");
    assert.equal(store.updateMissionDetails(" ", "Ignored"), false);
    assert.equal(store.setRouteColor("expression(alert(1))"), false);
    assert.equal(store.setRouteColor("#abcdef"), true);
    assert.equal(new MissionStore({ userId: "test-user" }).activeRoute.color, "#abcdef");
});

test("UI provides a manual waypoint editor, context actions, and history controls", () =>
{
    const ui = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    const map = readFileSync(new URL("../src/map.js", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../src/workspace-polish.css", import.meta.url), "utf8");

    assert.match(ui, /id="waypoint-editor-modal"/);
    assert.match(ui, /data-action="undo-edit"/);
    assert.match(ui, /data-action="redo-edit"/);
    assert.match(ui, /data-context-action="edit-waypoint"/);
    assert.match(ui, /store\.updateWaypoint\(editingWaypointId/);
    assert.match(map, /onContextMenu\(event\)/);
    assert.match(map, /point\.color \|\| route\.color/);
    assert.match(styles, /\.map-context-menu/);
});
