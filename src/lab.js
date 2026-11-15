// Planning lab: small, honest models for mission ideas. Every function is a simple calculation on numbers the user supplies
// (or on the bundled height model). Results are planning aids, not measured data and not a safety approval.
import { MARS_RADIUS_METERS } from "./constants.js";
import { rankByCost } from "./benchmark.js";

const RAD = Math.PI / 180;
export const toLocal = points => points.map(point => ({ x: (point.lon - points[0].lon) * RAD * MARS_RADIUS_METERS * Math.cos(points[0].lat * RAD), y: (point.lat - points[0].lat) * RAD * MARS_RADIUS_METERS }));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLength = path => path.slice(1).reduce((sum, point, i) => sum + dist(path[i], point), 0);

export function seededRandom(seed = 1)
{
    let state = seed >>> 0;
    return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

// 5.1 Choose the goals with the most value inside a time budget (exact search; up to 16 goals).
export function planByValue(goals, budgetHours)
{
    const list = goals.slice(0, 16);
    let best = { value: -1, mask: 0, hours: 0 };

    for (let mask = 0; mask < 1 << list.length; mask++)
    {
        let value = 0, hours = 0;

        for (let i = 0; i < list.length; i++) if (mask >> i & 1) { value += list[i].value; hours += list[i].hours; }

        if (hours <= budgetHours && (value > best.value || (value === best.value && hours < best.hours))) best = { value, mask, hours };
    }

    const chosen = list.filter((_, i) => best.mask >> i & 1), skipped = list.filter((_, i) => !(best.mask >> i & 1));
    return { chosen, skipped, value: Math.max(0, best.value), hours: best.hours, uncoveredValue: skipped.reduce((sum, goal) => sum + goal.value, 0) };
}

// 5.2 Goals state the instruments they need; the kit has a mass limit; flag what cannot be done.
export function checkInstruments(goals, kit, massLimitKg)
{
    const mass = kit.reduce((sum, item) => sum + item.massKg, 0);
    const owned = new Set(kit.map(item => item.name));
    const issues = [];

    if (mass > massLimitKg) issues.push(`The kit weighs ${mass.toFixed(1)} kg, over the ${massLimitKg} kg limit.`);

    for (const goal of goals)
    {
        const missing = goal.needs.filter(name => !owned.has(name));

        if (missing.length) issues.push(`"${goal.name}" needs ${missing.join(", ")}, which is not in the kit.`);
    }

    return { mass, issues, doable: goals.filter(goal => goal.needs.every(name => owned.has(name))).map(goal => goal.name), hours: goals.reduce((sum, goal) => sum + goal.hours, 0) };
}

// 5.3 Visit as many different geological units as possible within a distance budget (greedy, nearest new unit first).
export function diverseRoute(start, sites, budgetMeters)
{
    const visited = [], seen = new Set();
    let here = start, used = 0;
    const remaining = sites.slice();

    for (;;)
    {
        const options = remaining.filter(site => !seen.has(site.unit) && used + dist(here, site) <= budgetMeters).sort((a, b) => dist(here, a) - dist(here, b));

        if (!options.length) break;

        const next = options[0];
        used += dist(here, next);
        seen.add(next.unit);
        visited.push(next);
        here = next;
        remaining.splice(remaining.indexOf(next), 1);
    }

    return { visited, meters: used, units: [...seen], missed: [...new Set(sites.map(site => site.unit))].filter(unit => !seen.has(unit)) };
}

// 5.4 No route? Re-run with one constraint relaxed at a time and name the one that matters.
export function explainNoRoute(plan, options)
{
    const first = plan(options);

    if (first.ok) return { ok: true, result: first, blockers: [] };

    const trials = [
        ["slope limit", { ...options, maxSlopePercent: (options.maxSlopePercent ?? 18) * 1.5 }],
        ["exclusion zones", { ...options, exclusionZones: [] }],
        ["slope limit and exclusion zones", { ...options, maxSlopePercent: (options.maxSlopePercent ?? 18) * 1.5, exclusionZones: [] }]
    ];
    const blockers = trials.filter(([, changed]) => plan(changed).ok).map(([name]) => name);
    return { ok: false, reason: first.reason, blockers };
}

// 5.5 Backup plan: the first rule whose condition holds wins.
export function chooseBackup(rules, state)
{
    for (const rule of rules)
    {
        if (rule.when(state)) return rule;
    }

    return null;
}

// 5.7 Does the preferred route stay the same when the terrain numbers are uncertain? Monte Carlo with a seeded generator.
export function routeRobustness(rows, lambda, uncertaintyPercent, runs = 2000, seed = 7)
{
    const random = seededRandom(seed), wins = new Map(rows.map(row => [row.name, 0]));

    for (let i = 0; i < runs; i++)
    {
        const noisy = rows.map(row => ({ ...row, verticalMeters: row.verticalMeters * (1 + (random() * 2 - 1) * uncertaintyPercent / 100), distanceMeters: row.distanceMeters * (1 + (random() * 2 - 1) * uncertaintyPercent / 400) }));
        const winner = rankByCost(noisy, lambda)[0].name;
        wins.set(winner, wins.get(winner) + 1);
    }

    const shares = rows.map(row => ({ name: row.name, share: wins.get(row.name) / runs })).sort((a, b) => b.share - a.share);
    return { shares, stable: shares[0].share >= 0.9, preferred: rankByCost(rows, lambda)[0].name };
}

// 5.8 Which one number, if it were wrong by the uncertainty, would change the choice?
export function mostUsefulObservation(rows, lambda, uncertaintyPercent)
{
    const baseline = rankByCost(rows, lambda)[0].name, k = uncertaintyPercent / 100, found = [];

    for (const row of rows)
    {
        for (const field of ["verticalMeters", "distanceMeters"])
        {
            for (const sign of [-1, 1])
            {
                const changed = rows.map(other => other === row ? { ...other, [field]: other[field] * (1 + sign * k) } : other);
                const winner = rankByCost(changed, lambda)[0].name;

                if (winner !== baseline) found.push({ route: row.name, field: field === "verticalMeters" ? "climb and descent" : "distance", change: sign * uncertaintyPercent, newWinner: winner });
            }
        }
    }

    return { baseline, flips: found, worth: found.length ? found[0] : null };
}

// 5.9 Position uncertainty (1 sigma, metres) while walking without GPS: grows with distance, shrinks at a landmark.
export function deadReckoning(path, driftPercent, landmarkSigmaMeters, landmarkIndexes = [])
{
    let sigma = 0, travelled = 0;
    const series = [{ index: 0, distance: 0, sigma: 0 }];

    for (let i = 1; i < path.length; i++)
    {
        const leg = dist(path[i - 1], path[i]);
        travelled += leg;
        sigma = Math.hypot(sigma, leg * driftPercent / 100);

        if (landmarkIndexes.includes(i)) sigma = Math.min(sigma, landmarkSigmaMeters);

        series.push({ index: i, distance: travelled, sigma });
    }

    return series;
}

// 5.10 Offset between an image and a height model from matched control points, with the leftover error.
export function alignment(pairs)
{
    const n = pairs.length;
    const dx = pairs.reduce((sum, pair) => sum + (pair.dem.x - pair.image.x), 0) / n, dy = pairs.reduce((sum, pair) => sum + (pair.dem.y - pair.image.y), 0) / n;
    const residuals = pairs.map(pair => Math.hypot(pair.dem.x - pair.image.x - dx, pair.dem.y - pair.image.y - dy));
    return { shiftX: dx, shiftY: dy, rms: Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / n), worst: Math.max(...residuals) };
}

