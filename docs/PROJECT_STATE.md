# Mars Atlas — current project state

Team: InfotronX Horizon
GitHub: https://github.com/KiyamaPaD/Mars-Atlas (main)
Production: https://mars-atlas-mu.vercel.app — Vercel project mars-atlas
Backend: dedicated Supabase Mars Atlas project yuvdrjptwumbfzjsimoe

## Product architecture

Mars Atlas is a manual-first Jezero mission planner. Routes, waypoints, observations, mission backups and comparisons work independently of AI. Native HTML, CSS and JavaScript are deployed from main to Vercel. Local mission saves and JSON/GeoJSON exports are available without an account. Supabase supports cloud missions, revision history and access roles protected by RLS. Invitation matching by verified email does not dispatch an actual email or implement real-time coediting.

The numerical CTX DEM clip and scientific calculations are independent of which visual NASA basemap is selected. Route analysis is modeled, not certified for a real rover or EVA.

## Verified map renderer — 15 November 2026

The old CTX beta01 visual mosaic was retired because its source images contained strips without data. Current image layers:

| Layer | Display | Highest verified source zoom |
| --- | --- | --- |
| Viking Global | continuous global context | 7 |
| HiRISE Jezero | detailed local grayscale PNG imagery with alpha | 11 |
| MOLA / HRSC Relief | monochrome shaded relief (not numeric elevation) | 7 |

HiRISE selection at zoom 3–8 uses the Viking background. For zoom 9–11 the renderer maintains ONE continuous geographically aligned Viking background, at source zoom 7, and native 256px HiRISE PNGs in a separate overlay. This replaces the old algorithm which downloaded and enlarged Viking imagery independently inside every HiRISE tile.

**Confirmed root cause:** A real Chromium network trace showed Viking zoom-8 tile requests returning HTTP 404 around Jezero. The same area at Viking zoom 7 returned 200. Our Viking maximum is now 7, including in the HiRISE fallback. Arrival of WMTS metadata no longer cancels requests already in flight.

**Browser QA:** GitHub Actions run https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43664589796 passed 167 Node tests and real Chromium image tests. At view zoom 8, 4/4 visible Viking tiles loaded. At view zoom 11, 2/2 Viking background tiles and 12/12 native HiRISE detail tiles loaded. No NASA HTTP failures, duplicate background requests during 11→7→8→11, or uncaught browser JS errors.

**Pan QA:** https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43664904388 passed a 320px map drag at zoom 11 with 2/2 background and 12/12 detail tiles visible. Browser screenshots are available as GitHub run artifacts. Testing was on a locally served GitHub checkout with real NASA network requests, not the deployed production host.

Details: [Map engine](MAP_ENGINE.md) and [Beta testing](BETA_TESTING.md).

## Other implementation state and limitations

- Analytics navigation groups Overview, Terrain, Models and Mission.
- Mission Center consolidates local autosave, checkpoints, cloud library and exports.
- Supabase missions and sharing have RLS safeguards; simulated database access tests passed. Test full sharing from two real accounts independently.
- No custom domain has been purchased. Validate the Vercel production URL in an unauthenticated browser.
- NASA Space Apps challenge eligibility for pre-existing code is not established; changing Git commit history does not alter original development timing.
- The Viking zoom-7 context appears increasingly soft beyond zoom 7. Where HiRISE has no coverage, high-resolution visual information is unavailable; do not invent Mars terrain to conceal it.
- Additional browser/device QA is still needed for mobile GPU, long panning sessions and the full geographic footprint.

## Next acceptance steps

Confirm the map in the user's desktop and mobile browser, then finish the overall product review. After the map is accepted, evaluate optional AI functionality and prepare the complete Mars Atlas technical handoff covering data, GitHub, Vercel, Supabase and testing. Do not mix documentation from unrelated projects.

Historical research reports elsewhere in docs are archives; this file describes the current implementation.
