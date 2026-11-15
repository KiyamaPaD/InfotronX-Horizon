# Mars Atlas: every feature, what it is for, and how it could be modernized

Written for the team, the jury and new contributors. Each feature has three parts: **What it does**, **What it helps with**, **How it could be modernized**. Everything here describes what the code does; most of it has been tested by automated tests, not yet by a full browser walkthrough.

---

## What makes Mars Atlas stand out

Not every feature is new on its own: planets in 3D and route planners exist. What is uncommon is how they are put together, and how honest the result is. These are the points we would lead with, each one something you can show in under a minute.

1. **Every number says what it rests on.** Measured, calculated, illustrative or your own note, shown next to the number. Move the pointer over the planet or the 2D map and a line tells you whether the height under it is the 20 m USGS CTX model or approximate 8-bit MOLA. Outside the data, slopes say "unknown", never "flat". Most map tools hide this; here it is the interface.
2. **It explains *why* a route is best, and where that stops being true.** One slider trades distance against relief. The table re-ranks the routes live, and the text names the exact penalty (about 10.6 on the benchmark) at which the winner changes. A planner answer becomes a decision you can argue about.
3. **A benchmark anyone can reproduce.** Three routes, one start, one end, stored as fixed coordinates. The test suite re-plans them on the bundled height model and fails if a number drifts. Judges can check the result instead of trusting a screenshot.
4. **Documentation that cannot lie.** The formulas in the README (distance, slope, route cost, oxygen and energy) are worked examples checked by automated tests. If the code changes, the page fails the build.
5. **From the whole planet to the ground, in a browser, with no install and no build step.** NASA's own 3D model of Mars, real surface maps you can swap, 29 real places with NASA photos, a route that follows the surface anywhere, a fly-over with a synchronized height profile, and a figure you drag onto the map to stand on the surface. It is plain ES modules and Three.js.
6. **A Planning Lab that turns "what if" into numbers.** 25 small, explained models in one window: why there is no route (it relaxes one constraint at a time and names the blocker), whether the preferred route stays preferred under terrain uncertainty (thousands of seeded runs), what single measurement would change the decision, dead-reckoning uncertainty that grows and resets at landmarks, radio relay sites from line of sight over real heights, battery and temperature over a sol, and more. Each has an example already filled in.
7. **Planning for things going wrong.** The safety step covers robots that could go along, a packing list computed from the route's own oxygen and power, the point of no return where the reserve no longer covers a retrace, and the Earth–Mars message delay of 3 to 22 minutes.
8. **Privacy by default.** Guests are never saved, nothing leaves the browser unless you sign in, and the optional AI explanation needs sign-in and explicit consent. Everything else is computed locally and works offline.
9. **Built to teach.** A tutorial guided by the logo, plain-language sentences built from your own route, and an interface that adds one panel at a time.

**What we do not claim.** It is not a navigation tool, not a safety approval, and not endorsed by NASA. The relief is approximate, the resource and Lab models are illustrative, and zoom is limited by the source imagery. We think saying so clearly is part of what makes it trustworthy.

---

## 1. Welcome page

**What it does.** Opens with a 3D Mars made from NASA imagery, with moons, satellites, a rocket, the Sun, the other planets, comets and the asteroid belt far behind. It lists the NASA and USGS sources, what each is used for and how good it is, links to the legal pages, and can be skipped next time.
**What it helps with.** First impression and trust: a visitor sees at once what the site is, which data it rests on and what it is not (not NASA-approved, not for navigation).
**Modernize.** Preload the planet textures for a faster first frame; a short guided intro that adapts to the visitor's goal (learn, plan, teach); proper screenshots and a looping demo clip on the page itself.

## 2. Explore → Plan → Analyze (workflow steps) and All tools

**What it does.** A step bar shows one panel at a time (Explore, Plan, Analyze) and the map takes the rest of the screen. The app moves forward by itself when you act, for example after your first waypoint. **All tools** restores the full workspace. Panels can be hidden.
**What it helps with.** Beginners are not hit by forty controls at once; experts can open everything.
**Modernize.** Remember the last step per mission; a command palette (Ctrl+K) to jump to any tool or place; a better mobile layout with bottom sheets.

## 3. Accounts, guests and saving

**What it does.** A sign-in window at the start. Guests can use everything, but nothing is saved and they are warned before leaving. Signed-in users are saved automatically to their account (Supabase) with a copy on the device. Missions can also be exported and imported as JSON.
**What it helps with.** Lets anyone try the site instantly while protecting privacy; gives real users their work back on any device.
**Modernize.** Passwordless sign-in (magic link or passkeys); real-time co-editing instead of explicit snapshots; offline-first sync with conflict handling; versioned history of a mission.

