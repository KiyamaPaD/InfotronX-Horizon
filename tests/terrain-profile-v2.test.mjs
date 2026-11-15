import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gridCoordinate, profileRouteOnDem, validateDem } from "../src/terrain.js";
import { nearestSampleIndex, profileSvgPaths, summarizeTerrainProfile } from "../src/terrain-profile-v2.js";
import { MarsMap } from "../src/map.js";
import { MissionStore } from "../src/store.js";

function fixture(elevations)
{
    return validateDem({
        width: 5, height: 3, north: 18.46, west: 77.43,
        latStep: 0.0005, lonStep: 0.0005, elevations,
        source: "SYNTHETIC TEST NUMERIC DEM · Not NASA data"
    });
}

function memoryStorage()
{
    const cache = new Map();
    return { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) };
}

test("interactive DEM samples retain their exact geographic location", () =>
{
    const dem = fixture([0, 2, 4, 6, 8, ...Array(10).fill(0)]);
    const points = [gridCoordinate(dem, 0, 0), gridCoordinate(dem, 0, 4)];
    const profile = profileRouteOnDem(dem, points);
    assert.ok(profile.samples.length >= 4);
    assert.deepEqual([profile.samples[0].lat, profile.samples[0].lon], [points[0].lat, points[0].lon]);
    assert.deepEqual([profile.samples.at(-1).lat, profile.samples.at(-1).lon], [points[1].lat, points[1].lon]);
    assert.ok(profile.samples.every(sample => Number.isFinite(sample.lat) && Number.isFinite(sample.lon)));
    assert.ok(profile.samples.every((sample, index) =>
        index === 0 || sample.distanceMeters >= profile.samples[index - 1].distanceMeters));

    const summary = summarizeTerrainProfile(dem, points, profile);
    assert.equal(summary.knownCount, profile.samples.length);
    assert.equal(summary.complete, true);
    assert.equal(summary.waypoints.length, 2);
    assert.equal(summary.waypoints[1].changeMeters, 8);
    assert.ok(summary.waypoints[1].meanGradePercent > 0);
    assert.ok(summary.ascentMeters > 0);
    assert.equal(summary.descentMeters, 0);
});

test("descending DEM sections report negative mean grades and downhill travel", () =>
{
    const dem = fixture([20, 16, 12, 8, 4, ...Array(10).fill(0)]);
    const a = gridCoordinate(dem, 0, 0);
    const b = gridCoordinate(dem, 0, 4);
    const result = summarizeTerrainProfile(dem, [a, b], profileRouteOnDem(dem, [a, b]));

    assert.equal(result.waypoints[1].changeMeters, -16);
    assert.ok(result.waypoints[1].meanGradePercent < 0);
    assert.equal(result.ascentMeters, 0);
    assert.ok(result.descentMeters > 0);
    assert.ok(result.maxAbsoluteGradePercent > 0);
});

test("NoData breaks the path and does not invent endpoint or intermediate elevations", () =>
{
    const dem = fixture([0, 2, null, 6, 8, ...Array(10).fill(0)]);
    const a = gridCoordinate(dem, 0, 0);
    const b = gridCoordinate(dem, 0, 4);
    const p = profileRouteOnDem(dem, [a, b]);
    const report = summarizeTerrainProfile(dem, [a, b], p);

    assert.equal(report.complete, false);
    assert.ok(report.knownCount < report.sampleCount);
    assert.ok(report.coverageFraction < 1);
    assert.ok(report.observedDistanceMeters < report.totalDistanceMeters);
    assert.ok(profileSvgPaths(p.samples).length >= 2, "Unknown cells must break the plotted line");

    const outside = { lat: 25, lon: 77.43 };
    const missing = summarizeTerrainProfile(dem, [outside, outside], profileRouteOnDem(dem, [outside, outside]));
    assert.equal(missing.knownCount, 0);
    assert.equal(missing.minimumElevationMeters, null);
    assert.equal(missing.ascentMeters, null);
    assert.equal(missing.waypoints[0].elevationMeters, null);
    assert.equal(missing.waypoints[1].meanGradePercent, null);
});

test("selection binary search finds closest endpoints and samples", () =>
{
    const samples = [
        { distanceMeters: 0 }, { distanceMeters: 15 },
        { distanceMeters: 30 }, { distanceMeters: 55 }
    ];
    assert.equal(nearestSampleIndex([], 10), -1);
    assert.equal(nearestSampleIndex(samples, Number.NaN), -1);
    assert.equal(nearestSampleIndex(samples, -10), 0);
    assert.equal(nearestSampleIndex(samples, 100), 3);
    assert.equal(nearestSampleIndex(samples, 20), 1);
    assert.equal(nearestSampleIndex(samples, 24), 2);
});

test("terrain probe is temporary, immutable and separate from mission geometry", () =>
{
    const map = Object.create(MarsMap.prototype);
    let updates = 0;
    map.renderOverlays = () => updates++;
    const source = { lat: 18.44, lon: 77.45 };
    map.setTerrainProbe(source);
    source.lat = -19;
    assert.deepEqual(map.terrainProbe, { lat: 18.44, lon: 77.45 });
    map.setTerrainProbe({ lat: NaN, lon: 77.45 });
    assert.equal(updates, 1);
    map.setTerrainProbe(null);
    assert.equal(map.terrainProbe, null);
    assert.equal(updates, 2);
});

test("observation squares support direct edit, delete, undo and redo", () =>
{
    globalThis.localStorage = memoryStorage();
    const store = new MissionStore();
    assert.equal(store.addObservation({ lat: 18.45, lon: 77.46 }, "First", "Initial note"), true);
    const id = store.current.observations[0].id;
    assert.equal(store.updateObservation(id, { title: "Site A", note: "Revised", source: "Manual observation" }), true);
    assert.equal(store.current.observations[0].title, "Site A");
    assert.equal(store.updateObservation(id, { title: "  ", note: "invalid" }), false);
    store.deleteObservation(id);
    assert.equal(store.current.observations.length, 0);
    assert.equal(store.undo(), true);
    assert.equal(store.current.observations[0].title, "Site A");
    assert.equal(store.undo(), true);
    assert.equal(store.current.observations[0].title, "First");
    assert.equal(store.redo(), true);
    assert.equal(store.current.observations[0].title, "Site A");
    assert.equal(new MissionStore().current.observations[0].title, "Site A");
});

test("UI connects real map observations to edit/delete actions and terrain sample selection", () =>
{
    const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    const map = readFileSync(new URL("../src/map.js", import.meta.url), "utf8");
    const terrain = readFileSync(new URL("../src/science-workbench.js", import.meta.url), "utf8");
    const ui = readFileSync(new URL("../src/terrain-profile-v2-ui.js", import.meta.url), "utf8");

    assert.match(map, /data-observation/);
    assert.match(map, /selectedObservationId/);
    assert.match(map, /onObservationSelect/);
    assert.match(main, /data-context-action="delete-observation"/);
    assert.match(main, /data-action="delete-editing-observation"/);
    assert.match(main, /store\.updateObservation/);
    assert.match(terrain, /interactiveProfile\.refresh\(\)/);
    assert.match(ui, /#terrain-v2-slider/);
    assert.match(ui, /map\.setTerrainProbe/);
    assert.match(ui, /nearestSampleIndex/);
});
