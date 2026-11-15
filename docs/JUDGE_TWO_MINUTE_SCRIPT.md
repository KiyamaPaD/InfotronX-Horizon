# MARS ATLAS — Two-minute judge narration (draft for team rehearsal)

This is a **spoken demonstration draft**, not a finished slide deck. Review and assign speakers as a team before recording. All numerical statements must be confirmed in the deployed site.

## Suggested narration (approximately 2 minutes)

**00–15 seconds · Problem and data**

> "This is Mars Atlas, a student-built, manual-first GIS mission planner focused on the Jezero region of Mars. Our goal is to help users explore open NASA imagery and compare hypothetical mission routes transparently."

**15–35 seconds · Human-controlled planning**

> "A user chooses their waypoints and science stops directly on the map. Here's a clearly labeled Jezero example mission. Every waypoint is editable, and no AI authorization is needed to create, change, save or export a mission."

**35–55 seconds · Numeric terrain**

> "The map photographs come from NASA Mars Trek. For slopes and elevation we load a separate USGS/NASA CTX-derived numeric terrain clip; image brightness is never treated as an elevation measurement. Its coverage is limited, and missing data aren't filled with guesses."

**55–90 seconds · Judge's suggestion: explain the optimizer**

> "We compare three deterministic A* strategies with different weights on elevation changes. Our score is C = D + lambda times cumulative ascent plus descent. Lambda zero prioritizes gridded distance, while larger values penalize vertical variation more. Here is the full chart, the Pareto comparison, and the explanation of any winner or tie. A winner is optimal only for this particular graph and cost model—not necessarily the safest real path."

**90–105 seconds · Evidence, not an AI promise**

> "We can export the model inputs and exact computed figures into a scientific Markdown report. We also independently checked A* against Dijkstra on synthetic grids and tested the real CTX sample. What-if exclusions are user hypotheses rather than verified hazards."

**105–120 seconds · Impact and transparency**

> "Mars Atlas is an educational research and planning prototype, not a certified NASA navigation system. We've documented our data sources, development assistance including AI, known limitations, and the provenance of our work. The source code and interactive demo are available to inspect."

## Screen flow (no slide format selected yet)

1. Open https://mars-atlas-map.netlify.app/ and inspect the public deployment with an incognito browser.
2. Click **Open Jezero example mission**; show that it creates a separate mission and the user can still edit the anchors.
3. Open **Terrain**; confirm real numeric DEM is loaded; show elevation plot and selected model constraints.
4. Run **Compare 3 route strategies**; select `distance`, `balanced`, `gentle` in **Why This Route?**.
5. Click **Export scientific comparison (.md)**; retain the downloaded file and show source/constraints and a valid tied or selected outcome.
6. Export the mission JSON as a backup; finish on a map view with routes and scientific source badges.

## Non-negotiable caveats and fallback

- If two candidates tie, say **they tie**. Do not select a false winner for visual impact.
- If NASA tiles are slow, use a clearly labeled prerecorded demonstration from the **same version**. Never claim a screenshot proves the live service always responds.
- If the site deploy SHA is uncertain, do not assert that an unreleased feature is on Netlify. Check it manually.
- The project has a documented **pre-hackathon development history**. Seek written eligibility guidance and accurately disclose prior work; do not present everything as authored only during November 14–15.
- The team must confirm all AI tools used. Public GitHub commits include Claude co-authorship labels and this workstream used ChatGPT.
- Do not say real astronauts or NASA validated the routes, simulation parameters or code.
- The official hackathon submission closes 15 November 2026 at 23:59 in the applicable local event/owner timezone; the team's ~18:00 deadline is an internal target.

## Useful supporting files

- [Mathematical and data proof](JUDGE_SCIENTIFIC_VALIDATION.md)
- [Real Jezero DEM audit](JEZERO_NUMERIC_AUDIT.md)
- [Source and AI disclosure](AI_USE_AND_SOURCES.md)
- [Official submission checklist and pre-work warning](SUBMISSION_READINESS.md)
