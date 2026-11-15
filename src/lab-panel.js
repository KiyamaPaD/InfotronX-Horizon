// The planning lab window: one card per idea, each with editable numbers, an example already filled in, and a result you can read.
import * as lab from "./lab.js";
import { BENCHMARK } from "./benchmark.js";
import { decodeBundledDem, JEZERO_DEM_URL } from "./bundled-dem.js";
import { planRouteOnDem, profileRouteOnDem } from "./terrain.js";
import { marsDistance } from "./geo.js";

const rows = text => text.split(";").map(part => part.trim()).filter(Boolean).map(part => part.split(":").map(cell => cell.trim()));
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const EXAMPLE_PATH = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 420, y: 160 }, { x: 420, y: 520 }, { x: 700, y: 600 }];
let demPromise = null;
const loadDem = () => demPromise ??= fetch(JEZERO_DEM_URL).then(response => response.json()).then(decodeBundledDem);
const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "∞";

export function labCards(ctx)
{
    return [
        { id: "5.1", title: "Plan by scientific value", about: "Pick the goals worth the time. Format: name:value:hours; …",
          inputs: [{ n: "goals", l: "Goals", v: "Delta front:9:3; Crater rim:6:2; Dune field:4:2; Rock sample:5:1.5; Old riverbed:7:2.5" }, { n: "budget", l: "Time budget (hours)", v: 6 }],
          run: v => { const p = lab.planByValue(rows(v.goals).map(([name, value, hours]) => ({ name, value: num(value), hours: num(hours) })), num(v.budget)); return [`Visit: ${p.chosen.map(g => g.name).join(", ") || "nothing fits"}`, `Value ${p.value} in ${fmt(p.hours)} h`, `Left uncovered: ${p.skipped.map(g => g.name).join(", ") || "nothing"} (value ${p.uncoveredValue})`]; } },
        { id: "5.2", title: "Instruments change the mission", about: "Goals: name:needs(+ separated):hours. Kit: name:kg.",
          inputs: [{ n: "goals", l: "Goals", v: "Rock sample:drill+camera:2; Dust study:sensor:1" }, { n: "kit", l: "Kit", v: "camera:1; drill:6; sensor:2" }, { n: "limit", l: "Mass limit (kg)", v: 8 }],
          run: v => { const r = lab.checkInstruments(rows(v.goals).map(([name, needs, hours]) => ({ name, needs: needs.split("+").map(s => s.trim()), hours: num(hours) })), rows(v.kit).map(([name, kg]) => ({ name, massKg: num(kg) })), num(v.limit)); return [`Kit ${fmt(r.mass)} kg · ${fmt(r.hours)} h of goals`, `Possible: ${r.doable.join(", ") || "none"}`, ...(r.issues.length ? r.issues : ["No problems found."])]; } },
        { id: "5.3", title: "Route with the most geological variety", about: "Sites: name:x:y:unit (metres from the start). Units are what you write; load a real geological map for real ones.",
          inputs: [{ n: "sites", l: "Sites", v: "A:200:50:delta; B:350:-40:delta; C:600:120:crater floor; D:900:300:dunes; E:1800:50:ridge" }, { n: "budget", l: "Distance budget (m)", v: 1500 }],
          run: v => { const r = lab.diverseRoute({ x: 0, y: 0 }, rows(v.sites).map(([name, x, y, unit]) => ({ name, x: num(x), y: num(y), unit })), num(v.budget)); return [`Visit in order: ${r.visited.map(s => `${s.name} (${s.unit})`).join(" → ") || "none"}`, `Distance ${fmt(r.meters, 0)} m`, `Units not reached: ${r.missed.join(", ") || "none"}`]; } },
        { id: "5.4", title: "Why is there no route?", about: "Plans on the Jezero height model between the benchmark start and end, with a blocking zone across the way, then relaxes one constraint at a time.",
          inputs: [{ n: "slope", l: "Slope limit (%)", v: 4 }, { n: "radius", l: "Blocking zone radius (m)", v: 300 }],
          run: async v => { const dem = await loadDem(), [a, , c] = BENCHMARK.routes[0].points, mid = { lat: (a[0] + c[0]) / 2, lon: (a[1] + c[1]) / 2 };
              const r = lab.explainNoRoute(o => planRouteOnDem(dem, [{ lat: a[0], lon: a[1] }, { lat: c[0], lon: c[1] }], o), { maxSlopePercent: num(v.slope), exclusionZones: [{ ...mid, radiusMeters: Math.min(5000, num(v.radius, 300)) }] });
              return r.ok ? ["A route exists with these limits."] : [`No route: ${r.reason}`, r.blockers.length ? `It becomes possible if you relax: ${r.blockers[0]}` : "Relaxing the slope limit or the zone alone does not help; change the start, the end or both."]; } },
        { id: "5.5", title: "Backup plans with triggers", about: "Rules: condition → action, the first true one wins. Conditions: blocked, hoursLeft<N, oxygenLeft<N.",
          inputs: [{ n: "state", l: "Now: blocked? (yes/no)", v: "no" }, { n: "hours", l: "Hours left", v: 1.2 }, { n: "oxygen", l: "Oxygen left (kg)", v: 0.6 }],
          run: v => { const state = { blocked: v.state.trim() === "yes", hours: num(v.hours), oxygen: num(v.oxygen) };
              const rule = lab.chooseBackup([{ when: s => s.blocked, then: "Point B is blocked: go to point C." }, { when: s => s.oxygen < 0.3, then: "Oxygen low: return by the shortest way now." }, { when: s => s.hours < 1.5, then: "Time is short: drop the secondary goal and keep the main one." }, { when: () => true, then: "Continue the plan." }], state); return [rule.then]; } },
        { id: "5.7", title: "Does the best route stay the best?", about: "Shakes the climb and distance numbers by the uncertainty, thousands of times, and counts which route wins. Uses the benchmark routes.",
          inputs: [{ n: "lambda", l: "Relief penalty", v: 6 }, { n: "unc", l: "Uncertainty (%)", v: 25 }],
          run: v => { const r = lab.routeRobustness(ctx.benchmarkRows(), num(v.lambda), num(v.unc)); return [`Preferred at this penalty: ${r.preferred}`, ...r.shares.map(s => `${s.name}: wins ${(s.share * 100).toFixed(0)} % of runs`), r.stable ? "The choice is stable." : "The choice is not stable: the numbers are not good enough to decide."]; } },
        { id: "5.8", title: "What would we most like to know?", about: "Which single number, if it were off, would change the choice. Uses the benchmark routes.",
          inputs: [{ n: "lambda", l: "Relief penalty", v: 10.6 }, { n: "unc", l: "Uncertainty (%)", v: 10 }],
          run: v => { const r = lab.mostUsefulObservation(ctx.benchmarkRows(), num(v.lambda), num(v.unc)); return r.worth ? [`Now: ${r.baseline}`, `Measure first: the ${r.worth.field} of "${r.worth.route}" (a ${r.worth.change > 0 ? "+" : ""}${r.worth.change} % error would make "${r.worth.newWinner}" win).`] : [`Now: ${r.baseline}. No single ${v.unc} % error changes it, so more measuring would not change the decision.`]; } },
        { id: "5.9", title: "Navigation without GPS", about: "Position uncertainty (1 sigma) grows with distance and shrinks at a landmark. Uses your active route, or an example.",
          inputs: [{ n: "drift", l: "Drift (% of distance)", v: 3 }, { n: "lm", l: "Landmark accuracy (m)", v: 5 }, { n: "at", l: "Landmark at waypoint no.", v: 3 }],
          run: v => { const path = ctx.path(), s = lab.deadReckoning(path, num(v.drift), num(v.lm), [num(v.at) - 1]); return [ctx.pathNote(), ...s.map(p => `Waypoint ${p.index + 1} · ${fmt(p.distance, 0)} m walked · ±${fmt(p.sigma)} m`)]; } },
        { id: "5.10", title: "Align an image with a height model", about: "Matched points: imageX:imageY:demX:demY (metres). Gives the shift and the error left over.",
          inputs: [{ n: "pairs", l: "Control points", v: "0:0:12:-8; 400:0:411:-9; 400:300:413:290; 0:300:10:292" }],
          run: v => { const r = lab.alignment(rows(v.pairs).map(([ix, iy, dx, dy]) => ({ image: { x: num(ix), y: num(iy) }, dem: { x: num(dx), y: num(dy) } }))); return [`Shift to apply: ${fmt(r.shiftX)} m east, ${fmt(r.shiftY)} m north`, `Error left: RMS ${fmt(r.rms)} m, worst ${fmt(r.worst)} m`]; } },
        { id: "5.11", title: "Turning radius and reversing", about: "Finds turns that are tighter than the rover can make. Uses your active route, or an example.",
          inputs: [{ n: "r", l: "Smallest turning radius (m)", v: 40 }],
          run: v => { const c = lab.checkTurning(ctx.path(), num(v.r)); return [ctx.pathNote(), c.ok ? "Every turn is wide enough." : `Too tight at waypoint ${c.tight.map(t => t.index + 1).join(", ")}${c.tight.some(t => t.reverse) ? " (a reversal there)" : ""}.`, `Tightest turn: ${fmt(c.smallest, 0)} m radius`]; } },
        { id: "5.12", title: "Vehicle width along the route", about: "Zones: name:x:y:radius (metres, same frame as the route). Uses your active route, or an example.",
          inputs: [{ n: "zones", l: "Obstacles", v: "Boulder field:200:60:30; Crater:430:300:80" }, { n: "w", l: "Vehicle width (m)", v: 2.5 }, { n: "m", l: "Margin each side (m)", v: 2 }],
          run: v => { const r = lab.footprintClearance(ctx.path(), rows(v.zones).map(([name, x, y, radius]) => ({ name, x: num(x), y: num(y), radius: num(radius) })), num(v.w), num(v.m)); return [ctx.pathNote(), r.ok ? `Clear: the ${fmt(r.half * 2)} m corridor fits.` : r.problems.map(p => `${p.name}: gap ${fmt(p.gap)} m, needs ${fmt(p.need)} m`).join(" · ")]; } },
        { id: "5.13", title: "Side slope and tipping", about: "Tip angle = atan((track ÷ 2) ÷ height of the centre of gravity), divided by a safety factor.",
          inputs: [{ n: "track", l: "Track width (m)", v: 1.4 }, { n: "cg", l: "Centre of gravity height (m)", v: 0.8 }, { n: "slope", l: "Side slope (°)", v: 12 }, { n: "f", l: "Safety factor", v: 2 }],
          run: v => { const r = lab.lateralStability(num(v.track), num(v.cg), num(v.slope), num(v.f, 2)); return [`Tips at about ${fmt(r.tipDegrees)}°; allowed ${fmt(r.allowed)}°`, r.ok ? `Safe by ${fmt(r.margin)}°.` : `Too steep by ${fmt(-r.margin)}°.`]; } },
        { id: "5.14", title: "Wheel slip", about: "Commanded versus real distance (an illustrative law; real soil needs real tests).",
          inputs: [{ n: "d", l: "Commanded distance (m)", v: 100 }, { n: "s", l: "Slope (°)", v: 10 }, { n: "soil", l: "Soil (firm / sand / loose)", v: "sand" }],
          run: v => { const r = lab.wheelSlip(num(v.d), num(v.s), v.soil.trim()); return [`Slip ${(r.slip * 100).toFixed(1)} %`, `Real distance ${fmt(r.realMeters)} m, lost ${fmt(r.lostMeters)} m`]; } },
        { id: "5.15", title: "Two rovers in a narrow pass", about: "Two example paths cross. Finds when they come closer than the safe gap.",
          inputs: [{ n: "a", l: "Speed A (m/s)", v: 0.5 }, { n: "b", l: "Speed B (m/s)", v: 0.4 }, { n: "gap", l: "Safe gap (m)", v: 15 }],
          run: v => { const r = lab.convoyConflicts(EXAMPLE_PATH, num(v.a, 0.5), [{ x: 700, y: 0 }, { x: 420, y: 300 }, { x: 150, y: 520 }], num(v.b, 0.4), num(v.gap)); return r.first ? [`Conflict after ${fmt(r.first.seconds / 60)} min; closest ${fmt(r.closest)} m.`, "Hold one rover or change its speed."] : ["No conflict on these paths and speeds."]; } },
        { id: "5.16", title: "Where two teams meet", about: "Straight line between two teams; B leaves later by a delay.",
          inputs: [{ n: "d", l: "Distance (m)", v: 3000 }, { n: "a", l: "Speed A (km/h)", v: 2.4 }, { n: "b", l: "Speed B (km/h)", v: 1.8 }, { n: "delay", l: "B leaves later by (min)", v: 10 }],
          run: v => { const r = lab.meetingPoint(num(v.d), num(v.a) / 3.6, num(v.b) / 3.6, num(v.delay) * 60); return [`They meet after ${fmt(r.seconds / 60)} min`, `${fmt(r.fromA, 0)} m from A, ${fmt(r.fromB, 0)} m from B`]; } },
        { id: "5.17", title: "Radio relay from line of sight", about: "On the benchmark route's real heights (20 m CTX model): can the two ends see each other, and where could a relay stand?",
          inputs: [{ n: "h", l: "Antenna height (m)", v: 2 }],
          run: async v => { const dem = await loadDem(), pts = BENCHMARK.routes[0].points.map(([lat, lon]) => ({ lat, lon })), prof = profileRouteOnDem(dem, pts);
              const samples = prof.samples.filter(s => Number.isFinite(s.elevationMeters)).map(s => ({ distance: s.distanceMeters, elevation: s.elevationMeters })), r = lab.relaySites(samples, num(v.h, 2));
              return r.direct ? [`The ends see each other over ${fmt(samples.at(-1).distance, 0)} m: no relay needed.`] : r.relays.length ? [`Blocked. Best relay places (highest first): ${r.relays.map(x => `${fmt(x.distance, 0)} m along (${fmt(x.elevation, 0)} m high)`).join("; ")}`] : ["Blocked and no single relay sees both ends: use two relays."]; } },
        { id: "5.18", title: "Time windows", about: "Stops: name:opens:closes:stay h:leg m from the previous stop (hours of the day).",
          inputs: [{ n: "stops", l: "Stops", v: "Base:8:20:0.5:0; Delta:9:12:1.5:2400; Rim:11:16:1:1500" }, { n: "start", l: "Start hour", v: 8 }, { n: "speed", l: "Speed (km/h)", v: 2.4 }],
          run: v => { const r = lab.scheduleWindows(rows(v.stops).map(([name, opens, closes, stay, leg]) => ({ name, opens: num(opens), closes: num(closes), stayHours: num(stay), legMeters: num(leg) })), num(v.start), num(v.speed, 2.4)); return [...r.log.map(e => `${e.name}: arrive ${fmt(e.arrive, 2)} h${e.wait ? `, wait ${fmt(e.wait, 2)} h` : ""}, leave ${fmt(e.leave, 2)} h${e.late ? " · TOO LATE" : ""}`), r.feasible ? `Feasible, back at ${fmt(r.end, 2)} h.` : "Not feasible in this order."]; } },
        { id: "5.19", title: "Battery over time", about: "Charge hour by hour with solar charging by day and a cold penalty at night.",
          inputs: [{ n: "cap", l: "Capacity (Wh)", v: 2200 }, { n: "load", l: "Load (W)", v: 280 }, { n: "sun", l: "Solar (W)", v: 120 }, { n: "day", l: "Daylight hours per sol", v: 12 }, { n: "hours", l: "Hours to simulate", v: 12 }],
          run: v => { const r = lab.batteryOverTime({ capacityWh: num(v.cap), loadWatts: num(v.load), solarWatts: num(v.sun), dayHours: num(v.day), hours: Math.min(96, num(v.hours, 12)) }); return [r.emptyAt ? `Empty after ${r.emptyAt} h.` : `Ends at ${fmt(r.end, 0)} Wh.`, r.series.map(s => `${s.hour}h ${fmt(s.charge, 0)}Wh${s.day ? "☀" : "☾"}`).join(" · ")]; } },
        { id: "5.20", title: "Equipment temperature", about: "Warm-up and pauses: a heater against heat loss to the outside (a first-order model).",
          inputs: [{ n: "start", l: "Start (°C)", v: 15 }, { n: "out", l: "Outside (°C)", v: -60 }, { n: "heat", l: "Heater (W)", v: 30 }, { n: "min", l: "Minutes", v: 120 }, { n: "ok", l: "Lowest working temperature (°C)", v: -10 }],
          run: v => { const r = lab.thermalState({ startC: num(v.start), outsideC: num(v.out), heaterWatts: num(v.heat), heatCapacityJPerC: 4000, lossWPerC: 1, minutes: Math.min(1440, num(v.min, 120)), minOperatingC: num(v.ok) }); return [`After ${v.min} min: ${fmt(r.end)} °C (settles near ${fmt(r.settles)} °C)`, r.coldMinutes ? `${r.coldMinutes} min below the working temperature: pause and warm up.` : "Stays warm enough."]; } },
        { id: "5.21", title: "Depots and resupply points", about: "Stops: x:y (metres). Puts k depots so no stop is far from one.",
          inputs: [{ n: "stops", l: "Stops", v: "0:0; 800:100; 1600:-200; 2400:400; 3200:0; 4000:600" }, { n: "k", l: "Depots", v: 2 }],
          run: v => { const r = lab.placeDepots(rows(v.stops).map(([x, y]) => ({ x: num(x), y: num(y) })), Math.max(1, Math.round(num(v.k, 1)))); return [`Depots at: ${r.depots.map(d => `(${d.x}, ${d.y})`).join(" ")}`, `Farthest stop is ${fmt(r.worst, 0)} m from a depot`]; } },
        { id: "5.22", title: "Samples and contamination", about: "Samples: id:kind:grams:container. Forbidden pairs: kind+kind.",
          inputs: [{ n: "s", l: "Samples", v: "S1:organic:40:T1; S2:salt:70:T1; S3:basalt:60:T2" }, { n: "f", l: "Must not share", v: "organic+salt" }, { n: "lim", l: "Container limit (g)", v: 100 }],
          run: v => { const r = lab.checkSamples(rows(v.s).map(([id, kind, g, container]) => ({ id, kind, massG: num(g), container })), v.f.split(";").map(p => p.split("+").map(s => s.trim())).filter(p => p.length === 2), num(v.lim)); return r.ok ? [`All ${r.containers.length} containers are fine.`] : r.issues; } },
        { id: "5.24", title: "Data budget", about: "Items: name:MB:value:compress (yes/no). What fits in the link window, best value per MB first.",
          inputs: [{ n: "items", l: "Items", v: "Panorama:40:5:yes; Spectra:4:9:no; Video:200:3:yes; Log:1:2:no" }, { n: "kbps", l: "Link (kbit/s)", v: 256 }, { n: "min", l: "Window (min)", v: 10 }, { n: "c", l: "Compression ×", v: 3 }],
          run: v => { const r = lab.dataBudget(rows(v.items).map(([name, mb, value, compress]) => ({ name, mb: num(mb, 1), value: num(value), compress: compress === "yes" })), num(v.kbps), num(v.min), num(v.c, 1)); return [`Room: ${fmt(r.capacityMb)} MB`, `Send now: ${r.sendNow.map(i => `${i.name} (${fmt(i.sentMb)} MB)`).join(", ") || "nothing"}`, `Keep for later: ${r.later.map(i => i.name).join(", ") || "nothing"}`]; } },
        { id: "5.25", title: "Recovery after an uncertain landing", about: "From the far edge of the landing ellipse, can the oxygen reach the base?",
          inputs: [{ n: "a", l: "Ellipse half-length (km)", v: 4 }, { n: "b", l: "Ellipse half-width (km)", v: 2 }, { n: "off", l: "Base distance from centre (km)", v: 1.5 }, { n: "sp", l: "Speed (km/h)", v: 2.4 }, { n: "o2", l: "Oxygen time (h)", v: 3 }],
          run: v => { const r = lab.recoveryReach(num(v.a), num(v.b), num(v.off), num(v.sp, 2.4), num(v.o2)); return [`Worst case ${fmt(r.worstKm)} km, ${fmt(r.hours)} h`, r.ok ? "The oxygen covers it." : `Not enough: ${fmt(r.extraKm)} km too far. Add oxygen or a closer cache.`]; } },
        { id: "5.27", title: "Local 3D points on the planet", about: "Points: east:north:up (metres from an anchor). Places them on Mars and compares with a flat height.",
          inputs: [{ n: "p", l: "Points", v: "0:0:0; 50:0:1.5; 100:20:3; 150:40:2" }, { n: "lat", l: "Anchor latitude", v: 18.4446 }, { n: "lon", l: "Anchor longitude", v: 77.4509 }, { n: "h", l: "Anchor height (m)", v: -2600 }, { n: "head", l: "Heading (°)", v: 0 }],
          run: v => { const placed = lab.georeferenceLocal(rows(v.p).map(([x, y, z]) => ({ x: num(x), y: num(y), z: num(z) })), { lat: num(v.lat), lon: num(v.lon), height: num(v.h) }, num(v.head)); const d = lab.heightDifference(placed, () => num(v.h)); return [...placed.map(q => `${q.lat.toFixed(6)}°, ${q.lon.toFixed(6)}° · ${fmt(q.height)} m`), `Against a flat ${v.h} m: mean ${fmt(d.mean)} m, RMS ${fmt(d.rms)} m`]; } },
        { id: "5.28", title: "Export for a small educational rover", about: "Route as local-metre waypoints with headings (CSV). Nothing is connected to hardware. Uses your active route, or an example.",
          inputs: [], run: () => [ctx.pathNote(), lab.roverExport(ctx.path())] }
    ];
}

