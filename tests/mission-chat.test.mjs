import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MissionChatService, normalizeChatMessage } from "../src/mission-chat.js";

const owner = "6d638d9b-1c0b-4bca-af87-7e72ae0a931f";
const mission = "3c0ab8d1-1d25-4928-a94a-356b46e08142";

function mockedCloud()
{
    const calls = [];
    const rows = [];
    const actions = {
        from(table)
        {
            return {
                insert(row)
                {
                    calls.push({ kind: "insert",table,row });

                    if (table === "mars_mission_chat_messages")
                    {
                        return { select: () => ({ single: async () => ({data: {...row,id:"fake"},error:null}) }) };
                    }

                    return { data: null, error: null };
                },
                select()
                {
                    return {
                        eq()
                        {
                            return {
                                order()
                                {
                                    return { limit: async () => ({ data: rows,error:null }) };
                                },
                                then: undefined
                            };
                        }
                    };
                },
                delete()
                {
                    return {
                        eq() { return this; },
                        then() { return Promise.resolve({ data:null,error:null }); }
                    };
                }
            };
        },
        channel(key)
        {
            calls.push({kind:"subscribe",key});
            return {
                on(name,filter,handler)
                {
                    calls.push({kind:"handler",name,filter});
                    return this;
                },
                subscribe() { return this; }
            };
        },
        removeChannel() { calls.push({kind:"unsubscribe"}); }
    };

    return { user:{id:owner},client:actions,calls,
        requireUser() { if(!this.user)throw Error("Sign in required"); } };
}

test("team chat strictly limits message content before posting", () =>
{
    assert.equal(normalizeChatMessage("   Mars team 🪐  "),"Mars team 🪐");
    assert.throws(()=>normalizeChatMessage("  "),/1–600/);
    assert.throws(()=>normalizeChatMessage("x".repeat(601)),/1–600/);
    assert.throws(()=>normalizeChatMessage(null),/must be text/);
});

test("team chat uses cloud membership-scoped mission identifiers and signed-in authors", async () =>
{
    const cloud = mockedCloud();
    const service = new MissionChatService(cloud);
    const result = await service.send(mission,"   Check CTX slope   ");
    assert.equal(result.body,"Check CTX slope");
    assert.deepEqual(cloud.calls[0],{kind:"insert",table:"mars_mission_chat_messages",
        row:{mission_id:mission,sender_id:owner,body:"Check CTX slope"}});
    await assert.rejects(service.send("not-a-uuid","Hi"),/Choose a cloud mission/);
    cloud.user = null;
    await assert.rejects(service.send(mission,"Hi"),/Sign in/);
});

test("report and block controls reject spoofed user identities and self-reporting", async () =>
{
    const cloud = mockedCloud();
    const service = new MissionChatService(cloud);
    await assert.rejects(service.block(owner),/another team member/);
    await assert.rejects(service.report({id:mission,mission_id:mission,sender_id:owner},"spam"),/valid message/);
    await assert.rejects(service.report({id:mission,mission_id:mission,sender_id:"e52c1708-cf60-49df-99ad-f45341444bf3"},"wrong"),/valid message/);
    await service.block("e52c1708-cf60-49df-99ad-f45341444bf3");
    assert.equal(cloud.calls.at(-1).table,"mars_chat_blocks");
    await service.report({id:mission,mission_id:mission,sender_id:"e52c1708-cf60-49df-99ad-f45341444bf3"},"spam");
    assert.equal(cloud.calls.at(-1).table,"mars_chat_reports");
});

test("Realtime listening subscribes to a specific mission and cleans up", () =>
{
    const cloud = mockedCloud();
    const service = new MissionChatService(cloud);
    service.listen(mission,()=>{});
    assert.equal(cloud.calls.find(x=>x.kind==="handler").filter.filter,"mission_id=eq."+mission);
    service.stop();
    assert.ok(cloud.calls.some(x=>x.kind==="unsubscribe"));
});

test("chat UI renders message content using textContent, not user-controlled HTML", () =>
{
    const ui = readFileSync(new URL("../src/mission-chat-ui.js",import.meta.url),"utf8");
    const cloud = readFileSync(new URL("../src/cloud-ui.js",import.meta.url),"utf8");
    assert.match(ui,/body\.textContent = item\.body/);
    assert.match(ui,/Global chat is not enabled/);
    assert.match(ui,/Block/);
    assert.match(ui,/Report/);
    assert.match(cloud,/mountMissionChat/);
    assert.match(cloud,/missionChat\.onUserChanged/);
    assert.match(cloud,/showHubTab\("chat"\)/);
});
