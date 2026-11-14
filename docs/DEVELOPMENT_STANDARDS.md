# InfotronX Horizon — engineering standards

These standards apply to Mars Atlas source code, data pipelines, research and review.

## Source style

- JavaScript native ES modules with small named functions and clear domain identifiers.
- Allman braces: opening braces on their own line for functions, loops, conditionals and classes.
- Keep simple assignments, parameters, calls and arithmetic on one line: `total += distance;`.
- Few comments, focused on nontrivial algorithms, scientific provenance and constraints.
- Add deterministic tests for numerical code and regressions; make missing-data and invalid input behavior explicit.
- Keep mobile layout, accessibility and keyboard controls functional.

## Scientific integrity

- Always distinguish public NASA/USGS raster measurements from independently calculated outputs and user-provided scenario assumptions.
- Mars coordinates are planetocentric, east-positive unless a source states otherwise; check projections and vertical datums before combining datasets.
- Document distance in meters, slope as a percentage or degrees, areas in km² and scientific uncertainties with the relevant source.
- A modeled route or line of sight is not certified safe; sample density and DEM posting are not independently measured hazard accuracy.
- Retain original data citations, references and applicable licenses in all exports and submissions.

## Collaboration and security

- Reviewable PRs and one issue per meaningful change; tests and evidence before merging.
- No production deployment or database schema migration without release-owner approval.
- Never commit `.env`, API keys, tokens, passwords, cloud service secrets or personal data.
- Keep the project modular; do not introduce major new frameworks without an agreed engineering need.

## Definition of done

A feature is done when the actual code is committed, tests pass, a relevant manual workflow is checked, data provenance is documented, and limitations are recorded in the PR.
