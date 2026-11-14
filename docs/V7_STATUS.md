# V7 — Advanced Terrain Intelligence, review candidate

Branch: `feature/terrain-intelligence-v7` (must not merge automatically into `main`). Based on V6.1 real-DEM preview.

## Features included
1. A complete 3×3 least-squares DEM slope and RMS roughness raster inspector, with aspect/downhill bearing from the local gradient.
2. A DEM terrain line-of-sight between first and final manual waypoints; bilinear interpolation, endpoint heights, Mars curvature, explicit unknown status on missing data. Small positive clearance (<2m) is flagged as inconclusive via a conservative UI threshold, **not** a measured vertical accuracy margin.
3. Time-constrained Dijkstra reachability (isochrone-like), eight neighbors, corner-cut prevention, slope limit, exclusion masks and four arrival-time bands. Assumes constant speed plus a modeled terrain slowdown; not an EVA safety model.

## Architecture
- Modular screen: `src/terrain-intelligence-ui.js`, mounted within existing Science panel. Analysis remains read-only and never changes manually drawn routes.
- Drawn raster previews are programmatic canvas pixels; dark/unknown includes no data/unsupported terrain and cannot be interpreted as traversable.
- Computed outputs expire when mission, waypoints, DEM, scenario exclusions or resource assumptions change.
- Minimal integration with `src/science-workbench.js`, with scenario report appended to Mission Brief only while inputs match.

## What V7 does *not* do
- Full viewshed or radio/Fresnel link prediction, validated gait/traction, rover route safety, rock size estimates, actual oxygen telemetry, stereo CV, real-time co-editing, SPICE illumination or a verified Mars globe.
- In no case should area reachable with the model be called a truly safe EVA range, and no cells outside the DEM clip are analyzed.

## Manual review
- Open V7 preview (separate Vercel URL in release note); load `Open real-data Jezero demo`, click official DEM.
- Open Science → `Terrain Intelligence`. Choose slope / roughness, press `Analyze surface`. Inspect numeric legend and dark edge NoData.
- Press `Analyze line of sight` with 1.8m sensors, change heights and repeat. Compare with known ridge on raster if possible.
- Choose 15 minute outward budget, press `Compute reachable cells`. Note the legend and model disclaimer. Change exclusion area in DEM Route Lab and rerun to compare reachable footprint.
- Confirm all manual route editing, imports, checkpoints and exports still work. Test on desktop and mobile and inspect JS console.
