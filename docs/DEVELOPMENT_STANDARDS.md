# InfotronX Horizon — engineering standards

## Code

- Native JavaScript modules and small, named functions with meaningful domain names.
- Allman braces for functions, branches, loops and classes.
- Simple math and assignments stay on one line (`total += distance;`).
- Minimal comments; explain formulas, non-obvious trade-offs and data provenance.
- Deterministic regression tests for algorithms and numerical calculations.
- Responsive mobile layout, keyboard accessibility and sensible error states.

## Scientific integrity

- Clearly separate USGS/NASA-sourced measurements from modeled outcomes or user assumptions.
- Check coordinate conventions, projections, resolutions, reference datums and physical units.
- Document missing-data handling and do not invent calibrated risk/safety ratings.
- Retain source and third-party asset attributions in the application and submission.

## Direct-to-main collaboration

- One GitHub Issue per meaningful problem, with ownership agreed beforehand.
- Pull current `main` before editing; test locally, commit small, push without force.
- Avoid simultaneous editing of shared entry points; resolve conflicts with the other author.
- Check CI and deployment after each push; keep a known-good deployment for rollback.
- No credentials, API keys, cookies, private user data or unauthorized media in commits.

## Definition of done

The source change is committed, automated tests pass, real affected browser interactions were checked, the results/limitations are noted, and any GitHub Issue is updated.