## 3b. Mission Center, checkpoints, sharing and team roles

**What it does.** Checkpoints freeze a version of a mission. Exports to JSON, share links (small missions only), and a cloud library where a mission can be shared with a verified teammate email as viewer or editor. Invitation emails are not sent automatically.
**What it helps with.** Teams can hand a plan to one another and go back to an earlier version.
**Modernize.** Automatic invitation emails; a visual diff between two checkpoints; comments pinned to waypoints; a read-only public link with a preview image.

## 3c. Team chat and crew profile

**What it does.** Conversations inside a shared mission, protected by Supabase row-level security, with block, report, delete and anti-spam. Global chat is off until moderation is staffed. A private crew profile holds a callsign, role, interests, bio and optional image. Roles are user-supplied, not NASA credentials.
**What it helps with.** Collaboration and identity inside a team without exposing anyone publicly.
**Modernize.** Notifications, mentions and attachments; message search; staffed moderation and a report queue before turning global chat on; a two-account production test (still pending).

## 4. The 3D planet

**What it does.**
- Uses NASA's own 3D model of Mars (NASA/JPL-Caltech), subdivided and lifted by MOLA heights. MOLA is 8-bit, about 115 m per grey level, so the relief is labelled approximate; a slider exaggerates it.
- Four surfaces: the NASA model, Viking colour, MOLA shaded relief, MOLA colour relief. Close up, it switches to the sharper Viking map by itself and returns when you zoom out.
- 29 real places (rover and lander sites, volcanoes, canyons, basins) with facts and NASA photos, shown as glowing pins.
- Routes follow the surface anywhere on the planet, with distances on Mars's real radius; waypoints can be dropped straight on the planet.
- A line under the pointer says what the numbers there rest on: CTX 20 m heights inside the Jezero clip, approximate MOLA elsewhere.
- A compass, N/S pole buttons, a Fit-route button, a right-click menu, labels, photo sprites and optional slope colours (green gentle, red steep, illustrative: it is the slope of the exaggerated model).
**What it helps with.** Understanding where a route is on a whole planet and how the ground rises and falls; teaching scale (distances, poles, volcanoes) in a way a flat map cannot.
**Modernize.**
- Level-of-detail terrain patches streamed by zoom (like a globe engine such as CesiumJS or Mapbox GL globe), so close zoom is as sharp as 2D.
- Higher-resolution height data (HRSC or a regional DTM) instead of 8-bit MOLA.
- Real planet textures for the other planets; atmosphere scattering and better lighting; WebGPU for heavier meshes.
- Slope colours computed from real heights instead of the exaggerated model, with a legend.

## 5. Route fly-over and height profile

**What it does.** A camera flies along your route while an SVG height profile shows the same position. Hovering the profile shows the height at each point, with a note that heights are approximate.
**What it helps with.** Seeing the climb a route demands before committing to it; explaining a route to others.
**Modernize.** Record the fly-over as a video or GIF; show grade colours on the profile; compare two routes on the same profile; speed and time estimates along the profile.

## 6. Surface view (drag the figure onto Mars)

**What it does.** A small figure is dragged from the 2D map or the 3D panel onto the planet. The camera descends and you look around, walk with the arrow keys, change height with PageUp/PageDown, and exit back to orbit. The camera stays above nearby hills and uses a near plane that shrinks with height.
**What it helps with.** A street-view feel: judging a horizon, a crater rim or a slope from the ground.
**Modernize.** A true ground mesh at the walker's feet from a local height model (CTX/HiRISE DTM) with real texture detail; a stereo panorama export; an Astra-style continuous zoom from space to ground.

## 7. The 2D map

**What it does.** NASA Mars Trek layers: Viking colour (zoom 3–7), MOLA relief, CTX (6 m) and HiRISE (25 cm) around Jezero, plus a NASA colour-relief layer. You draw routes, move and reorder waypoints, drag to adjust, add observations, and link any two waypoints with a dashed line. Pan, wheel and pinch zoom, fly-to, offline notice and tile retry. A line in the corner shows the data quality under the pointer. In the Flowing line style a dot travels along the active route.
**What it helps with.** Precise planning where imagery is fine enough to see boulders and dunes.
**Modernize.** Vector tiles and a WebGL tile renderer for smooth zoom; cached tiles in a service worker for offline use; sharper zoom beyond the source limit (Viking stops at zoom 7); a measurement ruler and area tool; more NASA layers once the exact names are chosen.

