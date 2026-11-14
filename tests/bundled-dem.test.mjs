import test from "node:test";
import assert from "node:assert/strict";
import { decodeBundledDem, JEZERO_DEM_RASTER_SHA256 } from "../src/bundled-dem.js";
import { createJezeroReviewMission, REVIEW_START, REVIEW_GOAL } from "../src/review-demo.js";
import { marsDistance } from "../src/geo.js";

function makeTinyGrid(values)
{
    const bytes = Buffer.alloc(values.length * 2);
    values.forEach((value, index) => bytes.writeUInt16LE(value, index * 2));
    return {
        encoding: "uint16-little-endian-base64",
        sourceRasterSha256: JEZERO_DEM_RASTER_SHA256,
        width: 2, height: 2, north: 18.46, west: 77.44,
        latStep: 0.001, lonStep: 0.001,
        elevationOffsetMeters: -2700, elevationStepMeters: 0.01,
        elevationsBase64: bytes.toString("base64"), source: "NASA USGS test data (fixture only)",
        sourceUrl: "https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic"
    };
}

test("compact DEM decoder reconstructs signed elevations and NoData", () =>
{
    const result = decodeBundledDem(makeTinyGrid([0, 234, 14500, 65535]));
    assert.deepEqual(result.elevations, [-2700, -2697.66, -2555, null]);
    assert.equal(result.width, 2);
    assert.equal(result.height, 2);
});

test("compact DEM refuses a spoofed source, partial grid, and bad base64", () =>
{
    const sample = makeTinyGrid([0, 1000, 1001, 1002]);
    assert.throws(() => decodeBundledDem({ ...sample, sourceRasterSha256: "fake" }), /provenance/);
    assert.throws(() => decodeBundledDem({ ...sample, elevationsBase64: "AAA" }), /incomplete/);
    assert.throws(() => decodeBundledDem({ ...sample, elevationsBase64: "!!!!!!!!!!!!" }), /base64/);
});

test("demo waypoints are inside the genuine Jezero CTX clip", () =>
{
    const mission = createJezeroReviewMission();
    assert.equal(mission.routes.length, 1);
    assert.equal(mission.routes[0].points.length, 2);
    assert.equal(mission.observations.length, 1);
    assert.equal(mission.evaScenario.retraceReturn, true);
    assert.ok(marsDistance(REVIEW_START, REVIEW_GOAL) > 400);

    for (const point of [...mission.routes[0].points, ...mission.observations])
    {
        assert.ok(point.lat >= 18.438 && point.lat <= 18.470);
        assert.ok(point.lon >= 77.443 && point.lon <= 77.478);
    }
    assert.match(mission.observations[0].note, /NOT a NASA mapped hazard/);
});

test("review button and official elevation controls are accessible in UI source", async () =>
{
    const { readFileSync } = await import("node:fs");
    const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    const science = readFileSync(new URL("../src/science-workbench.js", import.meta.url), "utf8");
    assert.match(main, /data-action="load-review-demo"/);
    assert.match(science, /id="dem-load-official"/);
    assert.match(science, /loadBundledDem/);
});


test("Jezero demo click handler does not leak into keyboard shortcuts", async () =>
{
    const { readFileSync } = await import("node:fs");
    const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    const keyboard = main.split('window.addEventListener("keydown", event =>')[1];
    assert.ok(keyboard, "Keyboard handler must exist");
    assert.equal((main.match(/if \(action === "load-review-demo"\)/g) || []).length, 1);
    assert.doesNotMatch(keyboard, /action === "load-review-demo"/);
    assert.match(keyboard, /const shortcutModes =/);
});
