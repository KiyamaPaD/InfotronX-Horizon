# Deployment — Mars Atlas

## Fastest production deployment

1. Upload the entire `mars-atlas` folder to your own **new** GitHub repository (do not overwrite a previous project).
2. On Netlify, choose **Add new project → Import an existing project** and select that repository.
3. Use **no build command**. Set publish directory to the repository root (`.`).
4. Deploy. Add your own domain in **Domain management** when the application works.
5. Open the public URL and verify CTX/MOLA/Viking imagery. If NASA blocks access or a tile URL does not resolve, inspect WMTS capabilities for the correct tile matrix identifiers before submission.
6. Test Draw → add two waypoints → Edit exact coordinates → New Route → Duplicate → Inspector → Share → reopen shared link in an incognito window.
7. Test refreshing the site and selecting the previously active mission; test export/import and deleting a mission.
8. Export a mission JSON as a backup before the final presentation.

A custom domain and GitHub repository are presentation infrastructure, not the scientific innovation. Do not delay the actual demo for domain propagation.

## GitHub Pages alternative

Use the repository's Settings → Pages and deploy from the root of the default branch. All asset imports are relative paths, so the site also supports a project subdirectory such as `https://example.github.io/mars-atlas/`.

## Public-facing honesty

- This static build saves data **in the browser**, not Supabase. JSON export/import and URL sharing are operational.
- `supabase/schema.sql` is an optional database design, **not a deployed cloud backend**.
- The detour example does **not** incorporate a hazard model.
- Do not claim measured slope/altitude profile data until a separate numeric DEM pipeline has been implemented and tested.

## Vercel option (mobile-friendly)

1. Create a new public GitHub repository and push the project files to its **root**.
2. In Vercel → Add New → Project, import the GitHub repository.
3. Framework Preset: **Other**. No build command. Output Directory: `.` (repository root).
4. Deploy and check route drawing, saved missions, NASA map layer state and export/import.


## Automated verification

`.github/workflows/verify.yml` runs JS syntax checks and `npm test` on push and pull requests. Tests validate local logic only; a passing action does **not** prove NASA WMTS imagery loads in a real browser.
