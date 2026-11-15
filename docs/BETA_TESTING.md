# Mars Atlas — team beta testing

**Time:** around 15–25 minutes per tester  
**Site:** https://mars-atlas-mu.vercel.app  
**Bug reports:** https://github.com/KiyamaPaD/Mars-Atlas/issues/new?template=bug_report.md

This is a test of the real **deployed UI**, not proof that a NASA source is available or that modeled risk is a real-world safety measurement. If Vercel asks for authentication, request an approved Shareable Link from the project owner.

## Before starting

Record the **device, browser/version, screen width, site URL, and date**. Prefer a new/incognito browser window for a clean test. Use example mission data only, not personal/private information.

## Essential test path

- [ ] **Start:** Home page loads without errors or a forced login. Layout and buttons are legible.
- [ ] **Explore Jezero:** Pan and zoom the map. Switch NASA imagery between Viking Global, HiRISE Jezero and MOLA Relief. Note blank tiles, network warnings or slow loading.
- [ ] **Manual-first:** Create a mission and route **without AI**. Add at least two waypoints. Drag/move one; edit coordinates if available; reorder or delete another.
- [ ] **Planning:** Compare alternative routes. Check that recalculation completes and any selected route remains manually editable.
- [ ] **What-if:** Add or change a hypothetical no-go zone and replan. Confirm it is presented as a scenario, not a measured hazard.
- [ ] **Terrain:** Open the CTX elevation / DEM panel. Load the bundled data and inspect a slope or elevation profile; report numerical errors or unexplained labels.
- [ ] **Persistence:** Save or make a checkpoint, refresh the page, reopen the mission and restore/check the data.
- [ ] **Backup:** Export JSON/GeoJSON, then import it and confirm waypoints and observations remain correct.
- [ ] **Share:** Copy a mission link and open it in a second clean browser session. Note whether import/preview works as indicated; this is **not** live account sync.
- [ ] **Mobile:** Check at approximately 390px width or on a phone; panels scroll, buttons are tappable, charts remain visible and nothing blocks the map.

Optional: test Firefox/Safari, slow Wi-Fi, page reload after changing layers, keyboard navigation, and a mission with many waypoints.


## Cloud library and team collaboration

These checks use real Supabase email accounts and two separate browsers or devices. Test with fictional mission names and coordinates only. **Do not send a password, access token or cookie to anyone.** Use the teammate's verified email address for sharing; do not exchange passwords.

- [ ] **Account:** Create an account, confirm the email, then sign in. Confirm that Mission Center → Cloud library shows your signed-in email.
- [ ] **Local first:** Sign out and verify that routes saved on this device still open without cloud access.
- [ ] **Cloud save:** Sign in, create a new mission, add waypoints, then choose **Account → Save current mission**.
- [ ] **Reload:** Sign in on a second clean device or browser. Select your mission in the cloud library and choose **Open selected mission**. Check that its route and notes are identical.
- [ ] **Share with viewer:** Owner A selects a cloud mission they own, enters teammate B's verified email address and grants **Can view**. B signs in and refreshes the cloud library.
- [ ] **Viewer:** B refreshes the cloud library and opens the shared mission. B should be able to inspect it but **not** update the cloud copy. Local manual edits are allowed, but must not overwrite the owner's data.
- [ ] **Editor:** A grants B **Can edit** using the same email. B reloads, opens the latest mission and saves a change to the cloud; A can reopen that change.
- [ ] **Conflict prevention:** Both users open the same cloud revision, B saves a change first, then A tries to save their old copy. The second save must be rejected with a revision/conflict message, not silently overwrite B.
- [ ] **Revoke access:** A selects the cloud mission and clicks **Revoke** for B (or **Cancel** for a pending email invitation). After B refreshes, the shared mission should no longer be accessible from the cloud.
- [ ] **Backup:** Export JSON and import it before running destructive test scenarios. Do not use private real mission data for testing.

**What the two sharing modes mean:** Mission Center → Share & export creates an exported-link copy. Mission Center → Cloud library → Share selected mission grants authenticated access to a mission in Supabase. These are separate operations; neither provides simultaneous live cursor editing. Email-based access does not send an invitation email automatically; the owner must share the site link separately.

If any step fails, create a GitHub Issue with the exact step, browser, expected versus actual result and a sanitized screenshot. Don't publish account email addresses, full access tokens or mission contents in bug reports.

## How to report a bug

Create one GitHub Issue per distinct problem with:
1. **Title:** short and specific (for example, “Mobile — Compare button covered by footer”).
2. **Reproduction:** exact numbered actions and selected panel/map layer.
3. **Expected vs actual:** what should happen and what happens instead.
4. **Environment:** browser/version, device, viewport and exact site URL.
5. **Evidence:** screenshot or console message with passwords, cookies and personal info removed.
6. **Severity:** Blocker / High / Medium / Low.