// 5.11 Smallest turning radius on a route: the circle through three consecutive points.
export function turningRadii(path)
{
    const result = [];

    for (let i = 1; i < path.length - 1; i++)
    {
        const a = dist(path[i - 1], path[i]), b = dist(path[i], path[i + 1]), c = dist(path[i - 1], path[i + 1]);
        const area2 = Math.abs((path[i].x - path[i - 1].x) * (path[i + 1].y - path[i - 1].y) - (path[i + 1].x - path[i - 1].x) * (path[i].y - path[i - 1].y));
        const radius = area2 < 1e-9 ? Infinity : a * b * c / (2 * area2);
        const reverse = (path[i].x - path[i - 1].x) * (path[i + 1].x - path[i].x) + (path[i].y - path[i - 1].y) * (path[i + 1].y - path[i].y) < 0;
        result.push({ index: i, radius, reverse });
    }

    return result;
}

export function checkTurning(path, minRadiusMeters)
{
    const tight = turningRadii(path).filter(turn => turn.radius < minRadiusMeters);
    return { tight, ok: tight.length === 0, smallest: Math.min(Infinity, ...turningRadii(path).map(turn => turn.radius)) };
}

// 5.12 Does a vehicle of this width (plus margin) clear every zone along the route?
export function footprintClearance(path, zones, widthMeters, marginMeters)
{
    const half = widthMeters / 2 + marginMeters, problems = [];

    for (const zone of zones)
    {
        let nearest = Infinity;

        for (let i = 1; i < path.length; i++)
        {
            const a = path[i - 1], b = path[i], l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
            const t = l2 ? Math.max(0, Math.min(1, ((zone.x - a.x) * (b.x - a.x) + (zone.y - a.y) * (b.y - a.y)) / l2)) : 0;
            nearest = Math.min(nearest, Math.hypot(zone.x - (a.x + t * (b.x - a.x)), zone.y - (a.y + t * (b.y - a.y))));
        }

        const gap = nearest - zone.radius;

        if (gap < half) problems.push({ name: zone.name, gap, need: half });
    }

    return { ok: problems.length === 0, problems, half };
}