## 8. Waypoints, notes, photos and editing

**What it does.** Waypoints have names, categories, notes, shapes, colours, icons and exact coordinates. After each new waypoint a quick window offers ready-made kinds (base camp, sample site, science target, photo stop, hazard and more). A photo can be attached to a waypoint; it is shrunk in the browser to a small JPEG (limit 90,000 characters, 10 per mission). Observations are georeferenced notes with a title, text, source and icon. Mission-scoped undo and redo, and right-click menus.
**What it helps with.** A plan that carries the reason for every stop, not only coordinates.
**Modernize.** Drag photos straight from a phone; voice notes; templates for common mission types; bulk edit and import from CSV or GeoJSON.

## 9. Line styles and preferences

**What it does.** A shared line style (width, opacity, dashes, glow, flowing, marker size, colour) applies to both maps. Preferences (folded blocks, welcome skip, quick waypoint, graphics level) live only in the browser, with a reset button.
**What it helps with.** Readable routes on any background; a personal layout without an account.
**Modernize.** Themes (high contrast, colour-blind safe palette); sync preferences to the account.

## 10. Analyze: eight explained steps

**What it does.** Size, height, legs, comparison, 3D, a decision checklist, a question box, and safety. Each step has a chart and a plain sentence built from the route's own numbers; every number carries a label: measured, calculated, illustrative or your own note.
**What it helps with.** Turning numbers into understanding; showing a jury or a student *why*, not just *what*.
**Modernize.** Export the analysis as a PDF report with charts; per-step narration in several languages; a "what changed since the last version of this route" summary.

## 11. The distance-versus-relief slider and the benchmark

**What it does.** A slider sets the penalty λ in the route cost C = D + λ(A+H). A table re-ranks the routes and names the penalty where the best route changes. The benchmark loads three planned routes on the Jezero delta (direct, balanced, gentle) from one start and one end; tests re-plan them to prove the numbers do not drift.
**What it helps with.** Showing that "best route" depends on what you value, and proving the planner is repeatable.
**Modernize.** A third axis (risk or time) with a 3D Pareto surface; share a benchmark result as a link; add more benchmark sites with other height clips.

## 12. Safety step

**What it does.** Robots that could go along (scout, pack, relay, drone, supply cache, rescue), a kit with amounts from the resource scenario, the point of no return where the reserve no longer covers a retrace, and the Earth–Mars message delay (3 to 22 minutes one way) with what that means for commands.
**What it helps with.** Thinking about what goes wrong before it does.
**Modernize.** Link the kit to real suit specifications; simulate a failure mid-route and show the decision tree; a live delay simulator with a command queue.

## 13. Ask a question

**What it does.** Answers about your route are computed locally from your own numbers and work offline. An optional AI explanation is available only after sign-in and an explicit consent box.
**What it helps with.** A beginner can ask "is this route steep?" in plain words.
**Modernize.** Citations back to the exact chart or number used; a voice interface; a stronger model with a guard that quotes only data the app holds.

## 14. All tools: the science workspace

**What it does.** Searchable tools in four groups:
- **Overview:** mission telemetry, segment distances, route connectivity graph, route inspector, waypoint coordinates.
- **Terrain & math:** DEM route lab, 3D terrain explorer, terrain intelligence, advanced mathematics lab.
- **Models & resources:** the oxygen, battery and time model, the stress lab, routing algorithms, route insights.
- **Mission:** checkpoints, data sources, data integrity.
Group buttons show tool counts and a search box finds any tool.
**What it helps with.** Depth for people who want to check the work.
**Modernize.** Pinned tools and custom layouts; every tool opens in a floating window; consistent loading and error states.

## 15. Terrain tools on the 20 m height model

**What it does.** Elevation and slope profile, grade between waypoints, roughness, line of sight, reachability, contours, climb and descent, and a numeric 3D mesh. Heights come from the USGS CTX 20 m DTM clip near the Jezero delta, relative to the Mars datum. Where there is no data, the answer is "unknown", never "flat". A* plans on the grid with a slope limit (18% default), exclusion zones and a slope-cost penalty.
**What it helps with.** Honest, repeatable terrain numbers where real data exists.
**Modernize.** More clips (other landing sites) loaded on demand; a tiled DEM service; a GPU-based viewshed and reachability; HiRISE DTMs where available.

## 16. Routing algorithms and decision explanation

