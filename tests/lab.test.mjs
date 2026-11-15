import test from "node:test";
import assert from "node:assert/strict";
import * as lab from "../src/lab.js";

const close = (a, b, t = 1e-6) => assert.ok(Math.abs(a - b) <= t, `${a} is not within ${t} of ${b}`);
const line = (...xs) => xs.map(([x, y]) => ({ x, y }));

test("value plan picks the best set inside the budget", () =>
{
    const plan = lab.planByValue([{ name: "a", value: 5, hours: 3 }, { name: "b", value: 4, hours: 2 }, { name: "c", value: 4, hours: 2 }], 4);
    assert.equal(plan.value, 8);
    assert.deepEqual(plan.skipped.map(goal => goal.name), ["a"]);
});

test("instruments: missing kit and weight are flagged", () =>
{
    const result = lab.checkInstruments([{ name: "drill", needs: ["drill", "camera"], hours: 2 }], [{ name: "drill", massKg: 6 }], 5);
    assert.equal(result.issues.length, 2);
    assert.deepEqual(result.doable, []);
});

test("diverse route visits each unit once inside the budget", () =>
{
    const result = lab.diverseRoute({ x: 0, y: 0 }, [{ x: 10, y: 0, unit: "A" }, { x: 20, y: 0, unit: "A" }, { x: 30, y: 0, unit: "B" }, { x: 5000, y: 0, unit: "C" }], 100);
    assert.deepEqual(result.units, ["A", "B"]);
    assert.deepEqual(result.missed, ["C"]);
});

test("no-route explanation names the constraint that blocks", () =>
{
    const plan = o => o.exclusionZones.length ? { ok: false, reason: "blocked" } : { ok: true };
    const result = lab.explainNoRoute(plan, { exclusionZones: [1] });
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes("exclusion zones"));
});

test("backup plan: first matching rule wins", () =>
{
    const rule = lab.chooseBackup([{ when: s => s.blocked, then: "go to C" }, { when: () => true, then: "continue" }], { blocked: true });
    assert.equal(rule.then, "go to C");
});

test("robustness is stable with no uncertainty and flips are found when close", () =>
{
    const rows = [{ name: "short", distanceMeters: 2000, verticalMeters: 300 }, { name: "gentle", distanceMeters: 2400, verticalMeters: 100 }];
    assert.equal(lab.routeRobustness(rows, 6, 0).shares[0].share, 1);
    const close = [{ name: "x", distanceMeters: 1000, verticalMeters: 100 }, { name: "y", distanceMeters: 1000, verticalMeters: 104 }];
    assert.ok(lab.routeRobustness(close, 6, 30).shares[0].share < 1);
    assert.ok(lab.mostUsefulObservation(close, 6, 10).flips.length > 0);
});

test("dead reckoning grows with distance and drops at a landmark", () =>
{
    const series = lab.deadReckoning(line([0, 0], [100, 0], [200, 0], [300, 0]), 5, 2, [2]);
    close(series[1].sigma, 5);
    assert.equal(series[2].sigma, 2);
    assert.ok(series[3].sigma > 2);
});

test("alignment recovers a known shift with zero leftover", () =>
{
    const result = lab.alignment([{ image: { x: 0, y: 0 }, dem: { x: 3, y: -2 } }, { image: { x: 10, y: 5 }, dem: { x: 13, y: 3 } }]);
    close(result.shiftX, 3); close(result.shiftY, -2); close(result.rms, 0);
});

test("turning radius of three points on a circle", () =>
{
    const r = 50, path = [0, 30, 60].map(deg => ({ x: r * Math.cos(deg * Math.PI / 180), y: r * Math.sin(deg * Math.PI / 180) }));
    close(lab.turningRadii(path)[0].radius, r, 1e-6);
    assert.equal(lab.checkTurning(path, 60).ok, false);
    assert.equal(lab.checkTurning(path, 40).ok, true);
});

test("footprint: a zone too close to the line is reported", () =>
{
    const bad = lab.footprintClearance(line([0, 0], [100, 0]), [{ name: "z", x: 50, y: 6, radius: 5 }], 2, 1);
    assert.equal(bad.ok, false);
    assert.equal(lab.footprintClearance(line([0, 0], [100, 0]), [{ name: "z", x: 50, y: 30, radius: 5 }], 2, 1).ok, true);
});

test("lateral stability: tip angle is atan(half track / cg height)", () =>
{
    const r = lab.lateralStability(1.4, 0.7, 10);
    close(r.tipDegrees, 45, 1e-9);
    close(r.allowed, 22.5, 1e-9);
    assert.equal(r.ok, true);
});

