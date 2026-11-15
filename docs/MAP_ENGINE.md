# Mars Atlas — NASA map engine

This document covers the current Mars Atlas renderer and the reproducible verification of its data sources. It does not describe older prototypes or future AI additions.

## NASA Mars Trek imagery

| Layer | Dataset identifier | Native tile | Maximum used |
| --- | --- | --- | --- |
| Viking Global | Mars_Viking_MDIM21_ClrMosaic_global_232m | JPEG 256x256 | zoom 7 |
| Jezero CTX context (internal) | JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0 | grayscale PNG 256x256 with alpha | zoom 8–11 |
| HiRISE Jezero | JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd | grayscale PNG 256x256 with alpha | zoom 9–11 |
| MOLA / HRSC Relief | Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw | monochrome JPEG 256x256 | zoom 7 |

Source root for each dataset: https://trek.nasa.gov/tiles/Mars/EQ/[dataset]/1.0.0

WMTS GetCapabilities describes matrix identifiers and the image URL template. A common usable tile pattern is /default/default028mm/[zoom]/[row]/[column].[extension]. The application reads capabilities when possible and retains known working paths if metadata fails. Source image pixels must never be interpreted as numerical elevation.

The controlled CTX geographic envelope is approximately latitude 18.2110274–18.7211945 N and longitude 77.1604655–77.6991776 E. Its source resolution is 6 m/pixel, and it is an internal layer visible when the user selects HiRISE at zoom 8–11, not a separate choice in the basemap selector. CTX and HiRISE transparency preserve the underlying lower-resolution layers. The source is **not** the retired Caltech CTX beta01 global mosaic.

The HiRISE geographic bounding envelope in current source config is latitude 18.3067994–18.669315 N and longitude 77.2229331–77.583964 E. A tile is eligible if its geographic rectangle intersects this envelope. Inside the envelope, transparent PNG pixels still indicate areas with no detailed image observations. The original numeric CTX DEM is stored separately in assets.

## Geometry and alignment

Mapping uses an equirectangular east-positive Mars projection in src/geo.js. For longitude lon and latitude lat in degrees, at integer zoom z:

- S = 256 * 2^z
- pixelX = (lon + 180) / 360 * 2 * S
- pixelY = (90 - lat) / 180 * S
- tileColumn = floor(pixelX / 256)
- tileRow = floor(pixelY / 256)

The world grid at zoom z has 2^(z+1) columns and 2^z rows. On screen, a tile at grid (x,y) and display size W occupies (x*W - centerX + viewportWidth/2, y*W - centerY + viewportHeight/2), where center coordinates are projected at the displayed zoom.

For HiRISE selection the shared Viking background source zoom is min(displayZoom, 7). Its display tile size is W=256*2^(displayZoom-sourceZoom). At display zoom 11 one original Viking image can span 4096 screen pixels. That image is requested ONCE and positioned consistently under all the high-detail PNG tiles, not downloaded separately per HiRISE tile. This is only lower-resolution context: scaling cannot create higher-detail source information.

## Rendering, caching and reliability

Main implementation: src/map.js, src/constants.js, src/workspace-polish.css.

1. Browser animation frames coalesce map renders. Wheel input is batched.
2. Native Viking and MOLA modes use their ordinary tile rendering path.
3. HiRISE mode uses three independent DOM layers in draw order: map-background-tiles (Viking), map-context-tiles (controlled Jezero CTX grayscale + alpha) and map-tiles (native HiRISE + alpha).
4. At zoom 3–7 the HiRISE selector shows only Viking; at zoom 8 it adds the controlled CTX mosaic; at zoom 9–11 it adds HiRISE on top. Viewport and tile-footprint intersection prevent requests outside each real mosaic coverage.
5. Cache limits are 24 Viking background tiles, 84 controlled CTX context tiles and 72 foreground HiRISE tiles. All three are cached independently and reused when revisiting zooms or panning.
6. Known NASA tile URL variants are tried on failure, and errored visible tiles may be retried after about 16 seconds, not on every mouse event.
7. WMTS capability responses no longer discard requests still downloading.
8. The loading notice disappears when real visible imagery is present; it does not imply all pixels have high-resolution source coverage.

