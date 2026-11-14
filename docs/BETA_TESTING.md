# Mars Atlas — team beta testing

**Time:** around 15–25 minutes per tester  
**Site:** https://mars-atlas-mu.vercel.app  
**Bug reports:** https://github.com/KiyamaPaD/Mars-Atlas/issues/new?template=bug_report.md

This is a test of the real **deployed UI**, not proof that a NASA source is available or that modeled risk is a real-world safety measurement. If Vercel asks for authentication, request an approved Shareable Link from the project owner.

## Before starting

Record the **device, browser/version, screen width, site URL, and date**. Prefer a new/incognito browser window for a clean test. Use example mission data only, not personal/private information.

## Essential test path

- [ ] **Start:** Home page loads without errors or a forced login. Layout and buttons are legible.
- [ ] **Explore Jezero:** Pan and zoom the map. Switch NASA imagery between CTX, MOLA and Viking. Note blank tiles, network warnings or slow loading.
- [ ] **Manual-first:** Create a mission and route **without AI**. Add at least two waypoints. Drag/move one; edit coordinates if available; reorder or delete another.
- [ ] **Planning:** Compare alternative routes. Check that recalculation completes and any selected route remains manually editable.
- [ ] **What-if:** Add or change a hypothetical no-go zone and replan. Confirm it is presented as a scenario, not a measured hazard.
- [ ] **Terrain:** Open the CTX elevation / DEM panel. Load the bundled data and inspect a slope or elevation profile; report numerical errors or unexplained labels.
- [ ] **Persistence:** Save or make a checkpoint, refresh the page, reopen the mission and restore/check the data.
- [ ] **Backup:** Export JSON/GeoJSON, then import it and confirm waypoints and observations remain correct.
- [ ] **Share:** Copy a mission link and open it in a second clean browser session. Note whether import/preview works as indicated; this is **not** live account sync.
- [ ] **Mobile:** Check at approximately 390px width or on a phone; panels scroll, buttons are tappable, charts remain visible and nothing blocks the map.

Optional: test Firefox/Safari, slow Wi-Fi, page reload after changing layers, keyboard navigation, and a mission with many waypoints.

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
