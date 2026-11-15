import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJezeroReviewMission } from "../src/review-demo.js";
import { buildMissionFacts, buildAssistantView } from "../src/mission-copilot.js";
import { decodeBundledDem } from "../src/bundled-dem.js";
const mission = createJezeroReviewMission();
const dem = decodeBundledDem(JSON.parse(readFileSync(new URL("../assets/jezero_ctx_trn_dem_20m_clip.json",import.meta.url),"utf8")));

test("aggregate facts exclude mission titles, raw coordinates and notes", () =>
{
    const facts = buildMissionFacts(mission,dem);
    assert.equal(facts.waypointCount,2);
    assert.equal(facts.demCoveredWaypoints,2);
    assert.doesNotMatch(JSON.stringify(facts),/18\.4446|77\.4509|Hypothetical survey|Jezero · CTX science traverse demo|password|email|avatar/);
});

test("overview presents calculated metrics rather than fabricated text", () =>
{
    const view = buildAssistantView(buildMissionFacts(mission));
    assert.equal(view.metrics.length,4);
    assert.equal(view.metrics.find(item => item.label === 'Waypoints').value,'2');
    assert.match(view.note,/spherical Mars/);
});

test("terrain distinguishes unloaded DEM from sampled data without invented grade", () =>
{
    assert.equal(buildAssistantView(buildMissionFacts(mission),'terrain').metrics.length,0);
    const view = buildAssistantView(buildMissionFacts(mission,dem),'terrain');
    assert.equal(view.metrics[0].value,'2/2');
    assert.equal(view.metrics[1].value,'—');
    assert.equal(view.source,dem.source.slice(0,160));
    assert.match(view.note,/gaps/);
});

test("comparison excludes empty routes, sorts distances and keeps source ordering intact", () =>
{
    const copy = structuredClone(mission);
    copy.routes.push({id:'empty',points:[]},{id:'longer',points:[{lat:18,lon:77},{lat:20,lon:79}]});
    const facts = buildMissionFacts(copy);
    const before = JSON.stringify(facts);
    const view = buildAssistantView(facts,'compare');
    assert.deepEqual(view.routes.map(item => item.index),[1,3]);
    assert.equal(JSON.stringify(facts),before);
});

test("an empty active route has no invented travel resource estimate", () =>
{
    const copy = structuredClone(mission);
    copy.routes.push({id:'empty',points:[]});
    copy.activeRouteId='empty';
    const view = buildAssistantView(buildMissionFacts(copy),'resources');
    assert.equal(view.metrics.length,0);
    assert.match(view.note,/two waypoints/);
});

test("resource cards respect saved speed, return setting and units", () =>
{
    const copy = structuredClone(mission);
    copy.evaScenario={speedKmh:1.5,retraceReturn:false};
    const facts=buildMissionFacts(copy);
    const view=buildAssistantView(facts,'resources');
    assert.match(view.note,/1.5 km\/h, one way/);
    assert.match(view.metrics[1].value,/kg$/);
    assert.match(view.metrics[2].value,/Wh$/);
    assert.equal(view.metrics[1].value,facts.resourceScenario.oxygenKg.toFixed(3)+' kg');
});
