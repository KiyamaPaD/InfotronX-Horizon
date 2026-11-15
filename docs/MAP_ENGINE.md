# Mars Atlas — NASA map engine

This document covers the current Mars Atlas renderer and the reproducible verification of its data sources. It does not describe older prototypes or future AI additions.

## NASA Mars Trek imagery

| Layer | Dataset identifier | Native tile | Maximum used |
| --- | --- | --- | --- |
| Viking Global | Mars_Viking_MDIM21_ClrMosaic_global_232m | JPEG 256x256 | zoom 7 |
| HiRISE Jezero | JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd | grayscale PNG 256x256 with alpha | zoom 11 |
| MOLA / HRSC Relief | Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw | monochrome JPEG 256x256 | zoom 7 |

Source root for each dataset: https://trek.nasa.gov/tiles/Mars/EQ/[dataset]/1.0.0

WMTS GetCapabilities describes matrix identifiers and the image URL template. A common usable tile pattern is /default/default028mm/[zoom]/[row]/[column].[extension]. The application reads capabilities when possible and retains known working paths if metadata fails. Source image pixels must never be interpreted as numerical elevation.

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
3. HiRISE mode uses independent DOM layers: map-background-tiles (continuous Viking grayscale background) and map-tiles (transparent native HiRISE overlay).
4. At zoom 3–8 in HiRISE mode, only the Viking layer renders. At zoom 9–11, native HiRISE tiles are requested where geographic coverage may exist.
5. The Viking background image cache is bounded to 24 tiles; foreground HiRISE tiles to 72. Source background images are reused across zooms and panning.
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

Where no HiRISE PNG data exists, the Viking zoom-7 backdrop will look softer than neighboring HiRISE detail at view zoom 9–11. This is a legitimate NASA data-coverage limit, not a missing tile or a safe basis for inventing visual terrain. Some image seams reflect source resolution changes. NASA availability and browsers can vary.

Still needed: live-production browser test from the user's network, mobile QA, wider Mars coordinate coverage, extended pan/zoom stress tests and visual review at the exact HiRISE footprint boundary.
