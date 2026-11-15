# Jury pack

One page for reviewers: what Mars Atlas answers, which data it uses, how to reproduce a result, and how to check it independently. Statements that still need the organisers' own wording are marked **to confirm**.

## 1. The question the app answers

> Given a start, an end and NASA height data, which route do I choose, and why?

The thread of the demo is: **goal → data → alternative routes → trade-off → decision, explained**.

## 2. Challenge requirements and where the app covers them

The wording of the challenge ("Interplanetary Survival Guide: Martian Map") and its list of requirements must be copied from the official page and checked line by line against this table. **To confirm.**

| Need | Where in Mars Atlas | Evidence |
| --- | --- | --- |
| A map of Mars to explore | Welcome page, 3D planet, 2D map with four NASA layers | Layers listed in `NASA_DATA.md` |
| Terrain and elevation | Height profile, slope, climb and descent from the USGS CTX model; 3D relief from MOLA | README "The mathematics"; `tests/` |
| Route planning | Draw, move, connect and compare routes; grid A\*, D\* Lite and Pareto in All tools | `tests/benchmark.test.mjs`, `docs/ROUTING_VALIDATION.md` |
| A decision explained | Analyze step 4: penalty slider, cost table, change point | `src/benchmark.js` |
| Resources and risk for a walk | Time, oxygen and energy scenario; point of no return; kit and companion robots (illustrative) | `src/resources.js`, `src/companions.js` |
| Honest limits | Each figure is labelled calculated, measured, illustrative or your note; unknown stays unknown | Analyze step 1 and 2 |
| Easy to learn | Guided tour, checklist, guest mode | Help & tour |

## 3. NASA and USGS resources used

| Resource | Used for | Citation |
| --- | --- | --- |
| NASA Mars Trek, Viking MDIM 2.1 colour mosaic | Base map, 3D surface option | USGS Astrogeology / NASA Viking |
| NASA Mars Trek, HiRISE Jezero orthomosaic | Sharp 2D map near Jezero | NASA / JPL-Caltech / University of Arizona |
| NASA Mars Trek, CTX Jezero mosaic | Context imagery near Jezero | NASA / JPL-Caltech / MSSS |
| NASA Mars Trek, MOLA shaded relief and MOLA colour relief | 2D layers, 3D surface options | NASA / GSFC |
| NASA Mars Trek, MOLA elevation mosaic (8-bit) | 3D relief, route height profile | NASA / GSFC |
| USGS CTX DTM of the Mars 2020 landing site | Numeric 20 m heights for slope and climb | Fergason et al. (2020), DOI 10.5066/P906QQT8 |
| NASA 3D Resources: Planet Mars model | The planet in the 3D view | NASA/JPL-Caltech |
| NASA Image and Video Library | Photos of places on Mars | Each photo links to its credit |

The challenge's own Resources page should be checked so that at least one NASA resource listed there is named here. **To confirm.**

## 4. Use of AI tools (disclosure)

AI assistants wrote and reviewed parts of the code and the documentation under human direction: Anthropic Claude and OpenAI Codex/ChatGPT. Every result was tested by running the automated tests and by people. The list must match what the whole team actually used (`docs/AI_USE_AND_SOURCES.md`). **To confirm.**

## 5. Reproduce the benchmark

1. Open the site as a guest (no account needed).
2. Go to **Analyze**, step 4, and press **Load the benchmark mission**.
3. Three routes join the same start and end near the Jezero delta. Expected values:

| Route | Distance | Climb | Descent | Steepest slope |
| --- | --- | --- | --- | --- |
| Direct (penalty 0) | 2187.3 m | 18.1 m | 63.9 m | 11.7 % |
| Balanced (penalty 6) | 2187.3 m | 17.3 m | 63.1 m | 12.1 % |
| Gentle (penalty 24) | 2427.5 m | 6.0 m | 51.8 m | 10.5 % |

4. Move the penalty slider. Below about **10.6** the balanced route is the cheapest; above it the gentle route wins, at 240 m more distance for 22.6 m less climb and descent.
5. `npm test` re-plans the three routes from the bundled height model and fails if any number moves (`tests/benchmark.test.mjs`).

These differences are small because the clip is a gentle delta front. The benchmark shows the method, not a measured risk reduction for astronauts.

## 6. Check it independently

1. In QGIS or another GIS tool, open `assets/jezero_ctx_trn_dem_20m_clip.json` as a raster (or the original USGS product, DOI above).
2. Sample the height at the three routes' waypoints and compare with the profile in the app.
3. Compute the great-circle distance of each leg with $R=3\,396\,190$ m and compare with the table.
4. Write the differences in the table below and keep this page with the submission.

| Check | App | GIS | Difference |
| --- | --- | --- | --- |
| Height at the start | | | |
| Height at the end | | | |
| Length of the direct route | | | |
| Climb of the gentle route | | | |

## 7. The public flow to test before submitting

In a private window: guest → open the example mission → Analyze → compare routes → move the slider → export JSON. Then, separately, create an account, confirm the email, sign in and check that a drawn route is saved. Tick items on `checklist.html` as you go.

## 8. Demo: 30 seconds or 7 slides, in English

1. The problem: a short route can climb more, and some ground has no height data.
2. The data: NASA and USGS sources, shown on the planet.
3. Two routes, same start and end.
4. The slider and the cost table: the choice changes at a stated penalty.
5. The 3D fly-over with the height profile.
6. What to pack and the point of no return (illustrative).
7. Credits, limits and the link. Subtitles in English for any video; disclose AI tools.

## 9. Known limits

- The 3D relief comes from an 8-bit mosaic (about 115 m per grey level); it is approximate.
- Only a small clip near the Jezero delta has numeric 20 m heights. Elsewhere, slopes are unknown.
- Safety figures (reserves, the point of no return, the kit) are planning illustrations and are not NASA flight rules.
- Other teams' safety thresholds were not reused; any threshold must be sourced before it appears in the app.
