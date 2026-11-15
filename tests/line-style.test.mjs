import test from "node:test";
import assert from "node:assert/strict";
import { cleanLineStyle, DEFAULT_LINE_STYLE } from "../src/line-style.js";

test("line settings stay inside safe limits", () =>
{
    const style = cleanLineStyle({ width: 99, opacity: 0, style: "zigzag", markerSize: -3, glow: 0, animate: false });
    assert.equal(style.width, 4);
    assert.equal(cleanLineStyle({ width: 0 }).width, 0.3);
    assert.equal(style.opacity, 0.3);
    assert.equal(style.style, "solid");
    assert.equal(style.markerSize, 0.3);
    assert.equal(style.glow, false);
    assert.equal(style.animate, false);
});

test("missing or broken settings fall back to the defaults", () =>
{
    assert.deepEqual(cleanLineStyle(null), { ...DEFAULT_LINE_STYLE });
    assert.deepEqual(cleanLineStyle("nonsense"), { ...DEFAULT_LINE_STYLE });
});
