export const DEFAULT_EVA_ASSUMPTIONS = Object.freeze({
    speedKmh: 2.4,
    observationMinutes: 15,
    oxygenKgPerHour: 0.12,
    oxygenAvailableKg: 1.2,
    batteryWatts: 280,
    batteryAvailableWh: 2200,
    reservePercent: 25,
    maxDurationHours: 8,
    retraceReturn: true
});

const RANGES = {
    speedKmh: [0.1, 12],
    observationMinutes: [0, 720],
    oxygenKgPerHour: [0.001, 3],
    oxygenAvailableKg: [0.001, 50],
    batteryWatts: [1, 5000],
    batteryAvailableWh: [1, 30000],
    reservePercent: [0, 90],
    maxDurationHours: [0.1, 48]
};

export function validateEvaAssumptions(input)
{
    const assumptions = { ...DEFAULT_EVA_ASSUMPTIONS, ...input };

    for (const [key, [min, max]] of Object.entries(RANGES))
    {
        if (!Number.isFinite(assumptions[key]) || assumptions[key] < min || assumptions[key] > max)
        {
            throw new Error(`Invalid scenario assumption: ${key} must be ${min}–${max}.`);
        }
    }

    if (typeof assumptions.retraceReturn !== "boolean")
    {
        throw new Error("Return path assumption must be true or false.");
    }

    return assumptions;
}

export function estimateMarswalk(distanceMeters, input = {})
{
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0)
    {
        throw new Error("Route length must be a nonnegative number of meters.");
    }

    const assumptions = validateEvaAssumptions(input);
    const routeCount = assumptions.retraceReturn ? 2 : 1;
    const travelDistanceMeters = distanceMeters * routeCount;
    const travelHours = travelDistanceMeters / 1000 / assumptions.speedKmh;
    const stopHours = assumptions.observationMinutes / 60;
    const durationHours = travelHours + stopHours;
    const oxygenKg = durationHours * assumptions.oxygenKgPerHour;
    const batteryWh = durationHours * assumptions.batteryWatts;
    const usableOxygenKg = assumptions.oxygenAvailableKg * (1 - assumptions.reservePercent / 100);
    const usableBatteryWh = assumptions.batteryAvailableWh * (1 - assumptions.reservePercent / 100);
    const usableDurationHours = assumptions.maxDurationHours * (1 - assumptions.reservePercent / 100);

    const warnings = [];

    if (durationHours > usableDurationHours)
    {
        warnings.push("Modeled duration exceeds the reserve-adjusted time budget.");
    }

    if (oxygenKg > usableOxygenKg)
    {
        warnings.push("Modeled oxygen demand exceeds the reserve-adjusted allowance.");
    }

    if (batteryWh > usableBatteryWh)
    {
        warnings.push("Modeled battery demand exceeds the reserve-adjusted allowance.");
    }

    return {
        travelDistanceMeters,
        travelHours,
        stopHours,
        durationHours,
        oxygenKg,
        batteryWh,
        usableOxygenKg,
        usableBatteryWh,
        usableDurationHours,
        remainingOxygenKg: assumptions.oxygenAvailableKg - oxygenKg,
        remainingBatteryWh: assumptions.batteryAvailableWh - batteryWh,
        warnings,
        assumptions,
        isIllustrative: true,
        usedTerrainModel: false
    };
}
