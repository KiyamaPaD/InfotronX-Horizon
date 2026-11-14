# InfotronX Horizon — release checklist

## Current environment

- Repository: https://github.com/KiyamaPaD/Mars-Atlas (`main`)
- Vercel project: `mars-atlas`
- Production alias: https://mars-atlas-mu.vercel.app
- Domain purchase: planned for later

Every push to `main` can deploy automatically. No PR/merge phase is required; **local review happens before pushing**, and the GitHub Actions result is checked immediately afterward.

## Before push

1. Pull recent changes from `main`, ensure no teammate is editing the same shared area.
2. Run `npm test` and `node --check` for modified JS modules.
3. Perform the related manual UI flows in desktop and mobile views; record reproduction steps for any failures.
4. Check source attribution, numerical units, missing-data behavior, and the distinction between measured and modeled outputs.
5. Commit a focused, comprehensible change.

## After push

1. Confirm GitHub Actions Verify is green for the actual commit.
2. Confirm Vercel's latest **production** deployment is READY for the same commit.
3. Open the production alias in a private browser window. Test routes, exports, DEM loading, map tiles and mobile navigation.
4. Ask a teammate to run [BETA_TESTING.md](BETA_TESTING.md) and open Issues for failures.

## Access and rollback

If a teammate sees Vercel Authentication, share access via the deployment's **Share → Anyone with the link** option, or change protection only after deliberate team approval. Do not assume the unique deployment URL is the public production URL.

If a push breaks production, identify the last verified working commit/deployment and roll back via the Vercel dashboard. Do not rewrite shared Git history to conceal mistakes.

Vercel hosts only the frontend; cloud accounts and real-time collaborative missions need a future backend.
