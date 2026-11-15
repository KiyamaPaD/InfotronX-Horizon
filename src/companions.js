// Ideas for a safer Marswalk: robots that could go along, the supplies to carry, and the point beyond which a return is no longer
// covered by the reserve. All of it is planning material built from the resource scenario. None of it is measured data,
// a safety approval or a statement about real hardware, except where a real example is named.

export const COMPANIONS = Object.freeze([
    { id: "scout", name: "Scout rover", role: "Goes ahead of the walker and checks the way.", carries: "Cameras and a slope sensor; reports hazards before the walker arrives.", help: "Long routes with steep or unknown ground.", kind: "concept" },
    { id: "pack", name: "Pack rover", role: "Carries the load so the walker does not have to.", carries: "Samples, tools, a spare oxygen tank and a spare battery.", help: "Sample collection and long days.", kind: "concept" },
    { id: "relay", name: "Radio relay", role: "Keeps the radio link alive behind hills and inside craters.", carries: "A radio and its own battery; stays on high ground.", help: "Routes that drop into canyons, craters or behind ridges.", kind: "real-analog", example: "On Mars today, orbiters pass messages between the rovers and Earth." },
    { id: "drone", name: "Survey drone", role: "Looks at the route from the air and picks the next safe stretch.", carries: "A camera. It must be recharged between flights.", help: "Choosing between two ways around an obstacle.", kind: "real-analog", example: "NASA's Ingenuity helicopter flew on Mars 72 times between 2021 and 2024." },
    { id: "cache", name: "Supply cache robot", role: "Leaves oxygen, power and water at planned stops.", carries: "Sealed supply boxes marked on the map.", help: "Out-and-back routes that are long for one tank.", kind: "concept" },
    { id: "rescue", name: "Rescue rover", role: "Waits at the base and goes out if the walker calls for help.", carries: "A stretcher or tow line, extra oxygen and first aid.", help: "Any route far from base.", kind: "concept" }
]);

const reserve = estimate => Math.max(0, Math.min(90, estimate.assumptions.reservePercent)) / 100;

// What to pack for a route. Amounts follow the resource scenario; the rest is a checklist with a reason for each item.
export function supplyKit(estimate)
{
    const keep = 1 - reserve(estimate);
    const oxygen = estimate.oxygenKg / keep;
    const battery = estimate.batteryWh / keep;
    const spareHours = 2;
    return [
        { id: "oxygen", name: "Oxygen for the route", amount: `${oxygen.toFixed(2)} kg`, why: `The route needs ${estimate.oxygenKg.toFixed(2)} kg; the rest is the ${estimate.assumptions.reservePercent}% reserve.` },
        { id: "spare-oxygen", name: "Emergency oxygen", amount: `${(spareHours * estimate.assumptions.oxygenKgPerHour).toFixed(2)} kg`, why: `${spareHours} hours of breathing on top of the plan, kept sealed until needed.` },
        { id: "battery", name: "Suit and tool power", amount: `${Math.round(battery)} Wh`, why: `The route needs ${Math.round(estimate.batteryWh)} Wh plus the reserve.` },
        { id: "comms", name: "Backup radio", amount: "1", why: "If the main radio fails, this is the only way to call for help." },
        { id: "beacon", name: "Emergency beacon", amount: "1", why: "Lets the base find you if you cannot talk." },
        { id: "repair", name: "Suit repair kit", amount: "1 kit", why: "Patches and sealant for small leaks and tears." },
        { id: "thermal", name: "Thermal blanket", amount: "1", why: "Nights on Mars are far colder than days." },
        { id: "first-aid", name: "First-aid kit", amount: "1", why: "For injuries while help is far away." },
        { id: "tools", name: "Tools and rope", amount: "1 set", why: "To free a stuck wheel or climb out of a small pit." },
        { id: "light", name: "Lamp", amount: "1", why: "Shadows inside craters are dark even at midday." },
        { id: "navigation", name: "Backup navigation", amount: "1", why: "A second way to know where you are if the first one fails." },
        { id: "samples", name: "Sample containers", amount: "As planned", why: "Only if your route has sample sites." }
    ];
}

// The farthest point from which the walker can still return to the start inside the reserve-adjusted budget.
// `cumulative` holds the distance in metres from the start to each waypoint. The budget is the smallest of the time, oxygen and
// battery allowances, and the way back is assumed to retrace the route at the same speed.
export function pointOfNoReturn(cumulative, estimate)
{
    const speed = estimate.assumptions.speedKmh;
    const routeCount = estimate.assumptions.retraceReturn ? 2 : 1;
    const travelHours = (cumulative.at(-1) * routeCount / 1000) / speed;
    const stopHours = Math.max(0, estimate.durationHours - travelHours);
    const rateOxygen = estimate.durationHours > 0 ? estimate.oxygenKg / estimate.durationHours : 0;
    const ratePower = estimate.durationHours > 0 ? estimate.batteryWh / estimate.durationHours : 0;
    const limits = [estimate.usableDurationHours];

    if (rateOxygen > 0) limits.push(estimate.usableOxygenKg / rateOxygen);
    if (ratePower > 0) limits.push(estimate.usableBatteryWh / ratePower);

    const budgetHours = Math.min(...limits);
    const oneWayMetres = Math.max(0, (budgetHours - stopHours)) * speed * 1000 / 2;
    let last = -1;

    cumulative.forEach((distance, index) => { if (distance <= oneWayMetres) last = index; });

    return { budgetHours, oneWayMetres, lastSafeIndex: last, reachesEnd: last === cumulative.length - 1 };
}
