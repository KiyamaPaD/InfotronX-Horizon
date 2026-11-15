import test from "node:test";
import assert from "node:assert/strict";
import { describeSource } from "../src/source-label.js";

const JEZERO = { lat: 18.4446, lon: 77.4509 };
const OUTSIDE = { lat: 18.9, lon: 77.9 };

test("Viking reports its native zoom", () =>
{
    assert.equal(describeSource("viking", 7, JEZERO), "Viking · z7");
    assert.equal(describeSource("viking", 5, JEZERO), "Viking · z5");
});

test("HiRISE selection below zoom 9 shows the enlarged Viking backdrop", () =>
{
    assert.equal(describeSource("hirise", 7, JEZERO), "Viking · z7");
    assert.equal(describeSource("hirise", 8, JEZERO), "Viking upscaled from z7 · z8");
});

test("HiRISE inside its coverage names the 25 cm source and the real zoom", () =>
{
    assert.equal(describeSource("hirise", 9, JEZERO), "HiRISE 25 cm · z9");
    assert.equal(describeSource("hirise", 11, JEZERO), "HiRISE 25 cm · z11");
});

test("HiRISE outside its coverage says the view is Viking upscaled from zoom 7", () =>
{
    assert.equal(describeSource("hirise", 10, OUTSIDE), "Viking upscaled from z7 · z10");
    assert.equal(describeSource("hirise", 10, { lat: 18.3, lon: 77.45 }), "Viking upscaled from z7 · z10");
});

test("MOLA is labelled as shaded relief, never as elevation data", () =>
{
    assert.equal(describeSource("mola", 7, JEZERO), "MOLA shaded relief (not elevation) · z7");
    assert.match(describeSource("mola", 6, OUTSIDE), /not elevation/);
});
