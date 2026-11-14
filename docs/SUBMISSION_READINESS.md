# Mars Atlas — submission readiness (14 November 2026)

This is a **verification checklist**, not evidence that the submission has been filed.

## Current artifact
- Review preview: https://mars-atlas-nasa-2026-d8wm2rtg5-kiyama1.vercel.app
- Source branch: `feature/review-ready-v6-1`; draft PR #13.
- Production `main` is the old V3.1; do **not** submit the production URL as though it already contains V6.1.
- Current actual tests: 67/67 local/cloud Node tests; HTTP 200 for preview HTML, official DEM JSON, JS; CTX/MOLA/Viking actual Jezero imagery tiles HTTP 200.
- **Not yet proven:** on-device interactive smoke tests, live tile display inside browser, full accessibility check.
- V6.1 includes 104 × 96 actual CTX height samples; A* / scenario math are our demonstration models, not flight software or a safety-approved EVA plan.

## NASA source citation
Use USGS Astrogeology / NASA Mars Reconnaissance Orbiter Context Camera (CTX): Mars 2020 Terrain Relative Navigation CTX DTM mosaic (Fergason et al., 2020), DOI: https://doi.org/10.5066/P906QQT8. Source product `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`, 20 m/pixel, Jezero. We redistribute a numerical 104×96 clip, centimeter-quantized; not a new NASA instrument measurement. Citing USGS/mission/instrument/scientists is mandatory in the presentation even if the source data are CC0.

Other baselayers: NASA Mars Trek MRO CTX, MGS MOLA color relief, Viking global color mosaic. Note what those images **do not** show (point-specific hazard or medical safety).

## Eligibility and timing blockers — resolve before submitting
1. The official organizer confirms that at least **one NASA dataset from the exact chosen challenge's Resources tab** must be used for Global Awards eligibility. The team must inspect the live Resources tab and explicitly identify the matching resource in the submitted attribution. Current V6.1 has not cross-checked that list.
2. NASA Space Apps' GO Team has clarified: challenge-specific coding/development must happen within the November 14–15 hackathon window (starting November 14, 09:00 in the local event / team owner timezone); working ahead can lead to disqualification. Existing third-party or prior unrelated code can be reused with proper credit under the rules. **Check the actual history of every reused asset and state it truthfully.** No postdating or misrepresenting commit history. Sources: https://github.com/nasa/spaceapps/discussions/1827 and https://github.com/nasa/spaceapps/discussions/1924.
3. The published deadline is **November 15, 2026, 23:59 local time of the team owner's event**, not necessarily the current device timezone: https://www.spaceappschallenge.org/2026/ . The team must submit via its official Project tab.
5. Create a 30-second demo video or up to seven slides and make the link accessible; verify the latest official submission guide before choosing a format.
6. Obtain a real browser recording: open review preview, launch Jezero demo, load CTX DEM, compare and add A* candidate, toggle what-if exclusion, show resources, export, mobile panel. Film truthful labels and assumptions.

## Final merge discipline
- PR #13 is a draft, based on V6; V6 depends on V5, V5 on V4, V4 on main. Do **not** merge #13 to main blindly, and don't auto-promote to production.
- Run `npm test` and live browser smoke before deciding on release.
- Record real test evidence and limitations in `docs/REVIEW_RUNBOOK.md`.
