# Mars Atlas V6.1 — review runbook

## Official source / scientific honesty

**Real raster:** USGS Astrogeology / NASA Mars Reconnaissance Orbiter CTX, Mars 2020 Terrain Relative Navigation CTX DTM Mosaic (2020), DOI 10.5066/P906QQT8. The original 1596 × 1512 GeoTIFF is numeric 32-bit elevation data at 20 meters per pixel. In the V6.1 preview we bundle one 104 × 96 grid clip around Jezero. It has 9984 valid elevations: -2615.13 to -2549.79 meters relative to the original product's vertical reference. The bundle is centimeter-quantized from float32 (max rounding error 0.005 m). This is **not** a calibrated hazard or human EVA operating model.

**Separate map backgrounds:** NASA Mars Trek WMTS CTX, MOLA and Viking imagery. Successful DEM decoding does not prove imagery tiles loaded: check the visual NASA layer and map warning separately. If the imagery fails, local/manual planning and the bundled DEM can still operate.

## Reviewer checklist (15–25 minutes)

1. Open the **V6.1 preview URL** on desktop; confirm the site renders and no page errors appear. Refresh; verify local missions remain.
2. In the left Planner panel press **Open real-data Jezero demo**. Confirm a new, separate mission named `Jezero · CTX science traverse demo` appears. Existing missions must remain in the Library.
3. In Science → **DEM Route Lab** press **Load official Jezero CTX elevations** (if not already loaded). Expect `USGS CTX DTM · 20 m SOURCE · 104 × 96` and no HTTP error. The official data file is hosted with the preview.
4. Confirm the current manual route has **two waypoints** at 18.44460°N 77.45090°E and 18.45100°N 77.46000°E. They lie inside the bundled clip's coverage.
5. Press **Compare 3 route strategies**. Expect successful shortest/balanced/slope-conscious candidates. The paths can coincide, and the user may choose any one to add. Confirm a chosen candidate remains manually editable.
6. Select the **hypothetical survey obstruction** note as a what-if exclusion zone (start with 80 m), recompute the strategy comparison, and verify the UI explicitly says it is user-authored, not a NASA hazard.
7. Run **Mission Stress Lab**, change the scenario's speed and O₂ rate, rerun, and check estimates change. These are artificial sensitivity ranges, not real suit telemetry.
8. Save a checkpoint; modify a waypoint; restore the checkpoint. Export mission JSON, reload it, and verify metadata and observation survive.
9. Check mobile (~390 px): bottom navigation Map/Planner/Science; buttons stay tappable; scrolling is possible; comparison results do not overflow the screen.
10. Switch map imagery CTX → MOLA → Viking; examine image tiles, console and any fallback notice. Capture screenshot and exact layer failing if any.

**Failure report:** paste browser + device, exact URL, action, actual behavior, screenshot and console error in an issue. Avoid claiming a valid result based only on Vercel deployment status.

## Source checks before Space Apps submission

- [ ] Exact dataset appears in the official 2026 Martian Map **Resources** tab; record screenshot/URL and the use of this source. The challenge requires sources from multiple NASA missions, not merely a decorative planetary image.
- [ ] NASA source credit and USGS authors appear in NASA_DATA.md / SUBMISSION.md.
- [ ] Record visible successful Mars Trek tiles + local DEM path result from public preview.
- [ ] Test flight path, topography, waypoint editing, mobile layout and exports with a real browser.
- [ ] Never state these routes or EVA budgets are approved for astronaut navigation.
- [ ] Keep production V3.1 unchanged until reviewed PRs are approved in order V4 → V5 → V6 → V6.1.