**What it does.** A*, D* Lite replanning, bounded multi-objective search and a Pareto set (a route dominates another when it is no longer and has no more height change). "Why this route?" displays the objective, trade-offs, limits and user-adjustable preference rankings.
**What it helps with.** A defensible answer to "why did the planner choose this?".
**Modernize.** Anytime planners with live updates as you draw; terrain-type costs (sand, rock, ripples); learned traversability from labelled images.

## 17. Resource model (time, oxygen, energy)

**What it does.** From walking speed, stop time, oxygen use and power, the model computes time, oxygen mass and energy for the route (doubled if you retrace), against usable amounts after a reserve. Defaults are 2.4 km/h, 15 minutes of stops, 0.12 kg/h, 280 W, 1.2 kg, 2200 Wh and 25% reserve. A worked 4.2 km example is checked by tests.
**What it helps with.** A first feel for whether a route fits a tank and a battery.
**Modernize.** Terrain- and slope-dependent speed and power; temperature effects; per-person profiles; Monte Carlo ranges instead of single numbers.

## 18. Stress lab and advanced mathematics

**What it does.** Draws seeded synthetic variations of the resource inputs and reports the mean, value at risk and conditional value at risk. These describe hypothetical distributions, not NASA-calibrated probabilities.
**What it helps with.** Showing how sensitive a plan is to its assumptions.
**Modernize.** Calibrate with published EVA data; correlated inputs; sensitivity charts (tornado plots).

## 19. Planning Lab (header → Lab)

**What it does.** 25 small models, each with an example you can edit and run:
value plan; instruments and kit weight; geological variety; why there is no route; backup plans with triggers; does the best route stay the best; what to measure next; navigation without GPS; image and height-model alignment; turning radius; vehicle width; side slope and tipping; wheel slip; two rovers in a narrow pass; where two teams meet; radio relay from line of sight on real heights; time windows; battery over time; equipment temperature; depots; samples and contamination; data budget; recovery after an uncertain landing; change between two pictures; local 3D points on the planet; export for a small educational rover.
**What it helps with.** Turning "what if" questions into numbers, quickly, without a spreadsheet. Each card says what it rests on.
**Modernize.** Feed the Lab from the active mission automatically (routes, zones, resources); a real geological map for variety; terrain-aware slip and stability from real slope data; save Lab scenarios with the mission; connect the rover export to real hardware (JPL Open Source Rover) when you have one.

## 20. Tutorial, guides and help

**What it does.** A guided tour whose pointer is the site logo, a "how to choose a route" guide, keyboard shortcuts (D draw, M move, E explore, N observe, Ctrl+Z / Ctrl+Y, Esc), and a Help & tour button.
**What it helps with.** Reaching a first useful route in minutes.
**Modernize.** Interactive lessons with checks ("place two waypoints now"); a classroom mode with teacher-set goals; translations.

## 21. Performance and reliability

**What it does.** A low-power mode and an automatic watchdog turn effects down when frames stay slow; a Graphics setting (automatic, lighter, full); GPU resources are freed when views close; tile retry and an offline notice on the 2D map.
**What it helps with.** Running on school laptops.
**Modernize.** Adaptive resolution with a frame-time target; WebGPU and instancing; a service worker for offline use.

## 22. Legal, privacy and credits

**What it does.** Terms, privacy, cookies and local storage, and credits (also inside the app at legal.html). Guests are not stored; storage keys are listed.
**What it helps with.** Transparency and compliance for a public site.
**Modernize.** A lawyer's review (the texts are templates), a cookie and storage panel inside the app, and a data export and delete page for accounts.

## 23. Quality and honesty tooling

**What it does.** Automated tests cover the mathematics in the README, the benchmark routes, the Lab models, mission import and export, photo limits, account storage, and the build output. Every number carries a source label.
**What it helps with.** Trust: documentation that cannot drift from the program.
**Modernize.** End-to-end browser tests in CI (Playwright), visual regression for the maps, an independent GIS comparison of a few points and profiles, and a Content-Security-Policy.

---

## Biggest modernization opportunities, in order of impact

1. **Sharper terrain everywhere:** LOD streaming, better source imagery, a real height model at the ground.
2. **A browser test run and screenshots** for the jury and the README.
3. **Real data in the Lab:** drive the models from the active mission and real slopes.
4. **Collaboration:** real-time editing, notifications and comments.
5. **Offline and mobile:** a service worker, bottom sheets and touch-first controls.
6. **Security and legal:** a Content-Security-Policy and a lawyer's review.
