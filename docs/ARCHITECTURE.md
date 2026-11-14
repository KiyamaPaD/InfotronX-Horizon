# Mars Atlas architecture — InfotronX Horizon

## Frontend

Browser-native HTML, CSS and JavaScript modules. `src/main.js` connects the map, mission state, science panels and exports. The map uses NASA Mars Trek imagery and local source-labeled numeric DEM data.

## Data and algorithms

- `src/store.js`: browser-local missions, routes, waypoints, observations and checkpoints.
- `src/terrain.js`, `src/graph-grid.js`: graph traversal, slope-aware A* and exclusions.
- `src/dstar-lite.js`: incremental replanning; `src/pareto-routes.js`: bounded multi-objective routes.
- `src/measure-theory.js`, `src/advanced-math.js`: area weighting, Haar, hypsometry, contours and scenario distributions.
- `src/terrain-topology.js`, `src/terrain-intelligence.js`: persistence, visibility, surface metrics and reachability.
- `assets/jezero_ctx_trn_dem_20m_clip.json`: genuine, limited-area USGS/NASA CTX elevation samples.

## Persistence and hosting

The existing site is static-hosted by Vercel, while mission state is stored in browser `localStorage`, with explicit JSON/GeoJSON exports and URL-copy sharing. **This is not cross-account synchronization**.

`supabase/schema.sql` is a future cloud data design and has not been deployed. A production collaboration backend would require a new dedicated project, authentication, row-level security, migration tests, audit history and concurrent-edit handling.

## Release

Current production branch `main` is V3.1. The consolidated V9 candidate is on `team/relaunch-candidate`, with branding work on `brand/infotronx-horizon`. Do not merge without review. Historical stacked branches remain for traceability.
