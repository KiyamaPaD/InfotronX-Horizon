# Deploy Mars Atlas

The current working code is in **https://github.com/KiyamaPaD/Mars-Atlas**, branch `main`. The primary live host is Vercel project `mars-atlas` with production alias **https://mars-atlas-mu.vercel.app**.

## Vercel (current setup)

1. The Vercel project is linked to `KiyamaPaD/Mars-Atlas`.
2. A direct push to `main` triggers the connected deployment.
3. Check the Vercel Deployments page for **READY** and the expected Git commit.
4. Check GitHub Actions Verify, then test the actual production URL in an incognito browser window.
5. If the generated deployment URL requests Vercel Authentication, use the short production alias; for external reviewers use a Shareable Link where needed.

No production build command is required: this app serves HTML/CSS/native JS modules from the repository root.

## Netlify (optional alternative)

The existing `netlify.toml` publishes `.` with no compilation. Import the GitHub repo into Netlify, set the publish directory to the root (`.`), leave Build Command blank, and test the real site before switching any production links. Do **not** duplicate production domains across hosts without planning DNS.

## Browser smoke test

Use [docs/BETA_TESTING.md](docs/BETA_TESTING.md). At a minimum, check map imagery, manual routes, save/refresh, JSON/GeoJSON export/import and mobile viewport controls.

## Limitations

Mission storage is currently browser-local. `supabase/schema.sql` is proposed, not deployed. Public image tiles and the bundled USGS/NASA numerical DEM have separate loading/error paths. The route scenarios are **not** certified planetary navigation or verified hazards.

A purchased domain comes later; do not block testing on DNS.
