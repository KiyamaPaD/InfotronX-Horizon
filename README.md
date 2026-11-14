# Mars Atlas

**A planetary mission-planning and terrain intelligence platform by InfotronX Horizon.**

**NASA Space Apps Challenge 2026** · **InfotronX Horizon team season 2026–2027**

Mars Atlas helps explorers create, inspect, compare and revise mission routes across Jezero Crater using public NASA/USGS planetary data and transparent mathematical models. The project is created by the **InfotronX Horizon** team; it is an independent challenge entry, not an official NASA navigation product.

## Explore

- **Latest V9 research preview:** https://mars-atlas-nasa-2026-mmayo5ed1-kiyama1.vercel.app
- **InfotronX Horizon team-relaunch preview:** https://mars-atlas-nasa-2026-jz8zcij5x-kiyama1.vercel.app
- **Existing production (V3.1):** https://mars-atlas-nasa-2026.vercel.app

The current `brand/infotronx-horizon` branch is **a review candidate**, not production. The `main` branch remains at V3.1 until team review and release approval.

## What Mars Atlas does

- **Mission Workspace:** manually draw and edit routes, reorder waypoints, add observations and evidence links, save checkpoints, compare alternatives, import/export JSON and GeoJSON, and copy shareable mission links.
- **NASA/USGS imagery and elevations:** NASA Mars Trek CTX/MOLA/Viking background imagery and a real, limited-area USGS Mars Reconnaissance Orbiter CTX Jezero digital terrain model.
- **Routing:** A*, D* Lite incremental route updating, bounded multi-objective Pareto exploration and hypothetical no-go zones.
- **Terrain intelligence:** slope, local roughness, line of sight, altitude profiles and time-reachability maps.
- **Advanced mathematics:** spherical surface-area measurement, Haar multi-resolution altitude contrasts, area-weighted hypsometry, elevation contours, CVaR and Wasserstein scenario comparisons, and terrain topology.

These are **educational and exploratory models**, not certified astronaut/rover guidance, real oxygen telemetry, field-verified hazards or medical risk probabilities. The CTX elevation dataset is authentic; inferred model results have additional assumptions.

## Run locally

Requires Node.js 22+ for tests, Python 3 for the local web server and Git.

```bash
git clone https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026.git
cd Mars-Atlas-NASA-2026
git switch brand/infotronx-horizon
python3 -m http.server 4173
```

Visit http://localhost:4173. Run `npm test` to execute the test suite. All runtime code uses native browser ES modules; no production install/build step is needed.

## Team development

**Team:** InfotronX Horizon · **Project:** Mars Atlas · **Season:** 2026–2027.

Every teammate uses their own GitHub account. Assign an issue, create a feature branch, commit a small and testable change, then submit a Pull Request for review. Release changes are approved by maintainers, not pushed directly to production.

- [Team setup and permissions](docs/TEAM_SETUP.md)
- [Contribution guide](CONTRIBUTING.md)
- [Development standards](docs/DEVELOPMENT_STANDARDS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Current project state](docs/PROJECT_STATE.md)
- [Release and hosting guide](docs/RELEASE_RUNBOOK.md)
- [Review checklist](docs/REVIEW_RUNBOOK.md)

A future GitHub organization may use the slug **`InfotronX-Horizon`**, subject to availability and creation by the team owner. This repository is **currently still owned by `KiyamaPaD`**. Do not delete it while transferring; preserve commits, issues and review history.

## Hosting and backend

The frontend currently runs as a static site on Vercel. Missions are stored in browser `localStorage` with user-triggered exports and link-based copies; **live account synchronization is not implemented**. `supabase/schema.sql` is a proposed design, not an active database or authentication service. Hosting and cloud collaboration are separate projects.

## Data, attribution and limitations

Source: USGS Astrogeology / NASA Mars Reconnaissance Orbiter CTX Jezero DTM, Fergason et al. (2020), DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8); NASA Mars Trek imaging services. See [NASA_DATA.md](NASA_DATA.md) and [science validation](docs/SCIENCE_VALIDATION.md).

The repository's MIT license covers original Mars Atlas source code, not automatically the licenses or attribution requirements of separately obtained data and media. The [submission document](SUBMISSION.md) contains the final project credits and tool acknowledgments.

## Project structure

| Area | Files |
| --- | --- |
| Browser mission interface | `index.html`, `src/main.js`, `src/design.css`, `src/store.js` |
| Planetary map and routing | `src/map.js`, `src/geo.js`, `src/terrain.js`, `src/dstar-lite.js` |
| Scientific algorithms | `src/measure-theory.js`, `src/advanced-math.js`, `src/terrain-topology.js` |
| Research interfaces | `src/science-workbench.js`, `src/mission-research-ui.js` |
| Real numeric terrain | `assets/jezero_ctx_trn_dem_20m_clip.json` |
| Verification | `tests/`, `.github/workflows/verify.yml` |
| Project documentation | `docs/`, `SUBMISSION.md`, `NASA_DATA.md` |

Historical V3–V9 engineering reports remain under `docs/` for review.
