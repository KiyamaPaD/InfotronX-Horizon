# Mars Atlas — Mission Planning Engine validation

This report records independent mathematical checks of the route planning code, not rover-certified navigation.

## Geodesic and slope model

The model uses Mars radius R = 3,396,190 meters and planetocentric, east-positive coordinates. The route distance is calculated using the haversine formula:

- a = sin²(Δlatitude/2) + cos(latitude1)cos(latitude2)sin²(Δlongitude/2)
- d = 2R asin(sqrt(a))

Coordinates are converted to radians. Elevation data comes from the numerical USGS CTX DEM clip, not the color of any basemap pixel.

The signed grade on a traversed DEM edge is 100×heightDifference/d percent. Eight-neighbor motion prevents diagonal corner-cutting around missing or user-excluded cells. A* and D* Lite use exactly the same illustrative edge weight:

  cost = d × (1 + penalty × |gradePercent|/100) = d + penalty × |heightDifference|

The weight therefore penalizes BOTH uphill and downhill height changes. It is a configurable mathematical preference, NOT a physically calibrated rover-energy, EVA oxygen, terrain safety or regolith model.

## Independent test methods

File: tests/route-reference.test.mjs. Unlike A* and D* Lite, the reference optimizer uses a zero-heuristic Dijkstra algorithm with a direct array scan. Neighbors, diagonal legality, exclusions, slopes and weights are independently reconstructed from DEM indices. Returned routes are independently certified edge-by-edge.

- A*: 20 deterministic synthetic DEM seeds multiplied by 3 penalty factors = **60** shortest-path comparisons.
- D* Lite: 12 DEM seeds multiplied by 3 exclusion phases = **36** incremental update comparisons.
- Pareto: 9 complete, tiny 3×3 DEM scenarios independently enumerate EVERY simple path, then calculate the exact nondominated frontier (distance and cumulative uphill ascent).
- Additional checks cover Mars-radius geometry and invalid route input, in tests/mission-integrity.test.mjs.
- Output selection edge case: Pareto maxResults=1 must return one valid route; invalid nonpositive/fractional/nonfinite counts must be rejected.

The production Pareto search is budget-limited per grid cell and by total expansions. Its truncated flag documents incomplete coverage. Matching exhaustive tiny grids does NOT prove completeness on large terrains.

## Reproducibility

Execute npm test. GitHub Actions also executes the Node test suite on main. These tests are deterministic, require no NASA network or Supabase access and do not modify the browser UI.

## Evidence and limits

The built-in numerical CTX DEM covers only a small area near Jezero. Image clarity on the HiRISE map must not be equated to numeric elevation coverage. DEM resolution and vertical datum limit scientific interpretations. The default slope threshold and penalty weights are illustrative and not safety certificates.

Future work: use reference optimizers against the bundled real DEM clip, benchmark graph cost and memory use, and provide scientific provenance and uncertainty directly in mission briefing outputs.

Source file: src/terrain.js; incremental planner: src/dstar-lite.js; Pareto: src/pareto-routes.js.

## Real-DEM verification

The shipped USGS-derived Jezero numerical clip is independently checked for data integrity, routing, planning with scenario exclusions, Pareto results and out-of-coverage behavior. See [JEZERO_NUMERIC_AUDIT.md](JEZERO_NUMERIC_AUDIT.md) for the observed numbers, checksums, performance notes and limitations.
