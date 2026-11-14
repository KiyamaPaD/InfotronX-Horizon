# InfotronX Horizon — team workflow

**Repository:** https://github.com/KiyamaPaD/Mars-Atlas  
**Primary branch:** `main`  
**Integration policy:** direct commits; no required Pull Requests or branch merges.

## Daily routine

1. Pick/assign a GitHub Issue and agree who edits each shared file.
2. Run `git pull --ff-only origin main` before making changes.
3. Work on a small change, run `npm test`, syntax checks, and relevant real-browser tests.
4. Commit with an informative message. Rebase on updated `main` before pushing if necessary.
5. Push to `main`. Check GitHub Actions and the deployment; tell the team what changed and whether anything remains broken.
6. If a conflict appears or another teammate is editing the same entry point, coordinate instead of force-pushing.

## Ownership map

| Area | Files |
| --- | --- |
| GIS and source attribution | `src/map.js`, `src/constants.js`, `NASA_DATA.md` |
| Mission data | `src/store.js`, `src/share.js`, `src/inspector.js` |
| Mathematics / routing | `src/terrain.js`, `src/dstar-lite.js`, `src/pareto-routes.js` |
| UI / mobile | `src/main.js`, `src/design.css`, `src/science.css` |
| Tests / deploy / documentation | `tests/`, `.github/workflows/`, `docs/` |

The owner of `src/main.js` should coordinate integrations when multiple modules touch it. No teammate should erase another's work by resetting or force-pushing shared history.

## Testing and release

Use [BETA_TESTING.md](BETA_TESTING.md) for a reproducible test pass. Report defects in Issues, not only via chat. The new Vercel project is wired to `main`; each push may update the deployment even before CI finishes. Test first, verify again afterward.

The prior V3–V9 branch/review reports are historical references, not steps to execute now.
