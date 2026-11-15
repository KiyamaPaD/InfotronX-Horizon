import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const build = readFileSync(new URL("../scripts/build-site.mjs", import.meta.url), "utf8");

test("the published site includes every page the app links to", () =>
{
    for (const page of ["index.html", "404.html", "legal.html", "checklist.html", "LICENSE", "src", "assets"])
    {
        assert.ok(build.includes(`'${page}'`), page + " must be in the build allowlist");
        assert.ok(existsSync(new URL("../" + page, import.meta.url)), page + " must exist");
    }
});

test("the 3D model of Mars is shipped with the assets", () =>
{
    assert.ok(existsSync(new URL("../assets/nasa/mars-3d-model.glb", import.meta.url)));
});

test("the README no longer points at the old repository", () =>
{
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    assert.doesNotMatch(readme, /KiyamaPaD/);
});