**Blocker** = cannot start or cannot complete manual planning. **High** = lost mission data, export/import broken, main UI unusable. **Medium** = one significant tool fails but a workaround exists. **Low** = visual or text polish.

## What counts as a good beta

At least **one desktop Chrome/Edge run** and **one real phone run**, ideally with two different teammates, plus reproducible Issues for failures. A passed automated test suite alone does not mean this checklist passed. The release owner triages issues and tests corrections before the next release.

## Boundary and honesty

Missions currently live in each person's browser (localStorage). Sharing a URL or exporting a file is not multi-user synchronization. Source DEM elevations and derived numerical models have different levels of certainty. Please report misleading scientific language as a bug.

## Mission Center verification

The top bar's **Mission Center** groups three areas: **On device** (saved missions and checkpoints), **Cloud library** (sign in, explicit save/open, role-based sharing), and **Share & export** (copy link, JSON, GeoJSON, brief). Do not confuse an automatic on-device save with an online save.

- [ ] Confirm the current mission appears in **On device** after it is created.
- [ ] Confirm **Cloud library** is empty before the first explicit cloud save, then click **Save current mission**, read the result and verify the mission appears in its dropdown.
- [ ] Reload and sign in again to check the cloud mission can be opened from a separate session.
- [ ] Create and restore a checkpoint from **On device**; check that its data survives a reload.
- [ ] Export a JSON backup and create a shareable link from **Share & export**.
- [ ] At Viking zoom 3–8, verify continuous global imagery. Switch to HiRISE Jezero and zoom to 9–10 near the crater; outside its footprint, confirm Viking fallback is labelled and not presented as HiRISE detail.

## RLS cloud save regression

The live SQL SELECT policy was updated to permit owners to read a mission row during `INSERT ... RETURNING`. Sign in, open **Mission Center → Cloud library** and use **Save current mission**. The result must appear in the cloud dropdown and persist after reloading the page. A second, uninvited account must still be unable to see that mission. If a browser still displays an RLS error, report the complete error message and the step that triggered it; never share a password or access token.

## Verified account matching and map zoom

Email sharing matches the exact confirmed email of a **Mars Atlas account**. An invitation to an address without a confirmed account appears as pending, even if someone is signed into a different address. It does **not** send an actual email; the owner can use **Copy invite** and deliver the instructions to the intended teammate, or cancel an incorrect pending address.

The default Viking Global layer supports zoom 3–8. The HiRISE Jezero layer supports zoom 9–10 within its mapped footprint (approximately 77.223–77.584° E, 18.307–18.669° N); Viking remains visible where HiRISE has no imagery. NASA basemap tile coverage varies; never present resampled lower-resolution context as new surface detail. MOLA and Viking retain their lower useful zoom limits.

## Mars map loading stress test

- [ ] Hard-refresh the site on a clean browser profile. At initial Viking zoom 8, no black CTX strips or permanently empty tiles should appear.
- [ ] Select HiRISE Jezero, then repeatedly zoom 8 → 9 → 10 → 9 while panning around Jezero. Images may temporarily use authentic lower-resolution Viking previews. Check that the route overlays stay aligned and no blank gaps persist where parent tiles exist.
- [ ] With network throttling (or intermittent connectivity), verify that a missing detail tile retains a correctly cropped lower-zoom preview and its resolution is clearly disclosed.
- [ ] Switch to Viking Global and MOLA Relief; inspect positions, attribution, mobile map controls and gaps.
- [ ] Report any persistent tile holes with layer, zoom, latitude/longitude from the map, browser and screenshot. NASA data gaps cannot be filled with invented imagery.

## NASA basemap provenance and coverage

- **Viking Global:** consistent color context for planet-wide exploration, default zoom 3–8
- **HiRISE Jezero:** controlled Mars 2020 ortho mosaic (25 cm/pixel source), limited to its published geographic bounds; zoom 9–10 shows detail only where genuinely available
- **MOLA Relief:** regional color hillshade, a separate visualization and not a substitute for numeric DEM measurements

The old Caltech CTX beta01 global image layer was removed from normal map selection because its native missing-data strips, striping and mismatched seams remain visible at multiple scales. A separate numerical CTX elevation clip in the Terrain panel is unaffected and remains a valid data source for its documented extent.

When selecting HiRISE at zoom 9–10, image tiles outside the local mosaic coverage show cropped Viking context instead. Check that source attribution updates after panning and that point coordinates and routes do not move when basemaps change. Do not expect native high-resolution imagery in regions beyond HiRISE's coverage.
