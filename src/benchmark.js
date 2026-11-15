// A repeatable mission benchmark and the cost trade-off behind it.
// The three routes join the same start and end inside the bundled USGS CTX height model near the Jezero delta. They were produced
// by the app's own grid planner with three different relief penalties and are stored here as fixed coordinates, so anyone can load
// them and get the same numbers. tests/benchmark.test.mjs re-plans them and checks that nothing has drifted.

export const BENCHMARK = Object.freeze({
    title: "Jezero delta benchmark",
    description: "One start, one end, three routes planned on the bundled 20 m CTX height model. Compare distance, climb and descent, and slope.",
    method: "Grid A* on the 20 m model, 8 neighbours, slope limit 18 %, cost = distance + penalty × (climb + descent). Penalties 0, 6 and 24.",
    routes: Object.freeze([
        { id: "bench-direct", name: "Direct (penalty 0)", color: "#ec9976", penalty: 0, expected: { distanceMeters: 2187.26, ascentMeters: 18.07, descentMeters: 63.89, maxGradePercent: 11.65 },
          points: [[18.466632, 77.447078], [18.466632, 77.449117], [18.441368, 77.474602]] },
        { id: "bench-balanced", name: "Balanced (penalty 6)", color: "#75d1c8", penalty: 6, expected: { distanceMeters: 2187.26, ascentMeters: 17.25, descentMeters: 63.07, maxGradePercent: 12.09 },
          points: [[18.466632, 77.447078], [18.463263, 77.450476], [18.463263, 77.451495], [18.458884, 77.455913], [18.458884, 77.456252], [18.453832, 77.46135], [18.453832, 77.461689], [18.453495, 77.462029], [18.453495, 77.462369], [18.441368, 77.474602]] },
        { id: "bench-gentle", name: "Gentle (penalty 24)", color: "#e2c77d", penalty: 24, expected: { distanceMeters: 2427.48, ascentMeters: 5.96, descentMeters: 51.78, maxGradePercent: 10.52 },
          points: [[18.466632, 77.447078], [18.465958, 77.447757], [18.464611, 77.447757], [18.461916, 77.450476], [18.459221, 77.450476], [18.455516, 77.454214], [18.452821, 77.454214], [18.4508, 77.456252], [18.450463, 77.456252], [18.448779, 77.457951], [18.448779, 77.45965], [18.447095, 77.46135], [18.447095, 77.464068], [18.445747, 77.465427], [18.445747, 77.470184], [18.441368, 77.474602]] }
    ])
});

// A mission ready to import: three routes, the first one active, waypoints named Start and End.
export function benchmarkMissionData()
{
    return {
        title: BENCHMARK.title,
        description: BENCHMARK.description,
        routes: BENCHMARK.routes.map(route => ({
            id: route.id,
            name: route.name,
            color: route.color,
            points: route.points.map(([lat, lon], index, all) => ({ id: `${route.id}-${index}`, lat, lon, ...(index === 0 ? { name: "Start", category: "navigation", icon: "star" } : index === all.length - 1 ? { name: "End", category: "navigation", icon: "star" } : {}) }))
        })),
        activeRouteId: BENCHMARK.routes[0].id,
        observations: []
    };
}

// rows: { name, distanceMeters, verticalMeters } where verticalMeters = climb + descent.
// Cost of a route at penalty lambda: C = D + lambda × V. Returns the rows sorted from cheapest to dearest.
export function rankByCost(rows, lambda)
{
    return rows
        .map(row => ({ ...row, cost: row.distanceMeters + lambda * row.verticalMeters }))
        .sort((a, b) => a.cost - b.cost || a.distanceMeters - b.distanceMeters);
}

// The penalty at which the cheaper route of a pair changes. Below it the shorter route wins, above it the one with less height change.
// Returns null when one route is better or equal in both distance and height change (nothing to trade).
export function crossoverLambda(first, second)
{
    const [shorter, other] = first.distanceMeters <= second.distanceMeters ? [first, second] : [second, first];
    const extraDistance = other.distanceMeters - shorter.distanceMeters;
    const savedVertical = shorter.verticalMeters - other.verticalMeters;

    if (extraDistance <= 0 || savedVertical <= 0) return null;

    return { lambda: extraDistance / savedVertical, shorter: shorter.name, other: other.name, extraDistance, savedVertical };
}

export function crossovers(rows)
{
    const list = [];

    for (let i = 0; i < rows.length; i++)
    {
        for (let j = i + 1; j < rows.length; j++)
        {
            const point = crossoverLambda(rows[i], rows[j]);
            if (point) list.push(point);
        }
    }

    return list.sort((a, b) => a.lambda - b.lambda);
}
