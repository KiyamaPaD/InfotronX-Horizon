import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const client = read("../src/cloud-sync.js");
const ui = read("../src/cloud-ui.js");
const config = read("../src/cloud-config.js");
const sql = read("../local-sql/01_mars_cloud_schema.sql");
const store = read("../src/store.js");
const main = read("../src/main.js");

test("cloud integration is opt-in and uses no privileged browser key", () =>
{
    assert.match(config, /url: "https:\/\/yuvdrjptwumbfzjsimoe\.supabase\.co"/);
    assert.match(config, /publishableKey: "sb_publishable_[A-Za-z0-9_-]+"/);
    assert.doesNotMatch(config, /sb_secret_[A-Za-z0-9]+/);
    assert.doesNotMatch(config.replace(/^\s*\/\/.*$/gm, ""), /service_role|sb_secret_/);
    assert.match(client, /sb_publishable_/);
    assert.match(client, /this.configured/);
    assert.match(ui, /account.hidden = !enabled/);
});

test("cloud actions preserve manual mission ownership and RLS", () =>
{
    assert.match(client, /signInWithPassword/);
    assert.match(client, /auth.signUp/);
    assert.match(client, /mars_missions/);
    assert.match(client, /mars_mission_members/);
    assert.match(client, /eq\("revision", knownRevision\)/);
    assert.match(client, /this.baseRevisions.set\(id, row.revision\)/);
    assert.match(client, /knownRevision === undefined/);
    assert.match(ui, /const form = event.currentTarget/);
    assert.match(store, /loadCloudMission\(candidate\)/);
    assert.match(main, /mountCloudWorkspace/);
});

test("SQL keeps all cloud objects under RLS, without anonymous grants", () =>
{
    for (const table of ["mars_missions", "mars_mission_members", "mars_mission_versions"])
    {
        assert.match(sql, new RegExp("alter table public\\." + table + " enable row level security"));
    }

    assert.match(sql, /mars_private\.can_read_mission/);
    assert.match(sql, /mars_private\.can_edit_mission/);
    assert.match(sql, /owner_id = \(select auth.uid\(\)\)/);
    assert.doesNotMatch(sql, /grant .* to anon\s*;/);
});
