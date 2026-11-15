# InfotronX Horizon — MARS ATLAS judge demo prep (DRAFT)

**Do not finalize the slides/video format yet.** The team will choose the final presentation format together. This is a verified live-demo runbook and fallback outline, **not a finished presentation**. Aim to have a stable, rehearsed candidate before the team's approximately **18:00 local checkpoint on November 15, 2026**.

## User story (90–120 seconds)

> "An explorer needs to evaluate possible scientific stops in Jezero crater. MARS ATLAS gives them a manual-first NASA-data map where they create a route, inspect terrain data, and understand the numerical trade-offs between modeled alternatives. The computer proposes candidate routes, but the user makes the decision and keeps full editing control."

Suggested sequence; assign speakers and rehearse with the **currently deployed** version, not an unreleased GitHub commit:

| Demo moment | Approx. time | On-screen action | What to say |
| --- | ---: | --- | --- |
| Problem & context | 0–15s | Jezero NASA imagery and map controls | "Planning on Mars requires transparency about source data and uncertainty." |
| Manual-first | 15–35s | Create mission, place two waypoint coordinates inside DEM coverage | "These points are ours; AI is not required and cannot approve our route." |
| Real terrain | 35–55s | Open Terrain, load numeric USGS/NASA CTX clip, show elevation profile | "Photographs and measured numeric elevation are separate data sources." |
| Candidate analysis | 55–85s | Compare 3 A* strategies; change lambda in **Why This Route?** | "The algorithm minimizes D + lambda*(ascent+descent), subject to selected slope and data constraints." |
| User control & limits | 85–105s | Add editable candidate or What-if exclusion, show warning and export | "Not safe-route certification: DEM has missing coverage; hypothetical obstacles remain hypothetical." |
| Closing impact | 105–120s | Summary & link | "An educational, reproducible, user-controlled GIS workflow with clear scientific provenance." |

If 3 minutes are available, add one numeric example of cost decomposition and display the original manual route against two candidates. **Do not improvise unsupported measured slope, percent safety improvement or claimed official NASA partnership.**

## Rehearsal checklist

- Ensure the URL opens without login, NASA tiles visibly load, demo DEM loads, and current deployed SHA contains the latest features.
- Test at a narrow desktop and normal widescreen. Avoid needing login for the scientific part.
- Save a named **manual example mission** with two valid waypoints in the documented bundled CTX clip; import the file on a test browser before recording.
- Store a JSON backup and a screenshots backup in case the live internet fails. If fallback footage is needed, clearly say it is prerecorded.
- Choose a candidate where the preferred route **actually differs** across lambda values if possible; if all three match, show that the application honestly reports equivalent results. Never fabricate a difference.
- Check formula with displayed unrounded values or explain chart rounding.
- Capture screenshot of **Why This Route?**, Pareto chart, source/limitations, export and diagram.
- Prepare an explanation for why A* ≠ AI generative model; A* is deterministic graph search.
- List all AI systems actually used in development; a draft disclosure is in `docs/AI_USE_AND_SOURCES.md`.

## Judge questions & correct responses

**Q: What makes one route optimal?**

A: It minimizes a specified modeled cost on a constrained 8-neighbor DEM grid. At lambda=0 the objective is grid length. At lambda>0 cumulative absolute vertical change adds a penalty. We compare results under the same input grid and restrictions. We do **not** know the safest real physical path.

**Q: What if the DEM has no data?**

A: We do not infer heights from images or invent a plausible slope. The planner reports that a valid numeric route cannot be established.

**Q: Is NASA data really used?**

A: Yes: Mars Trek imagery, plus a limited-area numerical CTX-derived terrain product with its source and footprint. The code, route editor, math engine, visualization and optional services are our custom implementation. NASA is a source, not a certification.

**Q: Can an explorer edit without AI?**

A: Yes. They draw, name, move, delete, save, export and compare missions without an AI approval step.

**Q: How did you validate A*?**

A: We independently compared it with a separate Dijkstra implementation on 48 deterministic synthetic DEM grids, using three route-cost penalties, and verified the analytic cost identity.

**Q: What AI systems did you use?**

A: Disclose precisely those actually used, what they assisted with and what was human-checked. Do not infer or claim systems that weren't used. See AI source document.

## Responsibility and publish gate

The judge specifically requested distance checks, planning-tool behavior, scientific source labels, and AI disclosure. Use `docs/JUDGE_SCIENTIFIC_VALIDATION.md` as the technical evidence basis.

The official NASA Space Apps 2026 page states that 2026 project submission closes November 15 at 23:59 local time, but the team wants its **own earlier ~18:00 checkpoint**. The earlier checkpoint should be treated as the practical deadline for final validation and demo decisions.

**Outstanding:** verified public deployment of the latest GitHub SHA, real authenticated Crew Profile upload/RLS multiaccount test, final slideshow/video format, finalized recorded demonstration, and any live showcase post. Never claim these are done before they are.
