# Mars Atlas — current project state

**Team:** InfotronX Horizon · **Challenge:** NASA Space Apps Challenge 2026 · **Season:** 2026–2027  
**Repo:** https://github.com/KiyamaPaD/Mars-Atlas  
**Branch:** `main`  
**Vercel project:** `mars-atlas`; production alias https://mars-atlas-mu.vercel.app

## Verified on 14 November 2026

- New repository has a single initial release commit (`ac7fa28`), copied from the earlier InfotronX Horizon V9 candidate.
- GitHub Actions initial `Verify` run completed successfully on `main`.
- The new Vercel project reports its production deployment as `READY` and tied to `ac7fa28`.
- Vercel Authentication / Standard-style deployment protection is enabled. **Public access to the short production alias must be tested in an unauthenticated browser**, and a Shareable Link used if necessary.
- A successful deploy and JS tests do **not** establish full desktop/mobile functionality.

## Present in source code

Manual-first route and waypoint editing, mission-local persistence and exports, Jezero NASA/USGS map resources, a 104×96 numeric CTX DEM clip, routing algorithms (A*, D* Lite, bounded Pareto), and exploratory terrain/science calculations.

## Not yet established or implemented

- Account-based cloud libraries and role-based access are implemented and schema deployed, but email redirects and real-account tests still require verification. Live simultaneous editing is not implemented.
- No independently documented complete browser smoke test of the newly migrated production URL.
- No measured rover safety or certified EVA/hazard model; modeled outputs must be labeled.
- No purchased domain yet.
- NASA Space Apps 2026 **eligibility is not validated**; the new Git commit must not be mistaken for the actual dates of prior development.

## Immediate priorities

1. Run the [beta testing checklist](BETA_TESTING.md) from fresh desktop/mobile sessions.
2. Confirm external access to the short production URL, then invite teammates to report reproducible defects.
3. Fix actual high-severity bugs, performance and mobile accessibility issues before adding more research panels.
4. Review the official challenge Resources and build/submission timing rules with the organizers; disclose previous code and tools accurately.
5. Buy a domain only after the beta site works reliably.

Historical V3–V9 research reports remain under `docs/` for reference; the instructions referring to retired branches/PR numbers in those documents are archival.

## Cloud connection — November 2026

The dedicated Mars Atlas Supabase project (`yuvdrjptwumbfzjsimoe`) is active. Four tables have RLS policies for mission owners, editors and viewers. Database RLS and simulated email-invitation tests passed; the Auth advisor currently warns that leaked-password protection is disabled and simulated multi-user tests passed with full rollback. A public publishable key is configured in the frontend, but real-account cloud saving and email sharing still need end-to-end browser verification. MathHard was paused separately, without data migration or deletion.

## Map and Analytics performance

Wheel zoom events are batched, canvas overlay updates are coalesced to animation frames, tile requests reuse verified formats and successful cached imagery, and failed tiles can be retried. Dragging a waypoint now persists its position and refreshes full analytics when the drag ends rather than for every pointer event. Analytics groups calculations into Overview, Terrain, Models and Mission, with data-source labels corrected. These are code-level fixes; measured browser performance and high-zoom coverage still require desktop/mobile testing.

## NASA map loading and gap recovery — November 2026

NASA WMTS GetCapabilities is consulted before initial tile requests, with a short timeout fallback to documented tile paths if metadata is unavailable. A failed or delayed tile can show a geographically aligned parent tile from up to two lower zoom levels until the detailed imagery becomes available. Tiles load only after attachment to the DOM, a working image format is preferred per zoom level without removing alternatives, and incomplete NASA coverage has a visible lower-resolution label. These are code and automated-test verified changes; real browser network traces and field visual QA remain necessary.
