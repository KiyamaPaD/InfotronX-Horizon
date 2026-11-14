# Contributing to Mars Atlas

Mars Atlas is an InfotronX Horizon project. We work on the single `main` branch without mandatory Pull Requests or merge commits. Coordinate changes before editing shared files.

## Getting started

1. Read `README.md`, `docs/PROJECT_STATE.md`, `docs/DEVELOPMENT_STANDARDS.md`, and the relevant GitHub Issue.
2. Pick one task and tell the team which files you expect to edit.
3. Clone `https://github.com/KiyamaPaD/Mars-Atlas.git` and work from `main`.
4. For UI changes, check desktop **and** a narrow mobile viewport; for mathematical changes, add deterministic tests.

## Safe direct-to-main routine

```bash
git switch main
git pull --ff-only origin main
# Make a focused change and test it locally.
npm test
git add -A
git commit -m "fix: describe the problem solved"
git pull --rebase origin main
npm test
git push origin main
```

If the pull/rebase finds overlapping edits, **stop and coordinate with the other contributor**. Resolve conflicts carefully; never use a force push to overwrite a teammate's work. Ask the maintainer before making a major change or altering deployment settings.

Every push may update the live Vercel site. Keep commits small, check the Actions result after pushing, and post a quick note with the commit hash and what you tested. If CI fails, fix the issue promptly.

## Work areas

| Area | Examples |
| --- | --- |
| GIS / planetary data | NASA and USGS source tracing, map layers, DEM import |
| Routes / mathematics | Routing, reprojection, numerical tests, error handling |
| Product / interface | Mission editor, usability, accessibility, mobile layout |
| Release / quality | Browser smoke tests, GitHub Actions, Vercel |
| Science / presentation | Research, assumptions, citations, demo narrative |

## Standards

Use readable native JS, Allman braces, short expressions on one line, clear physical units, and truthful data provenance. Do not commit API keys, passwords, cookies, personal information, or unlicensed assets. A successful unit test is **not** proof that the app works on every device.

To report a problem, follow [Beta testing](docs/BETA_TESTING.md) and open a [Bug report](https://github.com/KiyamaPaD/Mars-Atlas/issues/new?template=bug_report.md).