// 5.13 Side slope at which a vehicle starts to tip: atan((track / 2) / centre-of-gravity height), with a safety factor.
export function lateralStability(trackMeters, cgHeightMeters, crossSlopeDegrees, safetyFactor = 2)
{
    const tipDegrees = Math.atan(trackMeters / 2 / cgHeightMeters) / RAD, allowed = tipDegrees / safetyFactor;
    return { tipDegrees, allowed, ok: crossSlopeDegrees <= allowed, margin: allowed - crossSlopeDegrees };
}

// 5.14 Wheel slip: a simple illustrative law, slip = base + gain * slope, capped. Real soil needs real tests.
export function wheelSlip(commandedMeters, slopeDegrees, soil = "firm")
{
    const law = { firm: [0.03, 0.012], sand: [0.1, 0.03], loose: [0.18, 0.045] }[soil] || [0.03, 0.012];
    const slip = Math.min(0.9, law[0] + law[1] * Math.max(0, slopeDegrees));
    return { slip, realMeters: commandedMeters * (1 - slip), lostMeters: commandedMeters * slip };
}

// 5.15 Two rovers on their own paths at constant speed: when do they come closer than the safe gap?
export function convoyConflicts(pathA, speedA, pathB, speedB, gapMeters, stepSeconds = 5)
{
    const at = (path, speed, t) =>
    {
        let left = speed * t;

        for (let i = 1; i < path.length; i++)
        {
            const leg = dist(path[i - 1], path[i]);

            if (left <= leg) { const f = leg ? left / leg : 0; return { x: path[i - 1].x + f * (path[i].x - path[i - 1].x), y: path[i - 1].y + f * (path[i].y - path[i - 1].y) }; }

            left -= leg;
        }

        return path.at(-1);
    };

    const end = Math.max(pathLength(pathA) / speedA, pathLength(pathB) / speedB), conflicts = [];

    for (let t = 0; t <= end; t += stepSeconds)
    {
        const gap = dist(at(pathA, speedA, t), at(pathB, speedB, t));

        if (gap < gapMeters) conflicts.push({ seconds: t, gap });
    }

    return { conflicts, first: conflicts[0] || null, closest: conflicts.length ? Math.min(...conflicts.map(c => c.gap)) : null };
}

// 5.16 Two teams walk toward each other along a straight line; team B leaves later by a delay (seconds).
export function meetingPoint(distanceMeters, speedA, speedB, delayBSeconds = 0)
{
    const head = Math.min(distanceMeters, speedA * delayBSeconds), t = delayBSeconds + (distanceMeters - head) / (speedA + speedB);
    return { seconds: t, fromA: speedA * t, fromB: speedB * (t - delayBSeconds) };
}

