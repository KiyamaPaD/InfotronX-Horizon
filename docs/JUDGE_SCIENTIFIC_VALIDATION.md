# MARS ATLAS — Judge-facing scientific validation dossier

**Version:** November 15, 2026 · **Team:** InfotronX Horizon · **Status:** independent student prototype; not an official NASA navigation tool.

## 1. What the application actually computes

MARS ATLAS is a **manual-first** mission planner for the Jezero region. Users set waypoints, missions and hypothetical exclusion zones. These are **user decisions**, not NASA-confirmed rover or astronaut routes.

- **Visual imagery:** NASA/JPL Mars Trek global Viking and localized CTX/HiRISE map layers; texture/image brightness does **not** define ground elevation.
- **Numeric relief:** a limited-area Jezero CTX *digital terrain model* (DTM/DEM), bundled as a documented clipped and quantized raster, and optionally imported numeric user data. A loaded numerical grid is essential for slope-aware A*.
- **Coordinates:** planetocentric latitude and east-positive longitude, with a spherical reference Mars radius **R = 3,396,190 m**. This is an approximation: Mars is an oblate spheroid, so it is not a geodetic survey-grade ellipsoidal surface distance.
- **Haversine:** surface great-circle distance between points. It does not account for hills/rough 3D surface distance.
- **Elevation/grade:** adjacent DEM cell height difference `Δh` divided by spherical horizontal cell-to-cell distance `d`. Grade (%) = `100 * Δh / d`.
- **A* graph:** 8 neighbors per cell, blocked NoData, optional hypothetical exclusion zones, and a maximum *model* grade. Diagonal corner cutting between invalid/blocked side cells is rejected.
- **Route cost per neighbor:** `d * (1 + lambda * abs(grade)/100)`. `lambda` is user-chosen and **is not a NASA safety threshold or measured energy model**.

## 2. Explainability identity and proof

For path edges `i`, `grade_i = 100 * (h_{i+1} - h_i) / d_i`:

`C = Σ d_i * (1 + lambda * abs(grade_i)/100)`

`  = Σ d_i + lambda * Σ abs(h_{i+1} - h_i)`

`  = D + lambda * (A + H)`

where:
- `D` is the **uncompressed DEM-grid path length** in meters.
- `A` is total upward gain, summed across all accepted grid edges, in meters.
- `H` is cumulative downward height loss, treated as a positive quantity, in meters.
- `lambda` is dimensionless. All cost terms are **meters of model objective**, not meters of actual traveled distance or joules.

The score is not a scalar safety or reliability assessment. A candidate with less height variation may still cross an unmodeled weak soil or rock. **Never say that minimum C guarantees safety.**

Three preset A* preferences currently use lambda `0`, `6`, and `24`:

| Preset | Optimization objective | Correct interpretation |
| --- | --- | --- |
| Shortest modeled | `D` | Minimum graph path length **subject to grade/NoData/exclusion constraints** |
| Balanced | `D + 6*(A+H)` | Trades extra distance against cumulative absolute altitude change |
| Slope-conscious | `D + 24*(A+H)` | More strongly penalizes total vertical variation, not a blanket guarantee of minimum *maximum local slope* |

A* searches are repeated on the **same** DEM and waypoint anchors under the same maximum-grade threshold and hypothetical exclusion areas. The preference affects *cost*, not the actual DEM samples.

**Why This Route?** recomputes each candidate's cost under the selected penalty and compares the tested candidates. The non-dominated/Pareto labels concern **D versus A+H** only. If results tie, no distinct winner is claimed. If no route is feasible, no alternative is recommended.

## 3. What was tested

The production test suite includes:

1. Independent great-circle radius sanity checks: a one-degree meridian arc, antipodal half-circumference, self-distance, symmetry, and a triangle inequality example.
2. Synthetic height fixtures: full coverage, missing cells, impenetrable walls, blocked diagonal corners and hypothetical exclusion disks.
3. **48 deterministic synthetic grids**, each compared with a separate quadratic-time **Dijkstra reference** under three penalty settings (up to 144 A* vs. Dijkstra comparisons; no excluded cases counted as valid path successes).
4. For successful modeled paths, `abs(A*_cost - Dijkstra_cost) <= max(1e-6, 1e-9 * reference_cost)` and `abs(A*_cost - (D + lambda*(A+H))) < 1e-6`.
5. Route strategy tie handling, infeasible paths, explicit Pareto dominance, numerical validation and preservation of modeled cost in route metadata.
6. Real Chromium map tests, including NASA tiles and science tools. **This is a software smoke test, not an external scientific field validation.**

All random fixtures are expressly **synthetic test data**. They are not Mars measurements.

For the latest CI run, use GitHub Actions at https://github.com/KiyamaPaD/Mars-Atlas/actions and inspect the latest `Verify` job. A green result confirms test assertions passed; it does not prove astronaut-route safety.

## 4. Scientific limitations to tell judges

- The bundled numeric CTX clip covers **only a small area** of Jezero and includes quantization. Outside its footprint or across NoData cells, terrain-based routing is not scientifically supported.
- CTX photomosaic 6 m/pixel is **imagery**; the numeric terrain product is different (CTX DTM, approximately 20 m source resolution). Never call an image-derived height "NASA measurement."
- The model omits soil bearing strength, rock distribution below DEM resolution, lighting, communication hazards, suit/rover mechanics, dust storms, unknown obstacles and real navigation constraints.
- Resource estimates are deliberately synthetic assumptions, not NASA spacesuit telemetry.
- We do not present modeled maximum grade as a measured rover or astronaut safety limit.
- To avoid a misleading comparison, manual waypoints' direct great-circle polyline length is displayed separately from A* **cell-following modeled path distance**.
- An optimum is **only** an optimum of the specified finite graph, input DEM, waypoints and cost function. It is not automatically a globally optimal physical traverse.

## 5. Reproducibility / judge challenge protocol

1. Enter two waypoint coordinates within the numeric DEM coverage. Record them.
2. Load the **bundled numeric Jezero DEM**; record source/coverage, grade threshold and exclusion radius.
3. Generate three deterministic route strategies on that *same* grid.
4. Change the evaluation preference from lambda 0 to 6 to 24 in **Why This Route?**. Confirm route scores change while stored waypoints do not.
5. For a candidate, verify `score = distance + lambda*(ascent + descent)` using the displayed values (allowing rounding on screen).
6. Add an explicit **hypothetical** exclusion around a field note; recompute and explain the change in cost or failure.
7. Deliberately set a waypoint outside the DEM clip: verify the app refuses to claim a traversable route.
8. Export the mission, preserve source metadata and distinguish the user route from generated candidate routes.

## 6. Public references

- USGS Astrogeology coordinate reference and Mars radius (spherical 3,396,190 m): https://astrogeology.usgs.gov/docs/concepts/camera-geometry-and-projections/learning-about-map-projections/
- NASA/JPL Mars Trek WMTS catalog (separate imagery layers and map footprints): https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- USGS Mars 2020 CTX *terrain model* metadata, approx. 20 m/pixel, east-positive planetocentric: https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic
- USGS Mars 2020 CTX *orthorectified image mosaic* metadata, approx. 6 m/pixel: https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_context_camera_orthorectified_image_mosaic
- NASA Space Apps Challenge 2026 official timeline and submission: https://www.spaceappschallenge.org/2026/

These external references support context, not a claim that NASA tested or endorsed this custom application.
