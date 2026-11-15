# Mars Atlas — NASA Space Apps Challenge 2026 readiness

**Updated 15 November 2026:** this is a compliance and demonstration checklist, **not a confirmation of an accepted official entry**.

## Main project artifact

- Code: https://github.com/KiyamaPaD/Mars-Atlas (`main`)
- Demo website: https://mars-atlas-map.netlify.app/ (team reports that map and Supabase backend load; confirm that the final GitHub SHA is actually published after every manual Netlify Drop)
- Previous Vercel site: https://mars-atlas-mu.vercel.app (may lag behind current code because deployment limits were reached)
- GitHub Actions: automated tests and Chromium map scenarios run against repository source, **not necessarily against the published Netlify URL**
- New scientific comparison export: `Science → Terrain → DEM ROUTE LAB → Compare 3 route strategies → Export scientific comparison (.md)`
- Demo evidence: final live recording/screenshots, source and permission checks must still be completed from the deployed public site

Older V3–V9 reports and earlier preview links are historic research notes; they are not the current production version.

## Time and reuse rules — important

NASA Space Apps Challenge 2026 takes place **14–15 November 2026**. The official GO Team clarified that **challenge-specific project development is expected during the hackathon**, and working ahead may risk disqualification. Previously existing tools/code may be reused only within the organizer's stated limits, with proper attribution; code already built specifically for this challenge before the start is **not made eligible by moving it to a new repository or resetting Git history**.

The project history includes MARS ATLAS challenge-specific concept and development work **before 14 November 2026**. Preserve the actual history: code timestamps, earlier hosting, designs, prompts, team contributions and test outputs. Do not represent the project as fully created during 14–15 November or try to erase the pre-hackathon origin by renaming, moving repositories or rewriting commit dates. Obtain written clarification from the GO Team about eligibility for awards; until then, **eligibility is not confirmed**.

Official sources:
- https://www.spaceappschallenge.org/2026/
- https://github.com/nasa/spaceapps/discussions/1827
- https://github.com/nasa/spaceapps/discussions/1924

## NASA datasets and claims

- Cite the USGS Astrogeology / NASA MRO CTX DTM (Fergason et al. 2020): https://doi.org/10.5066/P906QQT8
- Clearly distinguish the real 104×96 bundled CTX numeric clip from derived route and scenario calculations.
- Check that at least one NASA dataset actually used is listed in the chosen **official 2026 challenge's Resources tab** for Global Awards eligibility; cite it and all additional sources.
- Do not claim calibrated human EVA safety or certified rover navigation.

## Before sending to judges

- [ ] Verify contestant/team registration and selected **official 2026 challenge**; record the exact challenge URL.
- [ ] Ensure the demonstration explicitly distinguishes previously existing work from features implemented during the event.
- [ ] Confirm final Netlify deployment includes the evidence export, then check the hosted workflow in an incognito browser.
- [ ] Clarify the actual pre-hackathon build history and eligibility with the organizers.
- [ ] Inspect the official challenge's Resources and cite actual incorporated NASA data.
- [ ] Test the published site on desktop and mobile, not just in CI.
- [ ] Rehearse the example mission and evidence download using [Judge demo draft](JUDGE_DEMO_DRAFT_2026.md), then make a truthful 90–120 second live demo and confirm its link can be opened publicly.
- [ ] Download and retain a scientific comparison `.md`, original mission JSON and screenshots from the published version.
- [ ] List relevant datasets, libraries, media, tools (including AI assistance), and contributions in the submission.
- [ ] Submit from the team's Project tab by **15 November 2026 at 23:59 in the team owner's Local Event timezone**, according to official guidance.

For issues found during team testing use [BETA_TESTING.md](BETA_TESTING.md).
