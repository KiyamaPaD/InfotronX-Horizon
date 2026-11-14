import test from "node:test";
import assert from "node:assert/strict";
import { MissionCloud } from "../src/cloud-sync.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const missionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const routeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sampleMission()
{
    return {
        id: missionId,
        title: "Jezero study",
        description: "An editable mission.",
        routes: [{ id: routeId, name: "Route A", points: [
            { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", lat: 18.44, lon: 77.45 },
            { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", lat: 18.45, lon: 77.46 }
        ] }],
        activeRouteId: routeId,
        observations: [],
        checkpoints: []
    };
}

function mockDatabase(initialRow)
{
    const state = {
        mission: initialRow ? structuredClone(initialRow) : null,
        writes: 0,
        snapshots: []
    };

    const client = {
        from(table)
        {
            if (table === "mars_mission_versions")
            {
                return {
                    insert(payload)
                    {
                        state.snapshots.push(payload);
                        return Promise.resolve({ data: payload, error: null });
                    }
                };
            }

            assert.equal(table, "mars_missions");

            return {
                action: "select",
                filters: new Map(),
                select() { return this; },
                eq(field, value)
                {
                    this.filters.set(field, value);
                    return this;
                },
                insert(payload)
                {
                    this.action = "insert";
                    this.payload = payload;
                    return this;
                },
                update(payload)
                {
                    this.action = "update";
                    this.payload = payload;
                    return this;
                },
                async maybeSingle()
                {
                    if (this.action === "select")
                    {
                        return { data: state.mission ? { id: state.mission.id, revision: state.mission.revision } : null, error: null };
                    }

                    if (this.action === "update")
                    {
                        state.writes++;

                        if (!state.mission || this.filters.get("revision") !== state.mission.revision)
                        {
                            return { data: null, error: null };
                        }

                        Object.assign(state.mission, this.payload);
                        return { data: { id: state.mission.id, revision: state.mission.revision }, error: null };
                    }

                    throw new Error("Unexpected query operation");
                },
                async single()
                {
                    if (this.action === "insert")
                    {
                        state.writes++;
                        state.mission = { ...this.payload, revision: 1 };
                        return { data: { id: state.mission.id, revision: 1 }, error: null };
                    }

                    if (!state.mission)
                    {
                        return { data: null, error: { message: "Not found" } };
                    }

                    return { data: { payload: state.mission.payload, revision: state.mission.revision }, error: null };
                }
            };
        }
    };

    return { client, state };
}

function makeCloud(db)
{
    const cloud = new MissionCloud();
    cloud.user = { id: ownerId, email: "owner@example.invalid" };
    cloud.client = db.client;
    return cloud;
}

test("unknown local revision never overwrites a mission already in the cloud", async () =>
{
    const mission = sampleMission();
    const db = mockDatabase({ id: missionId, revision: 3, payload: mission });
    const cloud = makeCloud(db);

    await assert.rejects(() => cloud.saveMission(mission), /another revision/);
    assert.equal(db.state.writes, 0);
    assert.equal(db.state.mission.revision, 3);
});

test("opening a cloud mission sets its revision before a safe update", async () =>
{
    const mission = sampleMission();
    const db = mockDatabase({ id: missionId, revision: 4, payload: mission });
    const cloud = makeCloud(db);

    const opened = await cloud.loadMission(missionId);
    assert.equal(opened.title, mission.title);
    assert.equal(cloud.baseRevisions.get(missionId), 4);

    opened.title = "Jezero survey updated";
    const result = await cloud.saveMission(opened);

    assert.equal(result.revision, 5);
    assert.equal(result.snapshotSaved, true);
    assert.equal(db.state.mission.title, "Jezero survey updated");
    assert.equal(db.state.snapshots.length, 1);
    assert.equal(db.state.snapshots[0].revision, 5);
});

test("server revision changes between read and write are rejected", async () =>
{
    const mission = sampleMission();
    const db = mockDatabase({ id: missionId, revision: 7, payload: mission });
    const cloud = makeCloud(db);
    cloud.baseRevisions.set(missionId, 6);

    await assert.rejects(() => cloud.saveMission(mission), /another revision/);
    assert.equal(db.state.writes, 0);
    assert.equal(db.state.mission.revision, 7);
});

test("first cloud save creates one mission and one history snapshot", async () =>
{
    const db = mockDatabase(null);
    const cloud = makeCloud(db);

    const result = await cloud.saveMission(sampleMission());
    assert.equal(result.revision, 1);
    assert.equal(db.state.writes, 1);
    assert.equal(db.state.snapshots.length, 1);
    assert.equal(db.state.snapshots[0].revision, 1);
});


test("listing cloud missions is independent of email invitation processing", async () =>
{
    const cloud = new MissionCloud();
    cloud.user = { id: ownerId };
    let queryCount = 0;
    cloud.claimEmailInvitations = () =>
    {
        throw new Error("Invitation RPC unavailable");
    };
    cloud.client = {
        from(table)
        {
            assert.equal(table, "mars_missions");
            queryCount++;
            return {
                select() { return this; },
                order() { return this; },
                limit() { return Promise.resolve({ data: [{ id: missionId, title: "Jezero study" }], error: null }); }
            };
        }
    };

    const items = await cloud.listMissions();
    assert.equal(items[0].id, missionId);
    assert.equal(queryCount, 1);
});
