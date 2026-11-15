import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJezeroReviewMission } from "../src/review-demo.js";
import { buildMissionFacts, localMissionExplanation, normalizeCopilotQuestion } from "../src/mission-copilot.js";
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
