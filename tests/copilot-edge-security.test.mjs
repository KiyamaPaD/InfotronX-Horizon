import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("AI edge function never exposes provider secrets or uses browser credentials", () =>
{
    const source = readFileSync(new URL("../supabase/functions/mars-mission-copilot/index.ts",import.meta.url),"utf8");
    assert.match(source,/Deno\.env\.get\("OPENAI_API_KEY"\)/);
    assert.match(source,/Deno\.env\.get\("SUPABASE_PUBLISHABLE_KEY"\)/);
    assert.match(source,/auth\/v1\/user/);
    assert.match(source,/mars_copilot_requests/);
    assert.match(source,/store:false/);
    assert.match(source,/responses/);
    assert.match(source,/no route editing permissions/i);
    assert.doesNotMatch(source,/service_role|sb_secret_/i);
});

test("AI endpoint explicitly limits origin and question size", () =>
{
    const source = readFileSync(new URL("../supabase/functions/mars-mission-copilot/index.ts",import.meta.url),"utf8");
    assert.match(source,/ALLOWED_ORIGINS/);
    assert.match(source,/USER_LIMIT = 240/);
    assert.match(source,/max_output_tokens:450/);
    assert.match(source,/AI_RATE_LIMIT/);
});

test("AI backend supports modern Supabase publishable key defaults and authenticated health checks", () =>
{
    const source = readFileSync(new URL("../supabase/functions/mars-mission-copilot/index.ts",import.meta.url),"utf8");
    assert.match(source,/SUPABASE_PUBLISHABLE_KEYS/);
    assert.match(source,/function publicKey\(/);
    assert.match(source,/input\?\.action === "status"/);
    assert.match(source,/AI_NOT_CONFIGURED/);
    assert.match(source,/AI_PROVIDER_REJECTED/);
    assert.match(source,/auth\/v1\/user/);
    assert.ok(source.indexOf('auth/v1/user') < source.indexOf('input?.action === "status"'));
});
