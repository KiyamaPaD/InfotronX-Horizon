# Mars Atlas — Real Jezero Numeric DEM Audit

Audit date: 15 November 2026. Numeric source: USGS Astrogeology / NASA MRO Context Camera Mars 2020 Terrain Relative Navigation CTX DTM Mosaic, Fergason et al. (2020), DOI: https://doi.org/10.5066/P906QQT8.

This is an audit of the actual bundled numeric data in assets/jezero_ctx_trn_dem_20m_clip.json, not of the color pixels from the NASA Mars Trek basemaps. Test file: tests/real-jezero-dem.test.mjs.

## Data integrity and georeferencing

| Property | Verified value |
| --- | --- |
| Grid | 104 by 96 numerical cells |
| Finite values | 9,984 of 9,984 |
| Minimum elevation | -2615.13 m |
| Maximum elevation | -2549.79 m |
| Representative east-west posting | 19.1066 m |
| Representative north-south posting | 19.9662 m |
| Vertical reference | MOLA topography / DeltaGeoid, from source metadata |
| Recorded original TIFF SHA256 | 16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b |
| Computed decoded uint16 payload SHA256 | 57ec47f619a26a0732335000c30a3238103969b52a6d150919ab6f9fe84cf1fb |

The decoded-payload SHA256 is an integrity fingerprint of the numerical file already in the repository, not independent proof of its original TIFF provenance. Original-file checks were documented earlier in SCIENCE_VALIDATION.md. This audit did not re-download the original GeoTIFF.

## Verified real-DEM mission results

Review mission coordinates: start (18.44460 N, 77.45090 E), goal (18.45100 N, 77.46000 E). With illustrative slope threshold 18 percent and slope penalty 6:

| Metric | Value |
| --- | --- |
| A* route length | 677.926 m |
| Model route cost | 729.286 distance-plus-penalty units |
| Total uphill ascent | 1.18 m |
| A* full route | 28 grid cells |
| D* Lite full route | 28 grid cells |
| A* versus D* Lite modeled cost | Equal within 1e-5 |

The model uses edge cost = horizontal distance in meters + slope penalty times absolute elevation change in meters. Uphill and downhill both contribute to the penalty. This is NOT rover-energy consumption or a calibrated safety model.

One cold GitHub Actions run observed A* at approximately 9.1 ms and D* Lite (including setup) at approximately 34.1 ms for the review mission. These are observations from one runner, not performance guarantees on browsers or mobile devices.

## Mathematical and integration checks

1. A separate, array-scan Dijkstra reference verified A* optimal costs for three slope penalties (0, 6, 24) on a 24x24 subset cut directly from the real elevation data without synthesizing heights.
2. D* Lite handled the insertion and removal of a user-authored hypothetical 70-meter exclusion, agreeing with a fresh A* run and returning to its original result after removal.
3. All three mission strategies (shortest, balanced, slope-conscious) generated numerical routes within the local DEM, and a multi-waypoint route preserved the human-authored intermediate anchor.
4. Routing outside the DEM was refused, and an elevation profile crossing its boundary explicitly contained missing values rather than fabricated elevations.
5. A bounded Pareto comparison on a 12x12 real-data window produced four frontier labels and returned three requested alternatives after 251 expansions; in that run the frontier was not truncated. Distances and uphill ascent were remeasured independently.
6. The shipped loadJezeroDem path is tested for correct decoding and for a simulated HTTP 503 failure without live network traffic.
7. The committed decoded elevation bytes are protected by a fixed SHA256 test; deliberately changing the DEM requires updating this fingerprint after data provenance review.

## Reproduction and scientific limits

Run npm test in the repository root. Look for REAL_JEZERO_DATA, REAL_JEZERO_ROUTING and REAL_JEZERO_PARETO in the GitHub Actions log.

CI evidence: https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43694487967

This dataset covers a small patch of Jezero and cannot validate routes across the whole visible HiRISE footprint. Approximate 20 m sampling cannot resolve fine rock obstacles, regolith behavior, rover traction or astronaut EVA safety. The original raster's vertical reference and coordinate convention must remain explicit when new DEMs are added. No NASA/USGS safety certification is claimed.

For independent synthetic checks see ROUTING_VALIDATION.md; for source derivation and original-raster details see SCIENCE_VALIDATION.md; for image rendering see MAP_ENGINE.md.