function changeCard(host)
{
    const card = document.createElement("section");
    card.className = "lab-card";
    card.dataset.id = "5.26";
    card.innerHTML = `<h3><span class="lab-id">5.26</span> Change between two observations</h3><p class="lab-about">Choose two pictures of the same place. They are shrunk to 64 × 64 grey cells and compared.</p>
        <label class="lab-field">Before<input type="file" accept="image/*" data-a></label><label class="lab-field">After<input type="file" accept="image/*" data-b></label>
        <label class="lab-field">Difference that counts (0–255)<input type="number" value="40" data-t></label><button type="button" class="btn btn-accent compact" data-run>Compare</button><pre class="lab-out" aria-live="polite"></pre>`;
    const out = card.querySelector(".lab-out");
    const grey = async file => { const bitmap = await createImageBitmap(file), canvas = document.createElement("canvas"); canvas.width = canvas.height = 64; const context = canvas.getContext("2d"); context.drawImage(bitmap, 0, 0, 64, 64); const data = context.getImageData(0, 0, 64, 64).data; return Array.from({ length: 4096 }, (_, i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3); };
    card.querySelector("[data-run]").addEventListener("click", async () =>
    {
        const a = card.querySelector("[data-a]").files[0], b = card.querySelector("[data-b]").files[0];

        if (!a || !b) { out.textContent = "Choose both pictures first."; return; }

        try { const r = lab.detectChange(await grey(a), await grey(b), Number(card.querySelector("[data-t]").value) || 40); out.textContent = `${(r.share * 100).toFixed(1)} % of the area changed (${r.changed} of 4096 cells). Lighting and angle also change a picture: check by eye.`; }
        catch { out.textContent = "One of the pictures could not be read."; }
    });
    host.append(card);
}

export function mountLab({ getRoute, notify })
{
    const dialog = document.createElement("dialog");
    dialog.className = "modal lab-dialog";
    dialog.setAttribute("aria-labelledby", "lab-title");
    dialog.innerHTML = `<div class="modal-header"><span class="section-label">PLANNING LAB</span><button class="modal-x" type="button" data-lab="close" aria-label="Close the lab">×</button></div>
        <h2 id="lab-title">Planning lab</h2><p class="settings-note">Small models for mission ideas. Every card has an example filled in: change the numbers and press Run. These are planning aids built from the numbers you give, not measurements and not a safety approval.</p>
        <input type="search" class="lab-search" placeholder="Search the lab (battery, radio, samples…)" aria-label="Search the lab"><div class="lab-list"></div>
        <div class="dialog-actions"><button class="btn btn-accent" type="button" data-lab="close">Done</button></div>`;
    document.body.appendChild(dialog);
    const list = dialog.querySelector(".lab-list");
    let built = false;

    const ctx = {
        benchmarkRows: () => BENCHMARK.routes.map(route => ({ name: route.name, distanceMeters: route.expected.distanceMeters, verticalMeters: route.expected.ascentMeters + route.expected.descentMeters })),
        path: () => { const route = getRoute?.(); return route && route.length > 1 ? lab.toLocal(route) : EXAMPLE_PATH; },
        pathNote: () => { const route = getRoute?.(); return route && route.length > 1 ? `Using your active route (${route.length} waypoints, ${Math.round(route.slice(1).reduce((s, p, i) => s + marsDistance(route[i], p), 0))} m).` : "Using an example path (draw a route with two or more waypoints to use yours)."; }
    };

    function build()
    {
        list.replaceChildren();

        for (const card of labCards(ctx))
        {
            const section = document.createElement("section");
            section.className = "lab-card";
            section.dataset.id = card.id;
            section.innerHTML = `<h3><span class="lab-id">${card.id}</span> ${card.title}</h3><p class="lab-about"></p><div class="lab-inputs"></div><button type="button" class="btn btn-accent compact" data-run>Run</button><pre class="lab-out" aria-live="polite"></pre>`;
            section.querySelector(".lab-about").textContent = card.about;
            const inputs = section.querySelector(".lab-inputs");

            for (const input of card.inputs)
            {
                const label = document.createElement("label");
                label.className = "lab-field";
                label.append(document.createTextNode(input.l));
                const field = document.createElement("input");
                field.value = input.v;
                field.dataset.n = input.n;
                label.append(field);
                inputs.append(label);
            }

            const out = section.querySelector(".lab-out");
            const run = async () =>
            {
                const values = {};
                section.querySelectorAll("[data-n]").forEach(field => { values[field.dataset.n] = field.value; });

                try { out.textContent = (await card.run(values)).join("\n"); }
                catch (error) { out.textContent = "That did not work: " + (error?.message || "check the numbers."); }
            };
            section.querySelector("[data-run]").addEventListener("click", run);
            list.append(section);
        }

        changeCard(list);
        built = true;
    }

    dialog.querySelector(".lab-search").addEventListener("input", event =>
    {
        const query = event.target.value.trim().toLowerCase();
        list.querySelectorAll(".lab-card").forEach(card => { card.hidden = query && !card.textContent.toLowerCase().includes(query); });
    });
    dialog.addEventListener("click", event => { if (event.target.closest("[data-lab=close]")) dialog.close(); });

    return { open() { if (!built) build(); if (!dialog.open) dialog.showModal(); notify?.("Planning lab opened."); } };
}
