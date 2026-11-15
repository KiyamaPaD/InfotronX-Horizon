import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avatarObjectPath, CREW_AVATAR_BUCKET, MAX_AVATAR_BYTES,
    normalizeCrewProfile, CrewProfileService } from "../src/crew-profile.js";

const userId = "b42e03e4-28f1-4ef0-94b9-64ef5c591651";

function fakeCloud()
{
    let stored = null;
    const recorded = [];
    const client = {
        from(table)
        {
            assert.equal(table, "mars_crew_profiles");
            return {
                select()
                {
                    return {
                        eq(field, id)
                        {
                            assert.equal(field, "user_id");
                            assert.equal(id, userId);
                            return { maybeSingle: async () => ({ data: stored, error: null }) };
                        }
                    };
                },
                upsert(row, settings)
                {
                    assert.equal(settings.onConflict, "user_id");
                    assert.equal(row.user_id, userId);
                    stored = { ...(stored || {}), ...row };
                    return {
                        select()
                        {
                            return { single: async () => ({ data: stored, error: null }) };
                        }
                    };
                }
            };
        },
        storage: {
            from(bucket)
            {
                assert.equal(bucket, CREW_AVATAR_BUCKET);
                return {
                    async upload(path, file, options)
                    {
                        recorded.push({ action: "upload", path, fileSize: file.size, options });
                        return { data: { path }, error: null };
                    },
                    async remove(paths)
                    {
                        recorded.push({ action: "remove", paths });
                        return { data: paths, error: null };
                    },
                    async createSignedUrl(path, expiry)
                    {
                        recorded.push({ action: "signed", path, expiry });
                        return { data: { signedUrl: "https://example.test/private-avatar" }, error: null };
                    }
                };
            }
        }
    };

    return {
        user: { id: userId, email: "test@example.test" },
        client,
        recorded,
        requireUser()
        {
            if (!this.user)
            {
                throw new Error("Not authenticated");
            }
        }
    };
}

test("crew profile metadata trims, caps and defaults to non-NASA labels", () =>
{
    const value = normalizeCrewProfile({
        display_name: "  River Analyst  ", callsign: "C".repeat(60),
        mission_role: "  Terrain Researcher ", specialty: "Planetary GIS",
        biography: "Hi".repeat(400)
    });
    assert.equal(value.display_name, "River Analyst");
    assert.equal(value.callsign.length, 32);
    assert.equal(value.mission_role, "Terrain Researcher");
    assert.equal(value.biography.length, 600);
    assert.equal(normalizeCrewProfile({ display_name: " " }).display_name, "Mars Explorer");
});

test("avatar paths are per-user, typed and never permit arbitrary public URLs", () =>
{
    assert.equal(avatarObjectPath(userId, "image/jpeg"), userId + "/avatar.jpg");
    assert.equal(avatarObjectPath(userId, "image/png"), userId + "/avatar.png");
    assert.equal(avatarObjectPath(userId, "image/webp"), userId + "/avatar.webp");
    assert.throws(() => avatarObjectPath("other-user", "image/png"), /Invalid account/);
    assert.throws(() => avatarObjectPath(userId, "image/svg+xml"), /PNG, JPEG or WebP/);
    assert.equal(MAX_AVATAR_BYTES, 2097152);
});

test("profile loads, saves, signs private URLs and deletes uploaded avatar", async () =>
{
    const cloud = fakeCloud();
    const service = new CrewProfileService(cloud);
    const initial = await service.load();
    assert.equal(initial.display_name, "Mars Explorer");
    const saved = await service.save({
        display_name: "  Aurora  ", callsign: "CR-9",
        mission_role: "Route scientist", specialty: "Geodata", biography: "Mars mapping"
    });
    assert.equal(saved.display_name, "Aurora");
    assert.equal(saved.user_id, userId);
    const loaded = await service.load();
    assert.equal(loaded.callsign, "CR-9");
    assert.equal(await service.signedAvatarUrl(loaded), null);

    await assert.rejects(service.uploadAvatar({ size: MAX_AVATAR_BYTES + 1, type: "image/png" }), /2 MB/);
    await service.uploadAvatar({ size: 1000, type: "image/webp" });
    const withAvatar = await service.load();
    assert.equal(withAvatar.avatar_path, userId + "/avatar.webp");
    assert.equal(await service.signedAvatarUrl(withAvatar), "https://example.test/private-avatar");
    assert.ok(cloud.recorded.some(x => x.action === "signed" && x.expiry === 900));
    assert.ok(cloud.recorded.some(x => x.action === "upload" && x.options.upsert === true));

    await service.uploadAvatar({ size: 1500, type: "image/jpeg" });
    assert.equal((await service.load()).avatar_path, userId + "/avatar.jpg");
    assert.ok(cloud.recorded.some(x => x.action === "remove" && x.paths.includes(userId + "/avatar.webp")));
    assert.equal(await service.removeAvatar(), true);
    assert.equal((await service.load()).avatar_path, null);
    assert.equal(await service.removeAvatar(), false);
});

test("signed avatars cannot be requested by the wrong signed-in account", async () =>
{
    const cloud = fakeCloud();
    const service = new CrewProfileService(cloud);
    assert.equal(await service.signedAvatarUrl({
        avatar_path: "813ca192-889c-4fcb-a31a-2240ad19b44b/avatar.png"
    }), null);
    cloud.user = null;
    await assert.rejects(service.load(), /Not authenticated/);
});

test("Crew Profile appears as its own tab and never claims official NASA status", () =>
{
    const cloudUi = readFileSync(new URL("../src/cloud-ui.js", import.meta.url), "utf8");
    const crewUi = readFileSync(new URL("../src/crew-profile-ui.js", import.meta.url), "utf8");
    const style = readFileSync(new URL("../src/workspace-polish.css", import.meta.url), "utf8");
    assert.match(cloudUi, /data-hub-tab="crew"/);
    assert.match(cloudUi, /id="crew-profile-form"/);
    assert.match(cloudUi, /id="crew-avatar-upload"/);
    assert.match(cloudUi, /not NASA credentials/i);
    assert.match(crewUi, /CrewProfileService/);
    assert.match(style, /\.crew-profile-hero/);
});
