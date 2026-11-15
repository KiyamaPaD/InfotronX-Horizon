# External reference research and product ideas

Updated 2026-11-14. These projects and sources are **references, not endorsed dependencies**. Verify the license before reusing code/assets; inspiration is not permission to copy source, images, or proprietary datasets.

## Relevant prior work and competition

1. **NASA MMGIS** — https://github.com/NASA-AMMOS/MMGIS and https://nasa-ammos.github.io/MMGIS/tools/draw
   - Already provides 2D/3D scientific mapping and multi-user geographic drawing. Therefore collaborative map annotation is not intrinsically novel.
   - Useful insight: reusable layers, points/lines/polygons, team edit controls; explicitly guard against conflicting edits.
2. **MOMAR (2026 Jezero prototype)** — https://www.momar.si/ and https://www.momar.si/how-it-works/
   - Presents CTX/HiRISE/CRISM data, DEM-derived terrain tools, route comparison, 3D playback, evidence and rover photos; this is a **serious overlap with Mars Atlas**.
   - Useful insight: real NASA data coverage and uncertainty must be front-and-center. Do not claim the same features until implemented.
3. **Spacebee / Aónikenk Lunar Data Visualizer (Space Apps 2023 winner)** — https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023
   - Demonstrates understandable multi-layer science visualization, selection and plots instead of an image-only globe.
4. **NASA Space Apps 2024 winners** — https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/
   - Team I.O. / GROW demonstrated natural-language geospatial investigation; a chatbot alone is not new.
5. **NASA Space Apps 2025 winners** — https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/
   - PureFlow exemplifies a meaningful design→simulation→validation feedback loop; copying a UI feature would not reproduce the value.
6. **NASA Mars Trek layer catalog** — https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
   - Jezero CTX and HiRISE mosaics exist; tile matrix, projection, resolution, coverage and actual live requests must be checked.

## Candidate features (strict evaluation)

| Idea | Priority | Verdict | Why / requirement |
| --- | --- | --- | --- |
| **Evidence-linked route change log** | P1 | ACCEPT | Explain which user observation or NASA layer caused a route revision; provenance and uncertainty |
| **Coverage/confidence overlay** | P1 | ACCEPT if data exists | Distinguish well-mapped and unknown areas rather than invent low/high risk |
| **Before/after waypoint and distance diff** | P1 | ACCEPT | Directly useful to mission revision; build on existing checkpoints |
| **Return-to-base estimate** | P1 | TEST | Illustrative time/distance budget with explicit assumptions, not true life-support approval |
| **Science stop scheduler** | P1 | TEST | Link geologic objectives, access effort and time budget using real observations |
| **Instrument-level source cards** | P1 | ACCEPT | Show mission, instrument, resolution, temporal context and limitations |
| **Segment uncertainty flags** | P1 | ACCEPT | Explain gaps: unsupported slope, missing height model, uncertain image coverage |
| **Multi-user observation history** | P1 | TEST | Valuable differentiation but requires secure backend and permissions |
| **Offline export field kit** | P2 | TEST | Useful for mobile but browser cache and licensing complexity; focus export first |
| **Terrain-linked elevation profile** | P1 | ACCEPT when DEM is valid | Never infer meters from colored hillshade; use DEM data with datum |
| **Interactive knowledge graph** | P2 | TEST | Valuable only if clicking a source shows impact on route/mission, not decoration |
| **3D mission playback** | P2 | DEFER | Complex and competitors already have it; only with validated terrain data |
| **Unverified Mars safety/risk scoring** | — | REJECT | Can mislead; requires actual geospatial measurements and assumptions |

## Proposed differentiator


This is a *product hypothesis*, not a claim no other system can do it. First show reliable maps and one evidence-driven scenario; add true live collaboration later if feasible.

## Projects reviewed (ideas only, no code copied)

- **Deepanki-sketch/Nasa-Martian-Map (ARES-OPS)**: Mount Sharp as the science site, a slope-hazard heat map on a 3D mesh, a street-view style surface walk, and a walk-back reserve. Taken as ideas: slope colours on the 3D surface and a ground view. Its safety thresholds were not reused because they are not sourced here.
- **rijan-maharjan836/martian-map-project-astra**: Jezero as the first region; terrain evaluation and route planning in an exploration concept.
- **kmmohaimenulhaque-code/MartianMap-NeuroNexus**: a 30-second subtitled judging demo next to a longer one, tests on several devices, and several AI fallbacks. Taken as ideas: the two-length demo and device checks.
