const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REPORT_REASONS = new Set(["spam","harassment","inappropriate","other"]);

export function normalizeChatMessage(value)
{
    if (typeof value !== "string")
    {
        throw new Error("Chat messages must be text.");
    }

    const body = value.trim();

    if (body.length < 1 || body.length > 600)
    {
        throw new Error("Write 1–600 characters in the chat message.");
    }

    return body;
}

function unwrap(response)
{
    if (response?.error)
    {
        throw new Error(response.error.message);
    }

    return response?.data ?? null;
}

export class MissionChatService
{
    constructor(cloud)
    {
        this.cloud = cloud;
        this.channel = null;
    }

    get userId()
    {
        this.cloud.requireUser();
        return this.cloud.user.id;
    }

    validateMission(id)
    {
        this.cloud.requireUser();

        if (!UUID.test(String(id)))
        {
            throw new Error("Choose a cloud mission you can access.");
        }
    }

    async list(missionId)
    {
        this.validateMission(missionId);
        const rows = unwrap(await this.cloud.client.from("mars_mission_chat_messages")
            .select("id,mission_id,sender_id,body,created_at")
            .eq("mission_id", missionId).order("created_at", { ascending: false }).limit(60));
        return (rows || []).reverse();
    }

    async send(missionId, text)
    {
        this.validateMission(missionId);
        const body = normalizeChatMessage(text);
        return unwrap(await this.cloud.client.from("mars_mission_chat_messages")
            .insert({ mission_id: missionId, sender_id: this.userId, body })
            .select("id,mission_id,sender_id,body,created_at").single());
    }

    async remove(missionId, messageId)
    {
        this.validateMission(missionId);

        if (!UUID.test(String(messageId)))
        {
            throw new Error("Invalid message.");
        }

        unwrap(await this.cloud.client.from("mars_mission_chat_messages")
            .delete().eq("mission_id", missionId).eq("id", messageId).eq("sender_id", this.userId));
    }

    async block(memberId)
    {
        if (!UUID.test(String(memberId)) || memberId === this.userId)
        {
            throw new Error("Choose another team member.");
        }

        unwrap(await this.cloud.client.from("mars_chat_blocks").insert({
            blocker_id: this.userId, blocked_id: memberId
        }));
    }

    async unblock(memberId)
    {
        if (!UUID.test(String(memberId)))
        {
            throw new Error("Invalid team member.");
        }

        unwrap(await this.cloud.client.from("mars_chat_blocks")
            .delete().eq("blocker_id", this.userId).eq("blocked_id", memberId));
    }

    async blocked()
    {
        return unwrap(await this.cloud.client.from("mars_chat_blocks")
            .select("blocked_id").eq("blocker_id", this.userId)) || [];
    }

    async report(message, reason)
    {
        this.validateMission(message?.mission_id);

        if (!REPORT_REASONS.has(reason) || !UUID.test(String(message?.id)) ||
            !UUID.test(String(message?.sender_id)) || message.sender_id === this.userId)
        {
            throw new Error("Choose a valid message and report reason.");
        }

        unwrap(await this.cloud.client.from("mars_chat_reports").insert({
            mission_id: message.mission_id, message_id: message.id,
            reporter_id: this.userId, reported_user_id: message.sender_id, reason
        }));
    }

    listen(missionId, onChange)
    {
        this.validateMission(missionId);
        this.stop();
        this.channel = this.cloud.client
            .channel("mars-team-chat-" + missionId)
            .on("postgres_changes", {
                event:"*", schema:"public", table:"mars_mission_chat_messages",
                filter:"mission_id=eq." + missionId
            }, () => onChange())
            .subscribe();
    }

    stop()
    {
        if (this.channel && this.cloud.client)
        {
            this.cloud.client.removeChannel(this.channel);
        }

        this.channel = null;
    }
}
