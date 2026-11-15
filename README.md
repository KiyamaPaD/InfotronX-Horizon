# Mars Atlas

**Explore Jezero. Plan a route. Understand the terrain.**

Mars Atlas is a manual-first Mars mission-planning workspace. Draw a route across Jezero Crater, read its distance, slopes and heights from public NASA and USGS data, compare alternatives and see it in 3D. Built by **InfotronX Horizon** for the NASA Space Apps Challenge 2026.

[![Verify](https://github.com/KiyamaPaD/Mars-Atlas/actions/workflows/verify.yml/badge.svg)](https://github.com/KiyamaPaD/Mars-Atlas/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**[Open Mars Atlas](https://mars-atlas-map.netlify.app/)** · [Releases](https://github.com/KiyamaPaD/Mars-Atlas/releases) · [Changelog](CHANGELOG.md) · [Credits](CREDITS.md) · [Report a bug](https://github.com/KiyamaPaD/Mars-Atlas/issues/new?template=bug_report.md)

> Mars Atlas is an independent educational project. It is a planning aid, **not** a navigation tool, and it is **not** certified, endorsed or approved by NASA.

## How it works

1. **Explore:** start on the welcome screen, then look around Jezero and pick a map layer.
2. **Plan:** click the map to place waypoints, drag them to adjust, add observations.
3. **Analyze:** follow six explained steps (size, height, legs, comparison, 3D, decision) with charts and a checklist. Every number is labelled measured, calculated, illustrative or your own note.

The "All tools" view keeps the full science, math and resource workspace.

## What you can do

- **Plan directly on the map:** create missions, draw and edit routes, move/reorder waypoints, and attach observations and references. AI is not required.
- **Waypoint & Mission Editor V2:** edit point names, categories, notes, shapes, colors and precise coordinates; use map context actions and mission-scoped Undo/Redo. [Editing guide](docs/WAYPOINT_EDITOR_V2.md).
- **Compare route alternatives:** inspect A*, D* Lite replanning, bounded multi-objective route searches, and user-defined hypothetical exclusion zones.
- **Explain route decisions rigorously:** Why This Route? displays the A* objective `C = D + λ × (ascent + descent)`, Pareto trade-offs, model limitations and user-adjustable preference rankings. [Validation evidence](docs/JUDGE_SCIENTIFIC_VALIDATION.md).
- **Explore real terrain data:** study a limited-area USGS/NASA Mars Reconnaissance Orbiter CTX elevation clip near Jezero alongside NASA Mars Trek imagery layers.
- **Terrain Intelligence V2:** inspect an interactive elevation profile, compare waypoint altitude and mean segment grade, and locate numeric DEM samples directly on the map. [Terrain profile guide](docs/TERRAIN_INTELLIGENCE_V2.md).
- **Analyze terrain:** elevation and slope profiles, local roughness, line of sight, reachability, contours, and experimental scientific models.
- **Take your work with you:** Mission Center groups on-device autosave, checkpoints, exports, mission links and an authenticated cloud library with sharing by verified teammate email (no automatic email delivery).
- **See what's needed in Science:** Analytics provides an explicit guide for required waypoint counts, numeric DEM availability and route alternatives; tools can be expanded and opened without automatic sample points.
- **Visualize your mission graph:** a weighted waypoint-connectivity diagram complements the existing segment distances, elevation, slope/roughness, reachability, contour and route comparison charts.
- **Create a private Crew Profile:** signed-in Mars Atlas accounts can save a callsign, mission role, interests, biography and an optional private profile image. Roles are user-supplied, not NASA credentials. [Crew profile documentation](docs/CREW_PROFILES.md).
- **Team chat for shared missions:** owner/viewer/editor collaboration conversations in Mission Center with Supabase RLS, anti-spam, block, report and message deletion. **Global chat remains off** until staffed moderation is ready.
- **Interactive numeric 3D terrain:** WebGL rendering of valid DEM mesh triangles, with user-controlled orientation, zoom and vertical exaggeration. NoData cells remain blank and the original 2D terrain tools still work without WebGL.
- **Optional Mission Copilot:** deterministic local analysis without authentication, plus a consent-based read-only AI explanation endpoint. The AI model needs a **server-side** API key configured by the project owner; no external AI answer is assumed live yet. [Collaboration, AI and 3D instructions](docs/COLLAB_AI_3D_V2.md).

## Explore and analyze

The map uses the NASA Viking global color mosaic as its default (zoom 3–7). In the HiRISE Jezero mode, zoom 8 remains a continuous Viking overview without an isolated CTX rectangle; from zoom 9–11, NASA CTX Jezero 6 m/pixel and HiRISE 25 cm/pixel images provide higher-resolution context with feathered geographic coverage boundaries. MOLA Relief is a separate basemap. The legacy CTX beta imagery was retired from the map because its original strips and color seams persisted at all zoom levels. NASA WMTS metadata, caching and progressive tile previews remain supported. Outside HiRISE's mapped footprint, Viking imagery appears as clearly identified lower-resolution context; enlarged imagery is not a new observation. Science tools are organized into **Overview**, **Terrain**, **Models** and **Mission**, with quick access to individual calculations. Route geometry remains fully editable without an AI assistant.

## Current product status

| Area | Status |
| --- | --- |
| Code and automated verification | Available; GitHub Actions runs on pushes to `main` |
| Manual mission workspace and analysis modules | Implemented; team browser testing in progress |
| NASA/USGS DEM | Bundled numerical clip, **not** a complete Jezero elevation survey |
| NASA background maps | External image services; actual tile loading depends on connectivity |
| Mission saving | Browser-local storage, user exports and an optional authenticated Supabase cloud library |
| Team account access | Authenticated cloud save/open with per-mission viewer/editor roles; email-based viewer/editor access (no automatic invitation emails); real-user flows need verification |
| Live simultaneous editing | **Not implemented** — cloud snapshots are opened and saved explicitly. Team chat uses Realtime independently of document editing |
| Mission chat | RLS-protected conversations for cloud mission members; real two-account production test pending |
| Global chat | Disabled until moderation and abuse response are staffed |
| AI Copilot | Deterministic local report works now; external LLM requires a server-side `OPENAI_API_KEY` |
| WebGL 3D terrain | Implemented numeric mesh; degraded 2D mode remains when WebGL is unsupported |
| Rover/astronaut safety certification | **Not provided** |

The scientific analyses are educational approximations, not real mission-operational hazard measurements, EVA medical advice, or safety approvals. Scenario assumptions must not be confused with source measurements.

## Try the project locally

Requires **Git** and **Node.js 22+**. The development server uses Python 3 (`npm run dev`).

```bash
git clone https://github.com/KiyamaPaD/Mars-Atlas.git
cd Mars-Atlas
npm run dev
```

Open `http://localhost:4173` in your browser. In another terminal:

```bash
npm test
```

The website uses native browser JavaScript modules and does not need an npm build step.

## Contribute

Short branches and Pull Requests into `main`, with `npm test` passing. See [CONTRIBUTING](CONTRIBUTING.md), [Engineering standards](docs/DEVELOPMENT_STANDARDS.md) and [Current state](docs/PROJECT_STATE.md).

## Technical structure

| Area | Primary files |
| --- | --- |
| Main UI / mission controls | `index.html`, `src/main.js`, `src/design.css` |
| Mission data and export | `src/store.js`, `src/share.js` |
| Mapping, terrain, routing | `src/map.js`, `src/terrain.js`, `src/dstar-lite.js`, `src/pareto-routes.js` |
| Science / numerical analysis | `src/science-workbench.js`, `src/advanced-math.js`, `src/terrain-topology.js` |
| CTX elevation sample | `assets/jezero_ctx_trn_dem_20m_clip.json` |
| Automated tests | `tests/`, `.github/workflows/verify.yml` |
| Data provenance and project credits | `NASA_DATA.md`, `SUBMISSION.md`, `docs/SCIENCE_VALIDATION.md` |

Scientific methodology, data references and engineering notes are available in the documentation directory. The active map architecture, NASA source URLs and Chromium tests are documented in [Map engine](docs/MAP_ENGINE.md). Independent A*, D* Lite and Pareto verification is described in [Route validation](docs/ROUTING_VALIDATION.md).

## Sources and acknowledgments

The numeric terrain clip derives from the **USGS Astrogeology / NASA MRO CTX Mars 2020 Terrain Relative Navigation DTM** (Fergason et al., 2020), [DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). Basemap imagery is served through NASA Mars Trek. For technical attribution and modeled-versus-observed limitations, see [NASA_DATA.md](NASA_DATA.md) and [Science validation](docs/SCIENCE_VALIDATION.md). The project's software license does not replace third-party data/imagery licenses.

**InfotronX Horizon** is an independent team. The clean Git repository is a publication reset, **not evidence that all components were written during the hackathon**. See [Submission readiness](docs/SUBMISSION_READINESS.md) for the official timing and source-eligibility considerations. Tools and contributors are acknowledged in [SUBMISSION.md](SUBMISSION.md).

## Imagery consistency

The Viking global basemap remains the default. HiRISE Jezero imagery is grayscale PNG with transparency, so Viking context is retained below its transparent pixels and tinted consistently in the HiRISE view. The MOLA Relief option now uses NASA's monochrome MOLA/HRSC hillshade blend rather than the older colored elevation shading. The correct image formats are used to avoid unnecessary failed requests. These map layers are visual context, not certified terrain safety maps.

The background renderer never requests Viking zoom 8: a real Chromium network check found HTTP 404 at that level over Jezero, while level 7 returned real NASA imagery. HiRISE zoom 8–11 keeps a separate continuous Viking level-7 background, with genuine HiRISE overlays at 9–11. This avoids repeated enlarged parent tiles and unnecessary network retries.

**Jezero photo-context improvement:** The former sharp HiRISE-versus-Viking visual boundary now has an internal, geographically aligned NASA/USGS controlled CTX Jezero photographic layer between them. It uses genuine PNG tiles (6 m/pixel) with their original alpha; it is distinct from the removed global CTX beta mosaic. Coverage gaps outside the controlled CTX footprint still use Viking at its actual source resolution. See [Map engine](docs/MAP_ENGINE.md).

## Legal

- Licence: [MIT](LICENSE). Copyright (c) 2026 InfotronX Horizon and Mars Atlas contributors.
- [Terms of Use](TERMS.md) · [Privacy Policy](PRIVACY.md) · [Cookies and local storage](COOKIES.md) · [Credits](CREDITS.md)
- The same pages are available inside the app at `legal.html`.

## Releases

Versions are tagged `vMAJOR.MINOR.PATCH`. Release notes are in [docs/](docs/) and the [Changelog](CHANGELOG.md). The release steps are in [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md).
