# V6 — What-if mission scenarios (draft, 2026-11-14)

Branch: `feature/scenario-intelligence`, based on the V5 `feature/terrain-resource-model` branch. This change is intended for a **preview** and has not been promoted to production.

## What works

1. **What-if observation exclusions.** In Science → DEM Route Lab, an operator can choose an existing field note and a radius (10–1000 m). The overlay draws an elliptical approximation in the current equirectangular map view; A* masks DEM grid centers within that radius, checks both endpoints and prevents diagonal corner cutting. It models a *hypothetical user decision*, not a measured NASA hazard. The selected exclusion remains optional and cannot block manual route creation.
2. **Three terrain planning strategies.** Distance-weighted (`slopePenalty=0`), balanced (`6`), and slope-conscious (`24`) paths are computed on the same numeric imported DEM and configurable maximum modeled grade. Multiple strategies can return the exact same path; this is correct (e.g., flat terrain). They are **not a Pareto frontier**, certified traversability study, or actual astronaut operating envelope. All waypoints remain route anchors snapped to nearest DEM cells.
3. **Stress Lab.** Reproducible, seeded 500-trial numerical envelope varies walking speed, oxygen-use rate and electrical power **independently and uniformly** by a user-selected ±10/20/35/50%. It reports illustrative 10th/90th percentiles and fraction of synthetic trials exceeding reserve-adjusted allowances. This is **sensitivity**, not calibrated accident likelihood or NASA physiological telemetry.
4. **Decision provenance.** Created A* routes store selected exclusion position, user-note title/radius, slope penalty and gradient threshold. Mission JSON, GeoJSON, checkpoints and Mission Brief preserve the scenario label on import/restore. Manual editing clears terrain-derived provenance as before.

## Evidence

- 62/62 Node unit and structural tests pass, including nine new mathematical scenario tests and two metadata tests.
- Desktop (1440 × 900) and mobile (390 × 844) Chromium tests pass: scenario sensitivity → synthetic numeric DEM import → choose note exclusion → 3 A* paths → create editable route, no uncaught page errors.
- Tests use a **synthetic, fabricated DEM fixture** explicitly marked `NOT NASA`; no real Jezero elevation, route safety or images have been verified in V6.

## Still blocked

- NASA/USGS Jezero DEM source GeoTIFF download and scientific validation: see `docs/DEM_IMPORT.md`.
- NASA Mars Trek public imagery/WMTS and external deployed browser smoke test.
- Automatic GitHub ↔ Vercel integration and controlled production release.

## Review flow

Open the separate V6 Vercel preview, use Science → Mission Stress Lab and DEM Route Lab, and import a **real and validated** numeric DEM only after checking CRS, datum, coverage and provenance. A demo with synthetic heights is a software test, not a scientific demonstration.
