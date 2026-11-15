export const CREW_AVATAR_BUCKET = "mars_crew_avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ALLOWED_AVATAR_TYPES = Object.freeze({
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
});

const USER_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function clean(value, length, fallback = "")
{
    return String(value ?? fallback).trim().slice(0, length) || fallback;
}

export function normalizeCrewProfile(input = {})
{
    return {
        display_name: clean(input.display_name, 60, "Mars Explorer"),
        callsign: clean(input.callsign, 32, "Explorer"),
        mission_role: clean(input.mission_role, 60, "Mission Planner"),
        specialty: clean(input.specialty, 80, "Exploration"),
        biography: clean(input.biography, 600)
    };
}

export function avatarObjectPath(userId, mimeType)
{
    if (!USER_ID.test(String(userId)))
    {
        throw new Error("Invalid account identity.");
    }

    const extension = ALLOWED_AVATAR_TYPES[mimeType];

    if (!extension)
    {
        throw new Error("Use PNG, JPEG or WebP images only.");
    }

    return `${userId}/avatar.${extension}`;
}

function unwrap(result)
{
    if (result?.error)
    {
        throw new Error(result.error.message);
    }

    return result?.data ?? null;
}

export class CrewProfileService
{
    constructor(cloud)
    {
        this.cloud = cloud;
    }

    get userId()
    {
        this.cloud.requireUser();
        return this.cloud.user.id;
    }

    async load()
    {
        const id = this.userId;
        const profile = unwrap(await this.cloud.client.from("mars_crew_profiles")
            .select("user_id,display_name,callsign,mission_role,specialty,biography,avatar_path,updated_at")
            .eq("user_id", id).maybeSingle());
        return profile || { user_id: id, ...normalizeCrewProfile() };
    }

    async save(input)
    {
        const row = {
            user_id: this.userId,
            ...normalizeCrewProfile(input),
            updated_at: new Date().toISOString()
        };

        return unwrap(await this.cloud.client.from("mars_crew_profiles")
            .upsert(row, { onConflict: "user_id" })
            .select("user_id,display_name,callsign,mission_role,specialty,biography,avatar_path,updated_at")
            .single());
    }

    async signedAvatarUrl(profile)
    {
        const id = this.userId;
        const path = profile?.avatar_path;

        if (!path || !path.startsWith(id + "/"))
        {
            return null;
        }

        const signed = unwrap(await this.cloud.client.storage.from(CREW_AVATAR_BUCKET)
            .createSignedUrl(path, 900));
        return signed?.signedUrl || null;
    }

    async uploadAvatar(file)
    {
        const id = this.userId;

        if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_AVATAR_BYTES)
        {
            throw new Error("Choose an image smaller than 2 MB.");
        }

        const path = avatarObjectPath(id, file.type);
        const existing = await this.load();
        const storage = this.cloud.client.storage.from(CREW_AVATAR_BUCKET);
        unwrap(await storage.upload(path, file, { upsert: true, contentType: file.type, cacheControl: "60" }));
        const row = unwrap(await this.cloud.client.from("mars_crew_profiles")
            .upsert({ user_id: id, ...normalizeCrewProfile(existing), avatar_path: path,
                updated_at: new Date().toISOString() }, { onConflict: "user_id" })
            .select("user_id,avatar_path").single());

        if (existing.avatar_path && existing.avatar_path !== path && existing.avatar_path.startsWith(id + "/"))
        {
            await storage.remove([existing.avatar_path]);
        }

        return row;
    }

    async removeAvatar()
    {
        const existing = await this.load();

        if (!existing.avatar_path)
        {
            return false;
        }

        const id = this.userId;

        if (!existing.avatar_path.startsWith(id + "/"))
        {
            throw new Error("Avatar path does not belong to this account.");
        }

        unwrap(await this.cloud.client.from("mars_crew_profiles")
            .upsert({ user_id: id, ...normalizeCrewProfile(existing), avatar_path: null,
                updated_at: new Date().toISOString() }, { onConflict: "user_id" })
            .select("user_id").single());
        unwrap(await this.cloud.client.storage.from(CREW_AVATAR_BUCKET).remove([existing.avatar_path]));
        return true;
    }
}
