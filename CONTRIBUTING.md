# Contributing — InfotronX Horizon / Mars Atlas

Mars Atlas is developed as a team project. Everyone contributes through their own GitHub identity, an assigned issue and a reviewed Pull Request.

## Start here

1. Accept your invitation to the repository or the future InfotronX Horizon GitHub organization.
2. Read `README.md`, `docs/PROJECT_STATE.md`, `docs/DEVELOPMENT_STANDARDS.md` and your assigned issue.
3. Confirm your integration base with a maintainer. During this transition, `brand/infotronx-horizon` is a review branch; do **not** build from old `design-v4` or merge directly into `main`.
4. Claim a defined scope and avoid simultaneous edits to the same shared module.

## Implement and review

```bash
git fetch origin
git switch brand/infotronx-horizon
git pull --ff-only
git switch -c feat/<your-username>-<issue>
# Implement and test
npm test
git add .
git commit -m "feat: describe the change"
git push -u origin HEAD
```

The branch name above contains placeholders; replace them with your own values.

Open a PR into the agreed base, describe changes and research sources, include tests and a screenshot for visual work, and request review. Allman braces, readable modular code, and precise mathematical units are required. Don't force-push shared branches, commit credentials or deploy production without approval.

## Team responsibilities

- **GIS/data:** coordinate systems, source provenance, NASA map layers and elevation models.
- **Algorithms:** routing, numerical mathematics and scientific test cases.
- **Application:** mission state, import/export, checkpoints and accessibility.
- **Infrastructure:** GitHub CI, deployment, release verification and future authenticated persistence.
- **Science/story:** data citations, demonstration and submission documentation.

Any teammate may own a workstream if coordinated in GitHub. A contributor's actual work is recorded through commits and reviewed PRs.

## Verification

Local development uses `python3 -m http.server 4173` and `npm test`; the frontend has no runtime npm dependencies. Before merging, run JavaScript syntax checks and test the affected flows in a real browser. For scientific changes, include formulas, physical units, NoData behavior, uncertainties and an independent regression case.

## Permissions

Use `Write` for contributors and reserve `Admin` for trusted maintainers. GitHub, Vercel and any future cloud database have separate permissions and invitations. Never share account passwords, tokens, environment variables or billing credentials.