test("wheel slip loses distance and grows with slope", () =>
{
    const flat = lab.wheelSlip(100, 0), steep = lab.wheelSlip(100, 15);
    close(flat.realMeters, 97);
    assert.ok(steep.realMeters < flat.realMeters);
});

test("convoy conflict where paths cross at the same time, none when apart", () =>
{
    const a = line([0, 0], [100, 0]), b = line([50, -50], [50, 50]);
    assert.ok(lab.convoyConflicts(a, 1, b, 1, 5).first);
    assert.equal(lab.convoyConflicts(a, 1, line([0, 500], [100, 500]), 1, 5).first, null);
});

test("meeting point: equal speeds meet in the middle; a delay moves it", () =>
{
    const m = lab.meetingPoint(1000, 1, 1);
    close(m.fromA, 500); close(m.seconds, 500);
    assert.ok(lab.meetingPoint(1000, 1, 1, 200).fromA > 500);
});

test("line of sight is blocked by a ridge and a relay on it sees both ends", () =>
{
    const profile = [0, 100, 200, 300, 400].map((d, i) => ({ distance: d, elevation: [0, 5, 80, 5, 0][i] }));
    assert.equal(lab.lineOfSight(profile, 0, 4, 2), false);
    const sites = lab.relaySites(profile, 2);
    assert.equal(sites.direct, false);
    assert.equal(sites.relays[0].index, 2);
});

test("time windows: waiting and lateness are reported", () =>
{
    const ok = lab.scheduleWindows([{ name: "A", opens: 8, closes: 12, stayHours: 1, legMeters: 0 }, { name: "B", opens: 10, closes: 11, stayHours: 1, legMeters: 2400 }], 8, 2.4);
    assert.equal(ok.feasible, true);
    assert.equal(lab.scheduleWindows([{ name: "A", opens: 8, closes: 12, stayHours: 3, legMeters: 0 }, { name: "B", opens: 10, closes: 11, stayHours: 1, legMeters: 2400 }], 8, 2.4).feasible, false);
});

test("battery: night drains, cold derates the capacity", () =>
{
    const r = lab.batteryOverTime({ capacityWh: 1000, loadWatts: 100, solarWatts: 0, dayHours: 12, hours: 24 });
    assert.ok(r.emptyAt !== null);
    const cold = lab.batteryOverTime({ capacityWh: 1000, loadWatts: 0, solarWatts: 0, dayHours: 0, hours: 2 });
    close(cold.series[0].charge, 700);
});

test("thermal state settles at outside plus heater over loss", () =>
{
    const r = lab.thermalState({ startC: 20, outsideC: -60, heaterWatts: 40, heatCapacityJPerC: 3000, lossWPerC: 1, minutes: 600, minOperatingC: -10 });
    close(r.settles, -20); close(r.end, -20, 0.01);
});

test("depots: worst distance falls as depots are added", () =>
{
    const stops = line([0, 0], [100, 0], [200, 0], [300, 0]);
    assert.ok(lab.placeDepots(stops, 2).worst < lab.placeDepots(stops, 1).worst);
});

test("samples: mass limit and forbidden pairs", () =>
{
    const r = lab.checkSamples([{ id: "S1", kind: "organic", massG: 50, container: "T1" }, { id: "S2", kind: "salt", massG: 80, container: "T1" }], [["organic", "salt"]], 100);
    assert.equal(r.issues.length, 2);
});

test("data budget sends the most valuable per megabyte first", () =>
{
    const r = lab.dataBudget([{ name: "a", mb: 10, value: 1 }, { name: "b", mb: 2, value: 5 }], 64, 10, 1);
    assert.equal(r.sendNow[0].name, "b");
    assert.ok(r.capacityMb > 0);
});

test("recovery reach and change detection", () =>
{
    assert.equal(lab.recoveryReach(5, 3, 2, 2.4, 3).ok, true);
    assert.equal(lab.recoveryReach(10, 3, 2, 2.4, 3).ok, false);
    const c = lab.detectChange([0, 0, 100, 200], [0, 50, 100, 10], 20);
    assert.equal(c.changed, 2);
    close(c.share, 0.5);
});

test("local points are placed on the planet and compared with heights", () =>
{
    const placed = lab.georeferenceLocal([{ x: 0, y: 0, z: 2 }, { x: 100, y: 0, z: 2 }], { lat: 18.44, lon: 77.45, height: -2500 }, 0);
    assert.ok(placed[1].lon > placed[0].lon);
    const d = lab.heightDifference(placed, () => -2500);
    close(d.mean, 2);
    assert.match(lab.roverExport(line([0, 0], [0, 10])), /^index,x_m,y_m,heading_deg\n0,0\.00,0\.00,0\.0/);
});
