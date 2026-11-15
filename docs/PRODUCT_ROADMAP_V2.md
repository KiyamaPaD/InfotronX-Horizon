# Mars Atlas — Product Roadmap V2 (15 November 2026)

## Product principle

**Manual-first is mandatory.** Every mission, route, waypoint, observation, comparison, export and saved version must be usable without AI or AI validation. User decisions, source measurements and synthetic scenarios must never be confused. AI is an optional assistant, not the authority for whether a route is allowed.

## Implemented and being verified

### Waypoint & Mission Editor V2
- Named/categorized waypoints, icons, individual colors, exact coordinates, mission details.
- Map-native waypoint and field-note editing, deletion, undo/redo and mission backups.
- Compact waypoint list with two-tier layout to preserve labels on narrow Analytics panels.

### Terrain Intelligence V2
- Numeric USGS/NASA DEM clip ingestion, optional numeric imports and no-data handling.
- Interactive elevation profile linked to a map probe, slope/roughness labs, line of sight and reachability.
- Statistics always label missing data and the difference between empirical DEM elevations and modeled estimates.

### Analytics accessibility repair
- Four navigable groups: Overview, Terrain, Models, Mission.
- A **How to unlock science tools** guide explains the minimum user data (two waypoints, a numeric DEM and route alternatives).
- Every Analytics section is expanded by default; each can be collapsed manually. A guided action never creates hidden/demo data.
- Weighted route-connectivity graph shows a user's waypoint order and geodesic edge weights. The graph is an abstract visualization, not a terrain map.

### Crew Profile (private account foundation)
- Supabase user-owned `mars_crew_profiles` table, RLS SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid()`.
- Private `mars_crew_avatars` storage, max 2 MB, PNG/JPEG/WebP. Signed URLs valid for 15 minutes; owners can upload, replace or remove their own avatar.
- Mission Center → Crew Profile: display name, callsign, mission role, focus area, biography, optional profile photo and on-device activity totals.
- The user-entered role is **not verified NASA astronaut status**, academic credentials or an authorization role. Data remain private by default.
- Real credentialed end-to-end avatar upload still requires testing with a dedicated authenticated account; mock tests and security policy inspection are not the same as an authenticated production test.

## Remaining phase 1 — Route Comparison & What-if V2

1. Compare user-defined routes using distance, numeric DEM ascent/descent, slope distributions, time and resource envelopes.
2. Provide a clear side-by-side chart and a **Pareto frontier** for competing objectives; do not blend unknown terrain into fake zero-risk scores.
3. Overlay waypoint route graphs, segment tables, probability-free uncertainty bands and optional DEM-based heatmaps.
4. Add reversible hypothetical obstruction zones, replan and show exact differences before/after. Preserve original and user-edited alternatives.
5. Keep A* and D* Lite traceable and show algorithm names, assumptions, source coverage and skipped NoData segments.
6. Acceptance: full route comparison with and without a loaded DEM, repeatable graph/score tests, accessible mobile and desktop charts, export retaining provenance.

## Remaining phase 2 — Mission Control & Collaboration V2

1. Build a user-controlled mission/team workspace on authenticated Supabase sessions.
2. Extend Crew Profile to optional visibility settings and capability tags, with private-by-default identity and avatars.
3. Shared mission permissions, revision conflict detection, audit history and explicit team invites.
4. **Global chat / mission chat** is a proposal, not shipped: implement authentication, spam and abuse limits, mute/block/report tools, moderator review, safe retention, sanitization, RLS membership rules and visibility controls first.
5. Offline mission editing continues independently of chat and cloud access.
6. Acceptance: separate-account tests for owner/editor/viewer access, impersonation attempts, photos/privacy, conflict handling and account deletion.

## Remaining phase 3 — Optional AI Mission Copilot + true 3D terrain

1. AI Copilot receives bounded tool access to deterministic analytics, public NASA datasets and user-permitted mission context. All suggestions display provenance and limitations.
2. Copilot never creates, deletes, shares or overrides routes without explicit user approval; manual-first is unaffected.
3. True 3D DEM relief view uses real numeric elevations and separately identified photographic context. No imaginary data are inserted into NoData areas.
4. Include 2D fallback, GPU performance caps, mobile usability and camera/orientation controls.
5. Diagnostics/visualizations: elevation surface, slope/roughness overlays, local cross-sections, route graph and 3D trace, coordinate and scale legend.
6. Acceptance: scientifically transparent 2D/3D alignment, no fabricated surface data, graceful WebGL failure, validated tool-call permissions and reproducible output.

## Graphics and graph backlog

- Segment-length histogram; cumulative distance profile and elevation plot
- Climb/descent and gradient profiles with DEM coverage gaps highlighted
- Route-connectivity graph, shortest-path exploration and algorithm execution trace
- Isochrones/reachability heatmaps and hypothetical cost surfaces
- Multi-route Pareto front, CVaR/Wasserstein scenario comparisons with transparent artificial assumptions
- Mission progression/version graph, collaborative activity timeline
- Hover/click synchronization across charts and map, keyboard and touch alternatives

Charts must label units, sources, coordinate reference and whether their values are measured, mathematically derived, hypothetical or unknown. Accessibility requires sensible tooltips and text/table equivalents.

## Full Analytics QA matrix

Test these independent dimensions, not only unit tests:

- **Screens:** 320/375/768/1024/1480 px; right sidebar scrolling; no clipped control or character-by-character waypoint labels
- **Groups:** Overview, Terrain, Models, Mission; expand/collapse; keyboard navigation; jump-to-tool; contextual prerequisite messages
- **Missions:** zero points, one, two, many, alternate routes, invalid coordinates, mission switching, undo/redo
- **DEM:** unloaded, bundled numeric, imported verified-format user data, partial/no coverage, NaN/NoData and out-of-footprint route
- **Scientific charts:** empty, loading, valid, partial, error; charts and numerical table units agree
- **Account:** signed out, newly registered, signed in, private avatar upload, signed URL expiry, removal, denied cross-account access
- **Cloud collaboration:** owner/editor/viewer/simultaneous changes and policy checks when phase 2 is implemented
- **Map:** imagery zoom 3–11, pan, highlighted profile probe, markers and notes, no accidental relocation

Automated unit tests and the current Chromium smoke suite cover a baseline; a dedicated, comprehensive product QA round is still needed for all interactions and future phases.
