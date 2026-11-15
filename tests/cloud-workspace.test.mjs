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
    assert.match(ui, /cloud\.shareByEmail\(row\.id, email, access\)/);
    assert.match(ui, /cloud\.removeMember\(row\.id, member\.user_id\)/);
    assert.match(ui, /cloud\.cancelPendingInvitation\(row\.id, invite\.email\)/);
    assert.match(ui, /updateLibrary\(store\.current\.id\)/);
    assert.match(ui, /await updateLibrary\(missionId\)/);
    assert.match(ui, /missions\.some\(item => item\.id === missionId\)/);
});

test("account UI keeps local editing separate and reports auth errors", () =>
{
    assert.match(ui, /cloud\.loadMission\(id\)/);
    assert.match(ui, /store\.loadCloudMission\(mission\)/);
    assert.match(ui, /catch \(error\)/);
    assert.match(ui, /Check your email to confirm your account/);
    assert.match(ui, /Share by email/);
    assert.doesNotMatch(ui, /cloud-copy-id|cloud-member-id/);
});


test("Mission Center combines device saves, cloud saves, checkpoints and exports", () =>
{
    const main = read("../src/main.js");
    assert.match(ui, /mission-hub-open/);
    assert.match(ui, /hub-device-list/);
    assert.match(ui, /deviceList.append\(localList\)/);
    assert.match(ui, /hub-checkpoints/);
    assert.match(ui, /checkpointPanel/);
    assert.match(ui, /hub-export-actions/);
    assert.match(ui, /exports.append\(button\)/);
    assert.match(ui, /cloud-save/);
    assert.match(ui, /missions.some\(item => item.id === missionId\)/);
    assert.match(main, /mountCloudWorkspace\(\{ store, notify \}\)/);
    assert.match(main, /get\("#mission-submit"\).textContent/);
});


test("Mission Center remains visible on mobile despite legacy header selectors", () =>
{
    assert.match(ui, /account.id = "mission-hub-open"/);
    assert.match(css, /\.header-actions #mission-hub-open/);
    assert.match(css, /display:inline-flex!important/);
});


test("email invitation distinguishes active access from pending and offers a copyable note", () =>
{
    assert.match(ui, /Pending — email account not yet connected/);
    assert.match(ui, /Copy invite/);
    assert.match(ui, /navigator\.clipboard\.writeText\(text\)/);
    assert.match(ui, /accessList\.members\.some/);
    assert.match(ui, /Access active/);
    assert.match(ui, /no confirmed Mars Atlas account matches/);
    assert.doesNotMatch(ui, /No invitation email is sent automatically/);
});
