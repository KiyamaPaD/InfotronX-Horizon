import { MissionChatService } from "./mission-chat.js";

export function mountMissionChat({ dialog, cloud, notify, run, openCloudTab })
{
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.hubTab = "chat";
    tab.setAttribute("role","tab");
    tab.setAttribute("aria-selected","false");
    tab.textContent = "Team chat";
    dialog.querySelector('[data-hub-tab="crew"]').before(tab);

    const panel = document.createElement("section");
    panel.className = "mission-hub-panel";
    panel.id = "hub-chat";
    panel.dataset.hubPanel = "chat";
    panel.hidden = true;
    panel.innerHTML = `
        <h3>Mission team chat</h3>
        <p class="section-help">Private conversation for a cloud-saved mission. The mission owner and invited viewers/editors can read and send messages. Saving routes is a separate action.</p>
        <div id="team-chat-login">
            <p>Sign in and save or open a cloud mission to use its team chat.</p>
            <button type="button" class="btn btn-outline" id="team-chat-signin">Open cloud library</button>
        </div>
        <div id="team-chat-signed" hidden>
            <label class="cloud-label">Cloud mission
                <select id="team-chat-mission" aria-label="Mission chat conversation"></select>
            </label>
            <p id="team-chat-status" role="status" aria-live="polite">Choose a cloud mission.</p>
            <div id="team-chat-messages" class="team-chat-messages" role="log" aria-label="Mission messages" aria-live="polite"></div>
            <form id="team-chat-send">
                <label>Message (1–600 characters)
                    <textarea id="team-chat-draft" maxlength="600" rows="3" placeholder="Coordinate science stops, discuss routes and mission changes."></textarea>
                </label>
                <div class="team-chat-actions">
                    <button type="submit" class="btn btn-accent">Send to team</button>
                    <button id="team-chat-refresh" type="button" class="btn btn-outline">Refresh</button>
                </div>
            </form>
            <details id="team-chat-blocks"><summary>Blocked members</summary>
                <div id="team-chat-block-list"></div>
            </details>
            <p class="science-footnote">Messages are stored in Supabase, not inside the mission JSON. The database enforces team membership, a 3-second cooldown and at most 10 messages per minute. Report and block controls are available on other people's messages.</p>
        </div>
        <p class="science-footnote">Global chat is not enabled: it requires staffed moderation and abuse handling before public launch.</p>`;
    dialog.querySelector("#hub-crew").before(panel);

    const service = new MissionChatService(cloud);
    const el = id => panel.querySelector(id);
    const picker = el("#team-chat-mission");
    const stream = el("#team-chat-messages");
    const status = el("#team-chat-status");
    const form = el("#team-chat-send");
    const blockList = el("#team-chat-block-list");
    let activeId = "";
    let messages = [];
    let blocked = [];
    let timer = null;
    let generation = 0;

    function tell(text)
    {
        status.textContent = text;
    }

    function clear()
    {
        generation++;
        service.stop();
        clearInterval(timer);
        timer = null;
        activeId = "";
        messages = [];
        blocked = [];
        stream.replaceChildren();
    }

    function appendAction(host, label, callback)
    {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-outline";
        button.textContent = label;
        button.addEventListener("click", callback);
        host.append(button);
    }

    function showMessages()
    {
        stream.replaceChildren();
        const userId = cloud.user?.id;

        if (!messages.length)
        {
            const placeholder = document.createElement("p");
            placeholder.className = "science-footnote";
            placeholder.textContent = "No visible messages yet. Start your mission discussion.";
            stream.append(placeholder);
        }

        for (const item of messages)
        {
            const message = document.createElement("article");
            message.className = "team-chat-message";
            const owner = item.sender_id === userId;
            const heading = document.createElement("div");
            heading.className = "team-chat-heading";
            const sender = document.createElement("strong");
            sender.textContent = owner ? "You" : "Team member " + item.sender_id.slice(0, 6);
            const timestamp = document.createElement("time");
            const date = new Date(item.created_at);
            timestamp.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
            heading.append(sender, timestamp);
            const body = document.createElement("p");
            body.textContent = item.body;
            const actions = document.createElement("div");
            actions.className = "team-chat-row-actions";

            if (owner)
            {
                appendAction(actions, "Delete", () => run(async () =>
                {
                    if (!window.confirm("Delete this message for everyone in the mission chat?"))
                    {
                        return;
                    }

                    await service.remove(activeId, item.id);
                    await refresh();
                }, tell));
            }
            else
            {
                appendAction(actions, "Block", () => run(async () =>
                {
                    await service.block(item.sender_id);
                    await refresh();
                    tell("Member blocked. Their messages are hidden for your account.");
                }, tell));
                const select = document.createElement("select");
                select.setAttribute("aria-label","Reason for reporting message");
                for (const [value,label] of [
                    ["spam","Spam"],["harassment","Harassment"],["inappropriate","Inappropriate"],["other","Other"]
                ])
                {
                    select.add(new Option(label,value));
                }

                actions.append(select);
                appendAction(actions,"Report",() => run(async () =>
                {
                    await service.report(item,select.value);
                    tell("Report recorded for administrator review.");
                },tell));
            }

            message.append(heading,body,actions);
            stream.append(message);
        }
    }

    function showBlocks()
    {
        blockList.replaceChildren();

        if (!blocked.length)
        {
            blockList.textContent = "No blocked members.";
            return;
        }

        for (const entry of blocked)
        {
            const row = document.createElement("div");
            row.className = "team-chat-block-row";
            const name = document.createElement("span");
            name.textContent = "Member " + entry.blocked_id.slice(0, 6);
            row.append(name);
            appendAction(row,"Unblock",() => run(async () =>
            {
                await service.unblock(entry.blocked_id);
                await refresh();
            },tell));
            blockList.append(row);
        }
    }

    async function refresh()
    {
        const userId = cloud.user?.id;
        const requestId = generation;
        const missionId = activeId;

        if (!userId || !missionId)
        {
            return;
        }

        const [nextMessages,nextBlocked] = await Promise.all([
            service.list(missionId),service.blocked()
        ]);

        if (requestId !== generation || cloud.user?.id !== userId || activeId !== missionId)
        {
            return;
        }

        messages = nextMessages;
        blocked = nextBlocked;
        showMessages();
        showBlocks();
        tell(messages.length + " recent visible messages · Only signed-in mission members have access.");
        stream.scrollTop = stream.scrollHeight;
    }

    async function chooseMission(id)
    {
        clear();
        activeId = id;

        if (!id)
        {
            tell("Select a saved cloud mission.");
            return;
        }

        generation++;
        service.listen(id,() => refresh().catch(error => tell(error.message)));
        timer = setInterval(() =>
        {
            if (dialog.open && !panel.hidden)
            {
                refresh().catch(error => tell(error.message));
            }
        }, 12000);
        await refresh();
    }

    async function open()
    {
        if (!cloud.user)
        {
            clear();
            el("#team-chat-login").hidden = false;
            el("#team-chat-signed").hidden = true;
            return;
        }

        el("#team-chat-login").hidden = true;
        el("#team-chat-signed").hidden = false;
        const prior = picker.value || activeId;
        const missions = await cloud.listMissions();
        picker.replaceChildren();

        for (const mission of missions)
        {
            picker.add(new Option(mission.title + (mission.owner_id === cloud.user.id ? " · yours" : " · shared"),mission.id));
        }

        if (!missions.length)
        {
            picker.add(new Option("No cloud missions yet — save one first",""));
        }

        if (missions.some(mission => mission.id === prior))
        {
            picker.value = prior;
        }

        await chooseMission(picker.value);
    }

    picker.addEventListener("change", () => run(() => chooseMission(picker.value),tell));
    el("#team-chat-refresh").addEventListener("click", () => run(refresh,tell));
    el("#team-chat-signin").addEventListener("click",openCloudTab);
    form.addEventListener("submit", event =>
    {
        event.preventDefault();
        const input = el("#team-chat-draft");
        const text = input.value;
        const missionId = activeId;
        run(async () =>
        {
            await service.send(missionId,text);
            input.value = "";
            await refresh();
        },tell);
    });
    dialog.addEventListener("close",clear);
    return {
        open: () => run(open,tell),
        onUserChanged: () =>
        {
            clear();
            el("#team-chat-login").hidden = !cloud.user;
            el("#team-chat-signed").hidden = Boolean(!cloud.user);
        },
        leave: clear,
        get selectedMissionId() { return activeId; }
    };
}
