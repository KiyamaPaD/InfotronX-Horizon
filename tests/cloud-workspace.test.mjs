import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../src/cloud-ui.js");
const css = read("../src/workspace-polish.css");

test("cloud account layout hides inactive forms and sharing controls", () =>
{
    assert.match(css, /\.cloud-modal \[hidden\]/);
    assert.match(css, /display:none!important/);
    assert.match(ui, /get\("#cloud-auth-form"\)\.hidden = Boolean\(user\)/);
    assert.match(ui, /get\("#cloud-share"\)\.hidden = !isOwner/);
});

test("sharing always uses a selected cloud mission owned by the signer", () =>
{
    assert.match(ui, /const row = selectedMission\(\)/);
    assert.match(ui, /row\.owner_id !== cloud\.user\?\.id/);
    assert.match(ui, /cloud\.inviteMember\(row\.id, memberId, access\)/);
    assert.match(ui, /cloud\.removeMember\(row\.id, member\.user_id\)/);
    assert.match(ui, /await updateLibrary\(store\.current\.id\)/);
});

test("account UI keeps local editing separate and reports auth errors", () =>
{
    assert.match(ui, /cloud\.loadMission\(id\)/);
    assert.match(ui, /store\.loadCloudMission\(mission\)/);
    assert.match(ui, /catch \(error\)/);
    assert.match(ui, /Check your email to confirm your account/);
    assert.match(ui, /Copy ID/);
});
