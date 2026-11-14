# V5 terrain and telemetry development status

**Branch candidate:** `feature/terrain-resource-model` (based on V4). Manual-first is unchanged.

## Implemented
- Pure deterministic 8-neighbor A* over imported numeric DEM grids with NoData avoidance, a tunable slope threshold and distance-plus-slope cost.
- Path composed through each manual waypoint, directional grade, ascent and descent; optional altitude profile that does not bridge NoData.
- Marswalk resource scenario calculator with adjustable speed, stop duration, oxygen rate and capacity, battery watts/capacity, time limit, and reserve percentage. Optional retracing on return.
- Scenario settings saved with mission and checkpoints. Routing outputs are editable and labeled user-imported / unverified; manual edits clear stale terrain metadata.
- UI integration under V4 Science sidebar; valid numeric DEM files can be imported from a local browser.

## Not operational / unverified
- Original Jezero USGS/NASA raster has **not** been downloaded and converted in this environment; no data-derived Jezero terrain result is asserted.
- No terrain-safety certification, oxygen life-support physics, thermal loads, rover mechanics or NASA astronaut operational spec.
- Public browser interaction and map tiles need review. Automatic deployments from GitHub remain disconnected.
- No backend or cloud authentication is needed for this enhancement.

## Next steps
1. Download and inspect the official Jezero CTX DEM, validate CRS, vertical datum and spatial coverage.
2. Generate a small numeric clip with `scripts/prepare_dem.py`; visually compare samples with an authoritative elevation product.
3. Import the clip into the preview and test an A* route through Jezero points with a screenshot and recorded assumptions.
4. Review time/O2/battery default assumptions as *illustrative only* or replace with defensible sourced values for the final NASA story.
5. Merge through pull request after real-device review; retain production fallback.
