# Mars Atlas — current team state

**Owner / team identity:** InfotronX Horizon · **season 2026–2027**  
**Challenge:** NASA Space Apps Challenge **2026**  
**Repository currently hosted at:** https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026

## Branches

- `main` — existing production V3.1, deployed at https://mars-atlas-nasa-2026.vercel.app.
- `team/relaunch-candidate` — consolidated V9 candidate and contributor setup, PR #27, not merged.
- `brand/infotronx-horizon` — proposed team branding and public documentation; separate review branch.
- `feature/team-algorithms-v9` and earlier V4–V9 branches — retained for history, not to be merged a second time.

V9 preview: https://mars-atlas-nasa-2026-mmayo5ed1-kiyama1.vercel.app  
Team-relaunch preview: https://mars-atlas-nasa-2026-jz8zcij5x-kiyama1.vercel.app

## What exists

A manual Mars mission planner with browser-local mission storage, checkpoints, imports/exports, NASA imagery, a limited real numeric USGS MRO CTX Jezero DEM sample, A*/D* Lite/Pareto, spherical area and contours, reachability, terrain topology and scenario calculations. The scientific models are exploratory; a source-derived elevation is not a real-world hazard assessment.

Last confirmed V9 baseline: 118/118 Node tests. Each new branch must rerun checks and document actual results.

## What is not operational

No dedicated account-based mission storage, realtime edits, production-calibrated EVA models, co-registered HiRISE accuracy reference or proof of complete deployed mobile/desktop end-to-end functionality. The existing Vercel project is in a one-member Hobby team; Git integration and account permissions must be reviewed separately.

## Next actions

1. Review the V9 consolidated candidate and branding PR.
2. Create an **InfotronX Horizon** GitHub organization if a suitable slug is available.
3. Back up and transfer the existing repository without deleting history.
4. Invite teammates with `Write`, protect `main`, and set required CI + approvals.
5. Review Vercel Git integration and a separate staging deployment.
6. Confirm NASA challenge dataset eligibility and full final acknowledgments.