Mission routes, waypoint coordinates, stored missions, JSON/GeoJSON exports and numerical DEM analysis are independent of visual imagery selection.

## Failure diagnosis and factual verification

Older image handling wrongly assumed Viking zoom 8 existed in the viewed Jezero area. Real Chromium showed 12 out of 12 Viking JPEG requests at zoom 8 failing with HTTP 404 while the corresponding zoom 7 requests returned valid JPEG images. The renderer formerly generated many independent 2048px Viking preview images under HiRISE; this caused redundant downloads, huge apparent blocks and inconsistent loading. Both conditions were corrected.

The legacy CTX beta01 image mosaic was removed from normal map selection because its missing-data strips and seams were intrinsic to the source. This does not remove the separate numeric CTX elevation clip.

GitHub Actions evidence:
- Native browser zoom test: https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43664589796
- Native browser pan test: https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43664904388

The zoom run passed all 167 Node tests and checked 4/4 Viking background tiles loaded at HiRISE view zoom 8; 2/2 Viking tiles and 12/12 native HiRISE tiles at view zoom 11; zero failed NASA responses; zero uncaught browser JS errors; and zero new Viking requests across zoom 11→7→8→11. The pan run moved the map 320 pixels at zoom 11 and retained loaded backdrop, HiRISE PNGs and overlays. Screenshot artifacts can be downloaded from these Actions runs.

Use npm test for fast JS regression tests. The optional map-browser job in .github/workflows/verify.yml uses Playwright Chromium and scripts/map-browser-smoke.mjs. It runs on manual workflow dispatch or push commit whose message contains [browser].

## Limits and future QA

Where no HiRISE data exists inside the controlled CTX footprint, the genuine CTX mosaic provides approximately 6 m/pixel source context instead of immediately enlarging Viking imagery. Beyond both local mosaics, the Viking zoom-7 backdrop still looks softer at view zoom 9–11. This is a legitimate NASA data-coverage limit, not a missing tile or a safe basis for inventing visual terrain. Some image seams reflect source resolution changes. NASA availability and browsers can vary.

Still needed: live-production browser test from the user's network, mobile QA, wider Mars coordinate coverage, extended pan/zoom stress tests and visual review at the exact HiRISE footprint boundary.

## Controlled Jezero CTX context verification (November 15, 2026)

NASA Mars Trek provides the controlled CTX ortho mosaic `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` as grayscale-alpha PNG. It was independently probed at zoom 8, 9, 10, 11 for both the Jezero reference position and approximately 18.39862 N, 77.57575 E, near the reported visual boundary; all sampled PNG requests returned HTTP 200 and valid 256x256 images. JPEG requests returned 404 and are not used. The screenshot showed a sharp HiRISE island against enlarged Viking context; the intermediate controlled CTX is intended to address that difference using true 6 m/pixel observations. Browser verification: https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43696223206 (193/193 JavaScript tests, real imagery and no failed controlled CTX requests).

Zoom 11 uses real CTX and HiRISE tile pixels and preserves transparent coverage boundaries. Neither imagery layer changes DEM elevation values, planned routes or scientific assumptions. Do not apply artificial high-frequency sharpening to an area without actual imagery.

## Marker readability and photographic seams (November 15, 2026)

- When route markers collide at coarse zoom, their *icons* are fanned apart on screen and linked to true map coordinates. Geographic coordinates, measured lengths and exported routes are unchanged. Dragging a shifted icon moves the true point by the pointer's displacement, without snapping at drag start.
- Waypoint and observation shapes (circle, diamond, square, triangle, star) are configurable. Their identifiers are stored in mission, backups, cloud snapshots and checkpoints, without altering scientific data.
- The controlled CTX mosaic uses feathered masks at outer loaded tile edges, preserving adjacent loaded tile edges; the zoom-8 tonal adjustment makes CTX less abrupt against lower-resolution Viking context. This only changes display styling, not source pixels or missing data coverage.
