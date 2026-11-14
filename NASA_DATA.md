# NASA data catalog and coverage notes

Last reviewed: November 14, 2026. This list documents source provenance; it does not certify that any particular WMTS tile was reachable during deployment.

## Currently configured map backgrounds

| Layer | Agency/mission | Layer identifier | Type | Limit |
| --- | --- | --- | --- | --- |
| Global CTX | NASA / MRO | `CTX_beta01_uncontrolled_5m_Caltech` | Orbital imagery | Visual basemap; not a numeric terrain model |
| MOLA colored shaded relief | NASA / MGS | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | Colored hillshade | Cannot infer point-specific slopes from rendered colors |
| Viking global mosaic | NASA / Viking | `Mars_Viking_MDIM21_ClrMosaic_global_232m` | Color imagery | Broad context only |

Official directory: <https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars>

The map client requests WMTS metadata and/or image tiles from NASA's Mars Trek server. Actual availability, tile IDs, resolution and CORS behavior must be verified on the production URL.

## Priority investigation for a Jezero-focused demo

**MRO CTX — Jezero Controlled Mosaic**, ID `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`, extent reported in NASA's catalog: longitude ~77.16–77.70°E; latitude ~18.21–18.72°N.

**MRO CTX — Jezero Preliminary Mosaic**, ID `Jezero_CTX_BlockAdj_dd`, extent reported in NASA's catalog: longitude ~75.15–78.87°E; latitude ~15.91–19.45°N.

These regional products can have non-global tile matrices. **Do not plug their paths directly into the current global equirectangular tile-grid algorithm** before reading WMTS `GetCapabilities` and implementing proper matrix offsets, origin and resolution.

**Perseverance rover traverse / NASA's Jezero map:** <https://science.nasa.gov/mission/mars-2020-perseverance/location-map/>. It includes the rover path and image data context. It is an external reference page, not yet ingested as structured locations in this app.

**Detailed elevation / slopes:** source a DEM with well-documented coverage, horizontal projection, pixel resolution and vertical reference before implementing numeric grades or slope-safe routes.

## Current truth labels

- Route length: spherical great-circle estimates (Mars radius 3,396,190 m).
- Route Inspector: geometry-based suggestions; *not* rover/EVA safety certification.
- Detour simulation: geometry-only example, *not* a hazard-aware reroute.
- Observations: user-entered hypotheses, *not* NASA-verified findings.
- Colored hillshade: visualization only; not directly convertible to elevation in meters.

NASA's older Mars Rover API is listed as archived in <https://api.nasa.gov/>. Avoid building new code around that legacy API.

## NASA Space Apps 2026 eligibility checkpoint

NASA Space Apps moderators state that eligibility for **Global Awards** requires meaningful use of at least one NASA data source **listed under the selected challenge’s official Resources tab**. Simply citing mission facts or photographs may not satisfy this rule. The exact eligible datasets on the 2026 Martian Map Resources tab have **not yet been cross-checked in this repository**; the team must verify and document the matching listed dataset before submission.

Official selected challenge: <https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/>

Moderator reference: <https://github.com/nasa/spaceapps/discussions/1827>


## Candidate numeric DEM ingestion (V5 feature branch — not yet loaded)

USGS/NASA [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic) is a **numeric 20 m/pixel** Jezero digital terrain product derived from Mars Reconnaissance Orbiter CTX stereo, not a colored shaded-relief image. Its listing describes an ~87 MB GeoTIFF `M20_JezeroCrater_CTXDEM_20m.tif`.

The original TIFF could not be retrieved in the development environment. The V5 DEM Route Lab therefore accepts only a **user-imported numeric JSON clip** created using [`scripts/prepare_dem.py`](scripts/prepare_dem.py) and the procedures in [`docs/DEM_IMPORT.md`](docs/DEM_IMPORT.md). No numeric elevation tiles are included in V5's preview, and no live Mars slope claims can be made until a verified clip is supplied.

USGS also publishes the [Mars Sample Return HiRISE Terrain Relative Navigation DEM mosaics](https://www.usgs.gov/data/mars-sample-return-hirise-mosaics-terrain-relative-navigation), 2025, DOI [10.5066/P13CPYYU](https://doi.org/10.5066/P13CPYYU); check coverage and scale before selecting one.

## Verified source used by the V6.1 preview

Mars 2020 Terrain Relative Navigation CTX DTM Mosaic, NASA MRO/CTX data released by USGS Astrogeology (Fergason et al. 2020), DOI **10.5066/P906QQT8**. The V6.1 review bundle includes a real 104×96 numeric clip within the published Jezero source coverage. The source is 20 m/pixel projected to Mars 2000 Sphere (equirectangular, planetocentric). Source download hash, sample values, repro steps, and scientific limits: [docs/SCIENCE_VALIDATION.md](docs/SCIENCE_VALIDATION.md). This source **has not been confirmed to appear in the official challenge Resources list**; verify that separately.