// 5.17 Radio relay from line of sight over a terrain profile [{ distance, elevation }]. A relay must see both ends.
export function lineOfSight(profile, fromIndex, toIndex, antennaMeters)
{
    const a = profile[fromIndex], b = profile[toIndex], za = a.elevation + antennaMeters, zb = b.elevation + antennaMeters;

    for (let i = Math.min(fromIndex, toIndex) + 1; i < Math.max(fromIndex, toIndex); i++)
    {
        const t = (profile[i].distance - a.distance) / (b.distance - a.distance);

        if (profile[i].elevation > za + t * (zb - za)) return false;
    }

    return true;
}

export function relaySites(profile, antennaMeters, maxHops = 1)
{
    const last = profile.length - 1;

    if (lineOfSight(profile, 0, last, antennaMeters)) return { direct: true, relays: [] };

    const relays = [];

    for (let i = 1; i < last; i++)
    {
        if (lineOfSight(profile, 0, i, antennaMeters) && lineOfSight(profile, i, last, antennaMeters)) relays.push({ index: i, distance: profile[i].distance, elevation: profile[i].elevation });
    }

    return { direct: false, relays: relays.sort((a, b) => b.elevation - a.elevation).slice(0, 5), maxHops };
}

// 5.18 Stops with time windows: visit in the given order, waiting if early, failing if late. Times in hours.
export function scheduleWindows(stops, startHour, speedKmh)
{
    let clock = startHour;
    const log = [];

    for (let i = 0; i < stops.length; i++)
    {
        const travel = i ? stops[i].legMeters / 1000 / speedKmh : 0;
        clock += travel;
        const wait = Math.max(0, stops[i].opens - clock);
        clock += wait;
        const late = clock > stops[i].closes;
        log.push({ name: stops[i].name, arrive: clock - wait, wait, leave: clock + stops[i].stayHours, late });
        clock += stops[i].stayHours;
    }

    return { log, feasible: log.every(entry => !entry.late), end: clock };
}

// 5.19 Battery over time with a day/night solar charge and a cold derating. Hourly steps.
export function batteryOverTime({ capacityWh, loadWatts, solarWatts, dayHours, cycleHours = 24.66, hours, coldBelowC = -20, coldDerate = 0.7, nightTempC = -70, dayTempC = -10 })
{
    let charge = capacityWh;
    const series = [];

    for (let h = 0; h < hours; h++)
    {
        const day = h % cycleHours < dayHours, temp = day ? dayTempC : nightTempC;
        const usable = capacityWh * (temp < coldBelowC ? coldDerate : 1);
        charge = Math.max(0, Math.min(usable, charge - loadWatts + (day ? solarWatts : 0)));
        series.push({ hour: h + 1, charge, day, temp });
    }

    return { series, emptyAt: (series.find(entry => entry.charge <= 0) || {}).hour || null, end: series.at(-1)?.charge ?? capacityWh };
}

// 5.20 Equipment temperature: first-order cooling towards the outside, with a heater. Returns the pauses needed to stay warm.
export function thermalState({ startC, outsideC, heaterWatts, heatCapacityJPerC, lossWPerC, minutes, minOperatingC })
{
    let temp = startC;
    const series = [], pauses = [];

    for (let m = 1; m <= minutes; m++)
    {
        temp += (heaterWatts - lossWPerC * (temp - outsideC)) * 60 / heatCapacityJPerC;
        series.push({ minute: m, temp });

        if (temp < minOperatingC) pauses.push(m);
    }

    return { series, end: temp, coldMinutes: pauses.length, settles: outsideC + heaterWatts / lossWPerC };
}

// 5.21 Depots: put k depots on the stops so that no stop is far from one (greedy farthest-point, the classic 2-approximation).
export function placeDepots(stops, k)
{
    if (!stops.length) return { depots: [], worst: 0 };

    const depots = [stops[0]];

    while (depots.length < Math.min(k, stops.length))
    {
        let far = null, farD = -1;

        for (const stop of stops)
        {
            const d = Math.min(...depots.map(depot => dist(depot, stop)));

            if (d > farD) { farD = d; far = stop; }
        }

        depots.push(far);
    }

    return { depots, worst: Math.max(...stops.map(stop => Math.min(...depots.map(depot => dist(depot, stop))))) };
}

