import { CLOUD_CONFIG } from "./cloud-config.js";
import { validateMission } from "./store.js";

const SDK = "https://esm.sh/@supabase/supabase-js@2.81.1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertResult(result)
{
    if (result.error)
    {
        throw new Error(result.error.message);
    }

    return result.data;
}

export class MissionCloud
{
    constructor(onUserChange = () => {})
    {
        this.client = null;
        this.user = null;
        this.baseRevisions = new Map();
        this.onUserChange = onUserChange;
    }

    get configured()
    {
        return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(CLOUD_CONFIG.url)
            && /^sb_publishable_[A-Za-z0-9_-]+$/.test(CLOUD_CONFIG.publishableKey);
    }

    async initialize()
    {
        if (!this.configured)
        {
            return false;
        }

        const { createClient } = await import(SDK);
        this.client = createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.publishableKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        this.client.auth.onAuthStateChange((_event, session) =>
        {
            const nextUser = session?.user || null;

            if (this.user?.id !== nextUser?.id)
            {
                this.baseRevisions.clear();
            }

            this.user = nextUser;
            this.onUserChange(this.user);
        });
        const response = await this.client.auth.getUser();
        this.user = response.data.user || null;
        this.onUserChange(this.user);
        return true;
    }

    requireUser()
    {
        if (!this.client || !this.user)
        {
            throw new Error("Sign in to access your saved missions.");
        }
    }

    async signIn(email, password)
    {
        assertResult(await this.client.auth.signInWithPassword({ email, password }));
        const response = await this.client.auth.getUser();
        this.user = response.data.user || null;
        this.onUserChange(this.user);
    }

    async signUp(email, password)
    {
        return assertResult(await this.client.auth.signUp({
            email, password, options: { emailRedirectTo: window.location.origin }
        }));
    }

    async signOut()
    {
        assertResult(await this.client.auth.signOut());
        this.user = null;
        this.baseRevisions.clear();
        this.onUserChange(null);
    }

    async listMissions()
    {
        this.requireUser();
        await this.claimEmailInvitations();
        return assertResult(await this.client.from("mars_missions")
            .select("id,title,owner_id,revision,updated_at")
            .order("updated_at", { ascending: false }).limit(60));
    }

    async loadMission(id)
    {
        this.requireUser();

        if (!UUID.test(id))
        {
            throw new Error("Invalid mission identifier.");
        }

        const row = assertResult(await this.client.from("mars_missions")
            .select("payload,revision").eq("id", id).single());
        const mission = validateMission(row.payload);

        if (!mission || mission.id !== id)
        {
            throw new Error("The stored mission cannot be opened.");
        }

        this.baseRevisions.set(id, row.revision);
        return mission;
    }

    async saveMission(mission)
    {
        this.requireUser();

        if (!UUID.test(mission.id))
        {
            throw new Error("This mission needs a valid identifier before saving.");
        }

        const contents = JSON.stringify(mission);

        if (new TextEncoder().encode(contents).length > 900000)
        {
            throw new Error("This mission exceeds the cloud size limit. Export it as JSON.");
        }

        const current = assertResult(await this.client.from("mars_missions")
            .select("id,revision").eq("id", mission.id).maybeSingle());
        const knownRevision = this.baseRevisions.get(mission.id);

        if (current && (knownRevision === undefined || current.revision !== knownRevision))
        {
            throw new Error("This cloud mission has another revision. Export your local changes before reopening the cloud copy.");
        }

        if (!current && knownRevision !== undefined)
        {
            throw new Error("This mission was removed from the cloud. Export your local copy before trying again.");
        }

        const values = {
            title: mission.title,
            description: mission.description || "",
            payload: JSON.parse(contents)
        };
        let saved;

        if (!current)
        {
            saved = assertResult(await this.client.from("mars_missions")
                .insert({ id: mission.id, owner_id: this.user.id, ...values })
                .select("id,revision").single());
        }
        else
        {
            saved = assertResult(await this.client.from("mars_missions")
                .update({ ...values, revision: current.revision + 1, updated_at: new Date().toISOString() })
                .eq("id", mission.id).eq("revision", knownRevision)
                .select("id,revision").maybeSingle());

            if (!saved)
            {
                throw new Error("This mission changed in the cloud. Open the latest copy before saving again.");
            }
        }

        this.baseRevisions.set(saved.id, saved.revision);

        const snapshot = await this.client.from("mars_mission_versions").insert({
            mission_id: saved.id, editor_id: this.user.id,
            revision: saved.revision, payload: values.payload
        });

        return { revision: saved.revision, snapshotSaved: !snapshot.error };
    }

    async claimEmailInvitations()
    {
        this.requireUser();
        return assertResult(await this.client.rpc("mars_claim_email_invitations"));
    }

    async shareByEmail(missionId, email, access)
    {
        this.requireUser();

        if (!UUID.test(missionId) || !/^[^ @]+@[^ @]+\.[^ @]+$/.test(email.trim()) || !["viewer", "editor"].includes(access))
        {
            throw new Error("Enter a valid teammate email and permission.");
        }

        return assertResult(await this.client.rpc("mars_share_by_email", {
            p_mission_id: missionId,
            p_email: email.trim().toLowerCase(),
            p_access: access
        }));
    }

    async listPendingInvitations(missionId)
    {
        this.requireUser();
        return assertResult(await this.client.from("mars_email_invitations")
            .select("email,access,created_at").eq("mission_id", missionId)
            .order("created_at", { ascending: false }));
    }

    async cancelPendingInvitation(missionId, email)
    {
        this.requireUser();
        assertResult(await this.client.from("mars_email_invitations")
            .delete().eq("mission_id", missionId).eq("email", email));
    }

    async inviteMember(missionId, userId, access)
    {
        this.requireUser();

        if (!UUID.test(missionId) || !UUID.test(userId) || !["viewer", "editor"].includes(access))
        {
            throw new Error("Choose a valid teammate ID and access role.");
        }

        return assertResult(await this.client.from("mars_mission_members")
            .insert({ mission_id: missionId, user_id: userId, access })
            .select("user_id,access").single());
    }

    async listMembers(missionId)
    {
        this.requireUser();
        return assertResult(await this.client.rpc("mars_member_directory", { p_mission_id: missionId }));
    }

    async removeMember(missionId, userId)
    {
        this.requireUser();
        assertResult(await this.client.from("mars_mission_members")
            .delete().eq("mission_id", missionId).eq("user_id", userId));
    }
}
