# InfotronX Horizon — development workflow

Mars Atlas is developed in one shared GitHub repository with a tracked history of tasks, branches, commits and reviews.

## Everyday workflow

1. Select a GitHub issue and leave a comment assigning yourself the scope.
2. Create one short-lived branch from the owner-approved integration branch.
3. Implement a small, testable change in your own files; coordinate before editing shared entry points.
4. Run `npm test`, syntax checks and relevant browser tests.
5. Open a Pull Request that names the issue, changed interfaces, results and remaining blockers.
6. Ask another teammate for review, apply feedback and merge only through the approved integration flow.
7. If unfinished, write a short handoff with exact commit SHA, next step and known limitations.

## Workstreams

| Area | Files |
| --- | --- |
| GIS and NASA sources | `src/map.js`, `src/constants.js`, `src/dem-audit.js`, `NASA_DATA.md` |
| Mission data and export | `src/store.js`, `src/share.js`, `src/inspector.js` |
| Mathematics and routing | `src/terrain.js`, `src/dstar-lite.js`, `src/pareto-routes.js`, `src/advanced-math.js` |
| UI, accessibility and mobile | `src/main.js`, `src/design.css`, `src/science.css` |
| Quality, hosting and release | `tests/`, `.github/workflows/`, `docs/RELEASE_RUNBOOK.md` |

If two tasks need `src/main.js`, one integrator controls that entry point and other contributors expose modular interfaces. Avoid unrelated changes within the same PR.

## Release

`main` becomes the canonical production source only after the consolidated candidate is reviewed and accepted. Historical V4–V9 branches are preserved for audit, not merged repeatedly. One release owner confirms the production deployment, dataset citations and submission completeness.

For a detailed workflow see `CONTRIBUTING.md` and `docs/DEVELOPMENT_STANDARDS.md`.