// 5.22 and 5.23 Samples with id, mass, volume, container and history; rules say which classes must not share a container.
export function checkSamples(samples, forbiddenPairs, containerMassLimitG)
{
    const issues = [], byContainer = new Map();

    for (const sample of samples)
    {
        if (!byContainer.has(sample.container)) byContainer.set(sample.container, []);
        byContainer.get(sample.container).push(sample);
    }

    for (const [container, items] of byContainer)
    {
        const mass = items.reduce((sum, item) => sum + item.massG, 0);

        if (mass > containerMassLimitG) issues.push(`${container} holds ${mass} g, over the ${containerMassLimitG} g limit.`);

        for (let i = 0; i < items.length; i++)
        {
            for (let j = i + 1; j < items.length; j++)
            {
                if (forbiddenPairs.some(([a, b]) => (a === items[i].kind && b === items[j].kind) || (a === items[j].kind && b === items[i].kind))) issues.push(`${items[i].id} (${items[i].kind}) and ${items[j].id} (${items[j].kind}) must not share ${container}.`);
            }
        }
    }

    return { issues, containers: [...byContainer.keys()], ok: issues.length === 0 };
}

// 5.24 Data budget: what fits in the link window now, what is compressed, what waits.
export function dataBudget(items, linkKbps, windowMinutes, compressionRatio = 1)
{
    let room = linkKbps * 1000 / 8 * windowMinutes * 60 / 1e6;
    const sendNow = [], later = [];

    for (const item of items.slice().sort((a, b) => b.value / b.mb - a.value / a.mb))
    {
        const size = item.mb / (item.compress ? compressionRatio : 1);

        if (size <= room) { room -= size; sendNow.push({ ...item, sentMb: size }); }
        else later.push(item);
    }

    return { sendNow, later, leftMb: room, capacityMb: linkKbps * 1000 / 8 * windowMinutes * 60 / 1e6 };
}

// 5.25 After an uncertain landing: from an ellipse of possible positions, can the supplies reach the base from the far edge?
export function recoveryReach(ellipseKmA, ellipseKmB, baseOffsetKm, speedKmh, oxygenHours)
{
    const worstKm = baseOffsetKm + Math.max(ellipseKmA, ellipseKmB), hours = worstKm / speedKmh;
    return { worstKm, hours, ok: hours <= oxygenHours, extraKm: Math.max(0, worstKm - oxygenHours * speedKmh) };
}

// 5.26 Change between two observations of the same area: grids of grey values 0-255 of equal size.
export function detectChange(a, b, threshold)
{
    let changed = 0;
    const cells = [];

    for (let i = 0; i < a.length; i++)
    {
        const hit = Math.abs(a[i] - b[i]) > threshold;
        cells.push(hit);

        if (hit) changed++;
    }

    return { changed, share: a.length ? changed / a.length : 0, cells };
}

// 5.27 Local 3D points (metres east, north, up from an anchor) placed on the planet and compared with a height model.
export function georeferenceLocal(points, anchor, headingDegrees = 0)
{
    const c = Math.cos(headingDegrees * RAD), s = Math.sin(headingDegrees * RAD);
    return points.map(point =>
    {
        const east = point.x * c + point.y * s, north = -point.x * s + point.y * c;
        return { lat: anchor.lat + north / MARS_RADIUS_METERS / RAD, lon: anchor.lon + east / (MARS_RADIUS_METERS * Math.cos(anchor.lat * RAD)) / RAD, height: anchor.height + point.z };
    });
}

export function heightDifference(placed, heightAt)
{
    const diffs = placed.map(point => point.height - heightAt(point.lat, point.lon)).filter(Number.isFinite);
    const mean = diffs.reduce((sum, d) => sum + d, 0) / (diffs.length || 1);
    return { count: diffs.length, mean, rms: Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0) / (diffs.length || 1)) };
}

// 5.28 Route as plain local-metre waypoints for a small educational rover (CSV). No connection to hardware is made.
export function roverExport(path)
{
    return "index,x_m,y_m,heading_deg\n" + path.map((point, i) =>
    {
        const next = path[i + 1] || point, prev = path[i - 1] || point, ref = i < path.length - 1 ? next : prev;
        const heading = ((Math.atan2(ref.x - point.x, ref.y - point.y) / RAD) + 360) % 360;
        return `${i},${point.x.toFixed(2)},${point.y.toFixed(2)},${heading.toFixed(1)}`;
    }).join("\n");
}
