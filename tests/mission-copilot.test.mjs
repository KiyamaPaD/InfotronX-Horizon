import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJezeroReviewMission } from "../src/review-demo.js";
import { buildMissionFacts, localMissionExplanation, localMissionAnswer, normalizeCopilotQuestion } from "../src/mission-copilot.js";
import { decodeBundledDem } from "../src/bundled-dem.js";

const mission = createJezeroReviewMission();
const raw = JSON.parse(readFileSync(new URL("../assets/jezero_ctx_trn_dem_20m_clip.json",import.meta.url),"utf8"));
const dem = decodeBundledDem(raw);

test("AI receives bounded aggregate metrics, not mission names, raw coordinates, note text or personal profiles", () =>
{
    const facts = buildMissionFacts(mission,dem);
    const body = JSON.stringify(facts);
    assert.equal(facts.waypointCount,2);
    assert.equal(facts.observationCount,1);
    assert.ok(facts.horizontalDistanceMeters > 0);
    assert.equal(facts.hasNumericDem,true);
    assert.equal(facts.demCoveredWaypoints,2);
    assert.doesNotMatch(body,/18\.4446|77\.4509|Hypothetical survey|Jezero · CTX science traverse demo/);
    assert.doesNotMatch(body,/password|email|avatar|access_token/);
});

test("copilot local explanations are honestly deterministic and usable without AI", () =>
{
    const facts = buildMissionFacts(mission,null);
    const response = localMissionExplanation(facts);
    assert.match(response,/DETERMINISTIC MISSION ANALYSIS/);
    assert.match(response,/Numeric DEM not loaded/);
    assert.match(response,/not prove physical rover or astronaut safety/);
});

test("copilot refuses invalid or oversized prompts", () =>
{
    assert.equal(normalizeCopilotQuestion("  Explain distance. "), "Explain distance.");
    assert.throws(()=>normalizeCopilotQuestion(" "),/1 and 240/);
    assert.throws(()=>normalizeCopilotQuestion("a".repeat(241)),/1 and 240/);
});

test("copilot AI is a separate consent-based read-only flow", () =>
{
    const ui = readFileSync(new URL("../src/mission-copilot-ui.js",import.meta.url),"utf8");
    assert.match(ui,/copilot-consent/);
    assert.match(ui,/functions\.invoke\("mars-mission-copilot"/);
    assert.match(ui,/No mission data are being changed/);
    assert.doesNotMatch(ui,/store\.save|store\.addPoint|store\.deleteRoute/);
});

test("Copilot shows diagnostic codes and keeps explicit deterministic analysis available", () =>
{
    const ui = readFileSync(new URL("../src/mission-copilot-ui.js",import.meta.url),"utf8");
    assert.match(ui,/copilot-health/);
    assert.match(ui,/AI_NOT_CONFIGURED/);
    assert.match(ui,/AI_PROVIDER_REJECTED/);
    assert.match(ui,/localMissionExplanation\(buildMissionFacts\(store.current,getDem\(\)\)\)/);
    assert.match(ui,/action:"status"/);
});

test("Copilot compares anonymized alternatives and uses the saved resource assumptions", () =>
{
    const copy = structuredClone(mission);
    copy.routes.push({ id:"alternative", name:"Private route title", points:[] });
    copy.evaScenario = { speedKmh:1.5, retraceReturn:false };
    const facts = buildMissionFacts(copy,dem);
    assert.equal(facts.alternatives.length,2);
    assert.equal(facts.alternatives[1].distanceMeters,0);
    assert.equal(facts.resourceScenario.speedKmh,1.5);
    assert.equal(facts.resourceScenario.retraceReturn,false);
    assert.equal(facts.resourceScenario.illustrative,true);
    assert.doesNotMatch(JSON.stringify(facts),/Private route title|"id":"alternative"|77\.4509/);
});

test("an empty active route does not hide the existence of populated alternatives", () =>
{
    const copy = structuredClone(mission);
    copy.routes.push({ id:"empty", name:"Empty alternative", points:[] });
    copy.activeRouteId = "empty";
    const facts = buildMissionFacts(copy,dem);
    assert.equal(facts.waypointCount,0);
    assert.equal(facts.horizontalDistanceMeters,0);
    assert.match(localMissionExplanation(facts),/Another saved route has data/);
    assert.equal(facts.alternatives[0].waypointCount,2);
});


test("free local questions use calculated route, terrain and resource evidence", () =>
{
    const facts = buildMissionFacts(mission,dem);
    assert.match(localMissionAnswer(facts,"Explain terrain"),/2\/2 waypoint/);
    assert.match(localMissionAnswer(facts,"Estimeaza timpul si oxigenul"),/kg O₂/);
    assert.match(localMissionAnswer(facts,"Este ruta sigură?"),/cannot establish safe traversability/);
    assert.match(localMissionAnswer(facts,"Explain route"),/DETERMINISTIC/);
    assert.match(localMissionAnswer(facts,"Write a poem"),/supported|question categories|Try “Compare routes”/);
});

test("local comparisons exclude empty routes from shortest-distance ranking", () =>
{
    const copy = structuredClone(mission);
    copy.routes.push({id:"empty",points:[]});
    const facts = buildMissionFacts(copy);
    assert.match(localMissionAnswer(facts,"Compare routes"),/At least two routes/);
    copy.routes.push({id:"other",points:[{lat:18.44,lon:77.44},{lat:18.45,lon:77.45}]});
    const answer = localMissionAnswer(buildMissionFacts(copy),"Compare routes");
    assert.match(answer,/Route 1:/);
    assert.match(answer,/Route 3:/);
    assert.doesNotMatch(answer,/Route 2:/);
});

test("resource answers decline empty routes and apply saved return assumptions", () =>
{
    const copy = structuredClone(mission);
    copy.evaScenario={speedKmh:1.5,retraceReturn:false};
    const facts=buildMissionFacts(copy);
    const answer=localMissionAnswer(facts,"Estimate resources");
    assert.match(answer,/1.5 km\/h; one-way travel/);
    copy.routes[0].points=[];
    assert.match(localMissionAnswer(buildMissionFacts(copy),"Estimate resources"),/at least two waypoints/);
});
