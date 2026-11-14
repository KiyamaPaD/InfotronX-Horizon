# InfotronX Horizon — release runbook

## Current environments

- Production: https://mars-atlas-nasa-2026.vercel.app (**V3.1**)
- Consolidated V9 preview: https://mars-atlas-nasa-2026-mmayo5ed1-kiyama1.vercel.app
- InfotronX Horizon candidate: `brand/infotronx-horizon` (no production changes)

## Before approval

1. Run `npm test`, `node --check` for all source modules and GitHub Actions Verify.
2. Test the deployed preview in a real desktop and mobile browser: Jezero DEM loader, map layers, manual waypoint editing, alternative routing, checkpoints and JSON/GeoJSON export.
3. Verify original NASA/USGS source attributions, planetocentric coordinate conventions and limits of every calculated science result.
4. Collect screenshots and a concise bug list in the Pull Request.
5. Obtain a reviewer and release-owner approval; do not bypass checks.

## Repository migration

Transfer the existing GitHub repository to an InfotronX Horizon organization after backup and approval. Verify Git remotes and restore preview deployments; keep PRs and issues. Confirm which Git branch becomes the production source.

## Deployment

Current static Vercel project uses the `kiyama1` Hobby account. Choose between linking its existing Git repository (only after signoff) or setting up a separate staging project that automatically produces PR previews. Confirm expected domain, branch and costs.

Vercel only hosts the frontend; user accounts and shared mission storage require a separate backend and access-control project.

## Rollback

Keep the previous production deployment and commit reference until the new release has been tested in production. Never delete the only working version.
