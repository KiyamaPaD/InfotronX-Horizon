# Mars Atlas work queue

Open or claim a linked GitHub issue before implementing. This file summarizes priorities, not unassigned promises. Assign exact owners only after they accept.

## P0: blocking a credible final demo

| Work item | Why it matters | Area | Done when |
| --- | --- | --- | --- |
| [Map service live audit](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/1) | An empty or wrongly projected map ruins the scientific demo | GIS | NASA tile layer visible and metadata/coverage/CRS documented from real browser |
| [Challenge Resources check](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/1) | Awards eligibility and scientific integrity | Research | Exact NASA dataset listed in challenge Resources verified and cited in project |
| [Mission smoke test](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/2) | Prevents visible breakage | QA | Draw/move/reorder/export/import/reload/share and mobile tested on deployed URL |
| [Demo story + evidence chain](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/3) | Judges need a clear reason to care | Science/product | A truthful two-route walkthrough showing what source changed the plan |

## P1: high-value if P0 is stable

| Work item | Value | Prerequisite |
| --- | --- | --- |
| [Route change explanation](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/5) | Show point-by-point *why* new route differs, with citations and uncertainty | Stable route compare + evidence records |
| [Local DEM elevation profile](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/6) | Real distance–elevation plot and grade, not painted hillshade guesses | Region DEM download, Mars CRS + datum validation |
| [Shared georeferenced observations](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/7) | One researcher's find can inform another's plan | Dedicated Supabase instance, auth & RLS, quota decision |
| [Mission provenance ledger](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/5) | Source/instrument/resolution of each data-backed claim | NASA source catalog and schema |
| One-click briefing PDF/Markdown | Explain constraints, assumptions and missing data to judges | Valid mission exports |

## P2: meaningful stretch features

- Return-to-start feasibility with **illustrative parameters clearly named**, never flight safety approval.
- 3D terrain only if the DEM and projection are truly available and time remains.
- Offline mobile field package or resilient map caching with NASA attribution and storage limits.
- Readable multi-user activity history and checkpoint diff viewer.

## Not accepted for a 48-hour build by default

- Decorative 3D globe with false scientific precision.
- Invented Mars hazard scores based only on RGB imagery.
- A full rewrite to React/TypeScript before the map/data demo is validated.


## V5 feature branch review

- [Issue #9 · DEM A* graph routing](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/9) — algorithm implemented and unit-tested on synthetic fixtures; **real Jezero DEM still missing**.
- [Issue #10 · Illustrative Marswalk resources](https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026/issues/10) — model implemented with explicit user assumptions and test coverage; **not NASA life-support telemetry**.
