import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

// An unclosed block silently moves every later rule into the wrong media query (seen after a merge).
test("every stylesheet has balanced braces", async () =>
{
    const files = (await readdir(new URL("../src/", import.meta.url))).filter(name => name.endsWith(".css"));

    for (const name of files)
    {
        const css = (await readFile(new URL("../src/" + name, import.meta.url), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
        let depth = 0;

        for (const character of css)
        {
            if (character === "{") depth++;
            if (character === "}") depth--;
            assert.ok(depth >= 0, name + " closes a block that was never opened");
        }

        assert.equal(depth, 0, name + " leaves " + depth + " block(s) open");
    }
});
