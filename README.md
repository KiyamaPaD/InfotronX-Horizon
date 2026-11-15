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

## The mathematics

Every number in Mars Atlas is either **measured** (from NASA or USGS data), **calculated** from the formulas below, an **illustrative scenario**, or your own note. The code that implements each formula is named next to it, and the worked examples are checked by an automated test (`tests/readme-math.test.mjs`), so this page cannot drift from the program.

### 1. Distance on Mars (`src/geo.js`)

Mars is treated as a sphere of radius $R = 3\,396\,190\ \text{m}$. For two points with latitudes $\varphi_1,\varphi_2$ and longitudes $\lambda_1,\lambda_2$, the great-circle distance uses the haversine formula:

$$a = \sin^2\!\frac{\varphi_2-\varphi_1}{2} + \cos\varphi_1\,\cos\varphi_2\,\sin^2\!\frac{\lambda_2-\lambda_1}{2}$$

$$d = 2R\,\arcsin\!\sqrt{a}$$

The length of a route with waypoints $P_0,\dots,P_n$ is the sum of its legs:

$$D = \sum_{i=1}^{n} d(P_{i-1},P_i)$$

Worked checks:

| Case | Result |
| --- | --- |
| $1^\circ$ of latitude, $2\pi R/360$ | $59\,274.7\ \text{m}$ |
| $1^\circ$ of longitude at $60^\circ$ latitude (half of the equator value) | $29\,637.1\ \text{m}$ |
| Two points in Jezero, $(18.4446^\circ,77.4509^\circ)$ and $(18.4500^\circ,77.4600^\circ)$ | $603.5\ \text{m}$ |
| Antipodal points, $\pi R$ | $10\,669.4\ \text{km}$ |

Mars is slightly flattened (polar radius about $0.994$ of the equatorial one). The distance formula ignores this; the error is below one percent. The 3D globe uses the flattened shape.

### 2. Slope and climb (`src/terrain.js`, `src/terrain-profile-v2.js`)

Between two samples of the height model, 20 m apart or more, the grade is

$$g = \frac{h_B-h_A}{d}\times 100\ \%$$

so a grade of $7.3\,\%$ means $7.3\ \text{m}$ of rise for every $100\ \text{m}$ travelled. Total climb and descent add up every positive and every negative change along the profile:

$$A=\sum \max(0,\Delta h),\qquad H=\sum \max(0,-\Delta h)$$

Heights come from the USGS CTX terrain model (20 m cells) and are relative to the Mars datum. Where the model has no data, the answer is "unknown", never "flat".

### 3. Route cost for the terrain planner (`src/terrain.js`, `src/route-decision.js`)

On the height grid, moving between neighbouring cells of length $d$ and grade $g$ costs

$$c = d\left(1+\lambda\,\frac{|g|}{100}\right) = d + \lambda\,|\Delta h|$$

because $\frac{|g|}{100}\,d=|\Delta h|$. Summed along a path this gives the cost shown as *Why this route?*:

$$C = D + \lambda\,(A+H)$$

$\lambda$ is the penalty, in metres of cost for each metre of height change. It is $0$ for *minimise distance*, $6$ for *balanced* and $24$ for *gentle*. Cells steeper than the chosen limit (18 % by default) and cells in exclusion zones are not entered. A\* finds the cheapest path among the cells it can reach, so it is the best of the routes the grid allows, not a proven safe route.

Example: a $100\ \text{m}$ step with a rise of $5\ \text{m}$ (grade $5\,\%$) and $\lambda=6$ costs $100\,(1+6\cdot 0.05)=130$, which equals $100+6\cdot5$.

Two routes are compared on the pair $(D,\ A+H)$. A route *dominates* another when it is no longer and has no more height change, and is strictly better in at least one of them. The routes nobody dominates form the Pareto set.

### 4. Time, oxygen and energy (`src/resources.js`)

An illustrative scenario with walking speed $v$ (km/h), time at stops $t_s$ (hours), oxygen use $r_{O_2}$ (kg/h) and power $P$ (W). If the way back retraces the route, the travelled distance is $D_{\text{travel}}=2D$, otherwise $D$.

$$t=\frac{D_{\text{travel}}/1000}{v}+t_s,\qquad m_{O_2}=t\,r_{O_2},\qquad E=t\,P$$

Usable amounts keep a reserve of $\rho\,\%$:

$$X_{\text{usable}} = X_{\text{available}}\left(1-\frac{\rho}{100}\right)$$

Defaults: $v=2.4$ km/h, $t_s=0.25$ h, $r_{O_2}=0.12$ kg/h, $P=280$ W, $1.2$ kg of oxygen, $2200$ Wh of battery, $\rho=25\,\%$, $8$ h maximum. The scenario is a planning illustration, not measured telemetry, and it ignores terrain.

Worked check, a $4.2\ \text{km}$ route with the way back: $D_{\text{travel}}=8.4$ km, $t=8.4/2.4+0.25=3.75$ h, $m_{O_2}=0.45$ kg against $0.9$ kg usable, $E=1050$ Wh against $1650$ Wh usable, and $3.75$ h against $6$ h usable.

### 5. Risk measures in the advanced lab (`src/advanced-math.js`)

The lab draws seeded synthetic variations of the resource inputs and reports the mean, the value at risk and the conditional value at risk at confidence level $\alpha$:

$$\mathrm{VaR}_\alpha = \text{the } \lceil \alpha N\rceil\text{-th smallest of } N \text{ samples},\qquad \mathrm{CVaR}_\alpha=\frac{1}{(1-\alpha)N}\sum_{\text{worst tail}} x$$

These describe hypothetical distributions. They are **not** NASA-calibrated probabilities and say nothing about the safety of a real extravehicular activity.

## What you can do

- **Plan directly on the map:** create missions, draw and edit routes, move/reorder waypoints, and attach observations and references. AI is not required.
- **Waypoint & Mission Editor V2:** edit point names, categories, notes, shapes, colors and precise coordinates; use map context actions and mission-scoped Undo/Redo. [Editing guide](docs/WAYPOINT_EDITOR_V2.md).
- **Compare route alternatives:** inspect A*, D* Lite replanning, bounded multi-objective route searches, and user-defined hypothetical exclusion zones.
- **Explain route decisions rigorously:** Why This Route? displays the A* objective `C = D + λ × (ascent + descent)`, Pareto trade-offs, model limitations and user-adjustable preference rankings. [Validation evidence](docs/JUDGE_SCIENTIFIC_VALIDATION.md).
- **Explore real terrain data:** study a limited-area USGS/NASA Mars Reconnaissance Orbiter CTX elevation clip near Jezero alongside NASA Mars Trek imagery layers.
- **Terrain Intelligence V2:** inspect an interactive elevation profile, compare waypoint altitude and mean segment grade, and locate numeric DEM samples directly on the map. [Terrain profile guide](docs/TERRAIN_INTELLIGENCE_V2.md).
- **Analyze terrain:** elevation and slope profiles, local roughness, line of sight, reachability, contours, and experimental scientific models.
- **Take your work with you:** Sign in once and your missions save automatically (guests are never saved). Mission Center groups checkpoints, exports, mission links and an authenticated cloud library with sharing by verified teammate email (no automatic email delivery).
- **See what's needed in Science:** Analytics provides an explicit guide for required waypoint counts, numeric DEM availability and route alternatives; tools can be expanded and opened without automatic sample points.
- **Visualize your mission graph:** a weighted waypoint-connectivity diagram complements the existing segment distances, elevation, slope/roughness, reachability, contour and route comparison charts.
- **Create a private Crew Profile:** signed-in Mars Atlas accounts can save a callsign, mission role, interests, biography and an optional private profile image. Roles are user-supplied, not NASA credentials. [Crew profile documentation](docs/CREW_PROFILES.md).
- **Team chat for shared missions:** owner/viewer/editor collaboration conversations in Mission Center with Supabase RLS, anti-spam, block, report and message deletion. **Global chat remains off** until staffed moderation is ready.
- **Interactive numeric 3D terrain:** WebGL rendering of valid DEM mesh triangles, with user-controlled orientation, zoom and vertical exaggeration. NoData cells remain blank and the original 2D terrain tools still work without WebGL.
- **Route insights:** compact distance, terrain coverage, comparison and resource cards calculated from the current mission. No account or language model is required.

## Explore and analyze

The map uses the NASA Viking global color mosaic as its default (zoom 3–7). In the HiRISE Jezero mode, zoom 8 remains a continuous Viking overview without an isolated CTX rectangle; from zoom 9–11, NASA CTX Jezero 6 m/pixel and HiRISE 25 cm/pixel images provide higher-resolution context with feathered geographic coverage boundaries. MOLA Relief is a separate basemap. The legacy CTX beta imagery was retired from the map because its original strips and color seams persisted at all zoom levels. NASA WMTS metadata, caching and progressive tile previews remain supported. Outside HiRISE's mapped footprint, Viking imagery appears as clearly identified lower-resolution context; enlarged imagery is not a new observation. Science tools are organized into **Overview**, **Terrain**, **Models** and **Mission**, with quick access to individual calculations. Route geometry remains fully editable without an AI assistant.

## Current product status

| Area | Status |
| --- | --- |
| Code and automated verification | Available; GitHub Actions runs on pushes to `main` |
| Manual mission workspace and analysis modules | Implemented; team browser testing in progress |
| NASA/USGS DEM | Bundled numerical clip, **not** a complete Jezero elevation survey |
| NASA background maps | External image services; actual tile loading depends on connectivity |
| Mission saving | Guests: not saved. Signed-in users: automatic cloud saving with a device copy, plus user exports |
| Team account access | Authenticated cloud save/open with per-mission viewer/editor roles; email-based viewer/editor access (no automatic invitation emails); real-user flows need verification |
| Live simultaneous editing | **Not implemented** — cloud snapshots are opened and saved explicitly. Team chat uses Realtime independently of document editing |
| Mission chat | RLS-protected conversations for cloud mission members; real two-account production test pending |
| Global chat | Disabled until moderation and abuse response are staffed |
| Route insights | Local metric cards, terrain coverage and resource scenarios; no language model |
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

Local development uses native browser JavaScript modules without compilation. For Netlify, run `npm run build`: the static site is written to `dist/`, excluding internal documentation, SQL, tests and server functions. Deploy only that folder. The ready-to-upload archive is [releases/mars-atlas-netlify.zip](releases/mars-atlas-netlify.zip); extract it and upload the folder containing `index.html` to the existing Netlify site.

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
