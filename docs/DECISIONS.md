# Mars Atlas — engineering decision log

## 2026-11-14 — InfotronX Horizon team identity

Use **Mars Atlas** as the product name and **InfotronX Horizon** as the team. The official competition is **NASA Space Apps Challenge 2026**; the team's season label **2026–2027** is separate from the competition year.

## 2026-11-14 — Direct manual mission control

Users create, modify, save and compare routes directly through the map. All important actions are reversible or exportable and do not depend on a remote planning service.

## 2026-11-14 — Stable browser ES modules

Keep the existing plain JavaScript architecture during the challenge. Major framework migrations need a concrete performance or maintenance justification.

## 2026-11-14 — GitHub as the source of truth

Use issues, branches, PRs and committed handoffs for collaboration. Avoid unreviewed direct pushes and preserve the original work history.

## 2026-11-14 — Scientific claims require evidence

Measured NASA/USGS data, inferred mathematical model outputs and hypothetical human inputs are explicitly distinguished. No route is certified for actual human navigation.

## 2026-11-14 — Release separately from development

Current `main` production stays stable until peer review and release approval; new features are tested in independent preview deployments.
