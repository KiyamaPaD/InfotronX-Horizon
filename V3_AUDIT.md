# Mars Atlas — V3 development review (14 November 2026)

## Added in V3

2. **Waypoint reordering.** Up/down controls change the order of existing waypoints. The route distance and geometry recalculate immediately.
3. **Observation → waypoint.** A user-authored, georeferenced observation can be appended directly to the active route, preserving the original note. Such notes remain unverified.
4. **Active-route delta.** Distance comparison explicitly displays percentage differences from the currently selected route. Distance alone does not determine terrain safety.
5. **Mission Brief checkpoint log.** Export includes a compact list of saved snapshots.

## Automated verification

- Node test suite: 29/29 passing (including six new regression tests).
- `node --check` succeeded for every `src/*.js` module.
- No duplicate HTML element identifiers found in the interface template.
- CSS parser reports zero syntax errors.
- Original V2 source has been preserved in the separately downloadable archive.

## Important limitations

- Automated Chromium navigation was blocked by the runtime's administrator policy, both for `http://localhost` and `file://`. An attempted isolated browser pass also did not complete. **Therefore V3 is not marked browser-verified.**
- NASA Mars Trek WMTS tile responses have not been confirmed from a public deployment. The fallback explains imagery unavailability; it is not a substitute for NASA data.
- Saved checkpoints are local and included in mission JSON exports. Adding multiple checkpoints can make URL-based sharing too long; export JSON when the app declines a share link.
- No calibrated elevation, real slope, soil strength, energy consumption or astronaut EVA safety score is calculated. Geometric detours are illustrative only.

## Suggested manual review sequence

1. Open the deployed site on desktop and mobile; check the map and each NASA tile layer.
2. Create a mission, draw three waypoints, adjust coordinates and reorder a waypoint.
3. Save a checkpoint, duplicate the route, modify it, and compare distance percentages.
4. Restore the checkpoint; confirm old routes reappear and later edits are replaced.
5. Add an observation in Observe mode, then click **Use as waypoint** in Field Notes.
6. Export a JSON backup, refresh, import the backup and verify routes, notes and checkpoints.
7. Try Share mission. For a long mission, export JSON instead.
8. Generate Mission Brief and GeoJSON; inspect data attribution and warning language.
