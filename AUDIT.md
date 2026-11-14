# Mars Atlas — V1 → V1.1 review (2026-11-14)

## Corrected

1. Invalid route records (for example `null`) no longer crash JSON validation.
2. Route count is enforced on creation/duplication. Detour creation checks the waypoint/route limits before creating a new route.
3. GeoJSON omits empty routes and exports one-point routes as Point features (LineString requires at least two positions).
4. The browser library now persists the selected mission and loads legacy V1 arrays. Selecting a mission does not change its updated timestamp.
5. Missions can be deleted, and deleting the last one leaves a usable blank mission.
6. A failed `localStorage` save now changes the visible save status instead of silently looking successful.
7. Individual waypoint latitude/longitude values can be edited numerically, not only moved by dragging.
8. User field notes support an explicit, user-provided evidence reference.
9. NASA tile image handlers ignore events for images removed from the current view or obsolete layers.
10. Added route geometry review and cross-referencing with nearby user notes, without implying real EVA safety.

## Tests performed

- `npm test` — 23 Node unit tests passing at release packaging.
- `node --check src/*.js` — JavaScript syntax validation.
- Structural checks of referenced source files, CSS and HTML markup.
- Static HTTP responses via local Python server.

## Unverified items / known gaps

- Browser interaction tests of V1.1 could not complete in the current environment: automation blocked local navigation, and headless Chromium stalled with a file URL. V1 had previous offline UI checks, but these do not cover the new V1.1 controls. **Perform a real-browser smoke test before judging/submission.**
- NASA Mars Trek WMTS is documented by NASA, but the exact live image requests were not reachable from this runner. On a deployed URL, verify at least two tiles/layers visually. In the absence of imagery, the app shows an explicit unavailable notice.
- No numeric elevation DEM, grade, true hazard risk, energy prediction or NASA-grade route safety assessment is shipped.
- `supabase/schema.sql` is **not deployed**. Mission persistence is local to each browser; URL sharing copies a snapshot, not real-time multi-user collaboration.
- The "detour" is an illustrative geometric change, not an optimized path around a known obstacle.
- A custom Mars planetary-coordinate GeoJSON uses coordinate pairs that generic Earth GIS tools may wrongly interpret as WGS84; inspect the CRS note before loading.

## Submission priorities

1. Browser smoke test on the publicly deployed website (including mobile).
2. Check NASA WMTS actual tile coverage in Jezero and image attribution.
3. Save an example mission, export/import it, and re-open a shared link.
4. Record a short screen capture demonstrating the manually controlled workflow, inspection, and the limitations of the data.
