# Contributing to Mars Atlas

Thank you for helping. Mars Atlas is an InfotronX Horizon project and a planning aid, so correctness and honest labelling matter more than speed.

## Quick start

```bash
git clone https://github.com/KiyamaPaD/Mars-Atlas.git
cd Mars-Atlas
npm run dev        # serves http://localhost:4173
npm test           # unit and structure tests (Node 22+)
```

There is no build step. The site is native browser JavaScript modules.

## How we work

1. Read [README](README.md), [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) and [docs/DEVELOPMENT_STANDARDS.md](docs/DEVELOPMENT_STANDARDS.md).
2. Pick one task, or open an Issue first for anything large. Say which files you expect to touch.
3. Work on a short branch from `main` (for example `fix/map-tile-retry` or `feature/route-diff`).
4. Keep the change small. Do not edit modules unrelated to your task.
5. Run `npm test`. For anything on the map or in 3D, also run the browser smoke test (`node scripts/map-browser-smoke.mjs` with the dev server running) or put `[browser]` in the commit message so the CI job runs it.
6. Open a Pull Request into `main`. Describe what changed, why, how you tested it and what is not verified. The team can still agree to commit small fixes straight to `main`; say so in the Issue.
7. After merging, check that GitHub Actions is green.

## Code style

- Native JavaScript, **Allman braces**, natural function names, short expressions on one line.
- Few comments: only for the mathematics, the data source and trade-offs.
- Physical units in names or comments (metres, degrees, percent). Distances use the Mars radius 3,396,190 m.
- Everything about missions, routes, waypoints and observations must work **without AI** (manual-first).

## Interface text

- Written for a finished product: no "beta", "TODO", "admin side" or internal version numbers.
- Say **measured**, **calculated**, **illustrative** or **user note**, and never "optimal" unless it is proven. Use "the best of the routes you calculated".
- Never present anything as certified or approved by NASA or another agency.

## Data and credit

- Every dataset needs a source and a credit in [CREDITS.md](CREDITS.md) and [NASA_DATA.md](NASA_DATA.md).
- Do not copy imagery or data into the repository unless its licence allows it.

## Security and privacy

- Never commit keys, passwords or tokens.
- Do not weaken Supabase row-level security policies and do not re-run migrations from `local-sql/` on the live project.
- A new feature that stores data or calls another service must be added to [PRIVACY.md](PRIVACY.md) and [COOKIES.md](COOKIES.md).

## AI-assisted contributions

You may use AI tools. You are responsible for the result: read it, test it, and understand it. Add the tool to [docs/AI_USE_AND_SOURCES.md](docs/AI_USE_AND_SOURCES.md) if it is new, and keep the `Co-Authored-By` line in commits where the tool wrote code.

## Reporting problems

Use the issue templates: [Bug report](https://github.com/KiyamaPaD/Mars-Atlas/issues/new?template=bug_report.md), the map-specific `bug_harta` template, or a [Feature request](https://github.com/KiyamaPaD/Mars-Atlas/issues/new?template=feature_request.md). Include browser, layer, zoom, coordinates, steps and a screenshot.

## Licence of contributions

By contributing you agree that your work is released under the project's [MIT licence](LICENSE).

## Work areas

| Area | Examples |
| --- | --- |
| GIS / planetary data | NASA and USGS source tracing, map layers, DEM import |
| Routes / mathematics | Routing, reprojection, numerical tests, error handling |
| Product / interface | Mission editor, usability, accessibility, mobile layout |
| Release / quality | Browser smoke tests, GitHub Actions, deployment |
| Science / presentation | Research, assumptions, citations, demo narrative |
