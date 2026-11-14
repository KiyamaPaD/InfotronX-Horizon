import { createMission } from "./store.js";

export const REVIEW_START = Object.freeze({ lat: 18.44460, lon: 77.45090 });
export const REVIEW_GOAL = Object.freeze({ lat: 18.45100, lon: 77.46000 });

export function createJezeroReviewMission()
{
    const mission = createMission("Jezero · CTX science traverse demo");
    mission.description = "Manual-first science traverse across a real USGS/NASA 20 m CTX terrain clip; route safety NOT established.";
    mission.routes[0].name = "Human-drawn route · original";
    mission.routes[0].points = [
        { id: crypto.randomUUID(), ...REVIEW_START },
        { id: crypto.randomUUID(), ...REVIEW_GOAL }
    ];
    mission.observations.push({
        id: crypto.randomUUID(), lat: 18.44745, lon: 77.45585,
        title: "Hypothetical survey obstruction",
        note: "Demo-only user hypothesis for a what-if exclusion zone. This is NOT a NASA mapped hazard.",
        source: "Illustrative user observation — not NASA verified",
        createdAt: new Date().toISOString()
    });
    mission.evaScenario = { ...mission.evaScenario, retraceReturn: true, observationMinutes: 20 };
    return mission;
}
