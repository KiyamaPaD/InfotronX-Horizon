# V9 — Mathematical and Algorithmic Research: Mars Atlas

Research date: 14 November 2026. The principles below are public mathematical knowledge. All V9 JavaScript modules were implemented independently; linked systems, authors and missions are research references, not code dependencies or endorsements. **No unlicensed source code or imagery was copied.**

## Executive decision

**Choose:** reproducible incremental replanning; genuine two-objective route labels; connected-component persistent topology; and scientifically honest DEM comparison. These add different, verifiable mathematical information, not four variants of the same dashboard metric.

**Reject:** publishing uncertainty estimates without a second aligned elevation model; treating a DEM cell's height as an independently measured ground-truth sample; claiming all Pareto alternatives are globally optimal if bounded search discarded labels; treating topology persistence as a rock sensor; claiming suit safety or telemetry from slope alone.

## 1 — D* Lite: incremental dynamic programming on a graph

NASA/JPL pioneered practical incremental path planning for robotics. Their Field D* reference describes maintaining two values, `g(s)` and the one-step lookahead `rhs(s)`:

- `rhs(goal)=0`;
- `rhs(s)=min_{s' in succ(s)}[c(s,s')+g(s')]` otherwise;
- states where `g(s)!=rhs(s)` are inconsistent;
- a lexicographically keyed priority queue processes inconsistencies, with `k1=min(g,rhs)+h(start,s)+km` and `k2=min(g,rhs)`.

Our fixed-start and fixed-goal implementation maintains a predecessor-consistent 8-neighbor numeric DEM graph, explicitly checks slope, blocks NoData cells, and forbids cutting diagonally through excluded corners. When the operator changes a hypothetical exclusion, we recompute only the affected two-cell neighborhood's `rhs` values before letting inconsistencies propagate. `km` is initialized to zero because **the start state is not changed in this version**. For a fixed Euclidean surface-distance lower bound and nonnegative slope penalty, the distance heuristic is admissible. Each replan is cross-checked with a fresh A* at the same cost assumptions before it is shown in the UI.

**When useful:** Replanning many times as a human draws what-if exclusion zones. The algorithm can reuse earlier search knowledge, but a changed zone does **not** guarantee less work than a fresh A* on every instance. Some scenarios propagate globally.

**Our modeling limit:** The graph is a 20 m-posted elevation approximation. Costs omit traction, obstacles, wheel slip, communication and suit physiology. Source paper: <https://robotics.jpl.nasa.gov/media/documents/fdstar3d.pdf>. In particular, we implement a D* Lite variant, **not the continuous/interpolated Field D*** rover planner.

## 2 — Multiobjective Pareto labels: route length versus cumulative ascent

A path can be short but climb more. For alternative route vector `a=(distance, ascent)` and `b=(distance, ascent)`, `a` dominates `b` when:

`a.distance <= b.distance`, `a.ascent <= b.ascent`, and at least one inequality is strict.

We propagate nondominated cost labels through graph edges. Every edge contributes `surfaceDistanceMeters` and `max(0, destinationHeight - startHeight)`. Dominated candidate labels are discarded at their node. Goal labels are themselves filtered by strict dominance and duplicate cost vectors.

**Limits are explicit:** The implementation uses a maximum 12 retained labels per grid cell and 45,000 label expansions in the UI (upper configurability in the pure function). Exceeding a cap marks the result **bounded, non-global**, not a full mathematically complete Pareto frontier. Route candidates are chosen for diversity along length; the method is not the method of weighted sums and is therefore able to retain nonsupported nondominated discrete paths within budget. Intermediate human route anchors are **not** silently discarded: the current UI requires exactly two waypoints.

Publishing a route to the mission stores its source DEM, assumptions and `unverified:true`; users may immediately edit it. The original route is untouched.

**Related research:** Wolfgang Fink et al., *Globally optimal rover traverse planning in 3D using Dijkstra’s algorithm for multi-objective deployment scenarios*, Planetary and Space Science 179 (2019), <https://www.sciencedirect.com/science/article/pii/S0032063318302526>. This independently developed prototype only covers distance and DEM ascent, and does not implement that paper's scientific or risk objective models. An algorithmic survey is Zajac & Huber, *Objectives and methods in multi-objective routing problems*, EJOR (2021), <https://www.sciencedirect.com/science/article/pii/S0377221720306160>.

## 3 — Discrete 0-dimensional persistent homology: peaks, basins, saddles

We study superlevel sets `{grid cell: z >= h}` while lowering threshold `h`, and sublevel sets `{grid cell: z <= h}` while raising it. In both sweeps, a union-find data structure maintains **4-connected components**. When two components merge, the one with earlier birth in the filtration survives (elder rule). The less persistent component is paired with the merge threshold. Its persistence is `|birthElevation - mergeElevation|` meters.

A broad plateau of equal-elevation cells is activated simultaneously; this avoids fake nonzero persistence due to a pixel iteration order. NoData cells are absent and can create independent components. Surviving components have no finite death threshold within the **clipped dataset** (not infinite mountains). We display finite contrasts above a user-selected persistence threshold and global survivors separately in the data model.

**What this does not prove:** Geological origin, mineralogy, watershed identity, actual saddle in a smooth surface, or statistical significance of small features; none are known without resolution/uncertainty study. V9 only implements `H_0` components, not full Morse–Smale complexes, contour trees, persistent `H_1` loops, or automated science target recognition.

**Research:** TTK's instructional persistent homology guide <https://topology-tool-kit.github.io/persistentHomologyDummies.html>, and *Automated Earthwork Detection Using Topological Persistence*, Water Resources Research (2023), <https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2023WR035990>. These illustrate the meaning and limits of the method; no code was transplanted.

## 4 — DEM error audit, aligned comparison and conditional Bayesian offset

### What 20 m DEM posting actually means

Our USGS/NASA Mars 2020 Jezero CTX TRN clip is sampled on a 20 m-posted source grid, but a raster value is not proof that a 20 m-sized boulder or local slope was measured accurately. A 2020 Jezero evaluation discusses effective horizontal resolution often several DEM pixels coarser than the posting: <https://www.usgs.gov/publications/evaluating-stereo-dtm-quality-jezero-crater-mars-hrsc-ctx-and-hirise-images>.

A 2021 detailed Jezero table gives an example CTX DTM effective filter width about 105 m and a 3.55 m RMS *error in that study setup*. These figures are **published regional comparison statistics**, not calibrated per-cell uncertainties for our particular clip, and must not be silently used as standard deviations in CVaR or Bayesian calculations: <https://www.mdpi.com/2072-4292/13/17/3511>.

A 2023 high-resolution Jezero mosaic study reports a 3.83 m standard deviation of differences between MADNet HiRISE and a CTX TRN model after co-alignment, highlighting systematic offset/registration effects; that is not necessarily equal to either dataset's standalone vertical accuracy: <https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2023EA003045>.

### What our code actually computes

- `auditDemMetadata(dem)`: valid fraction and angular-pixel surface distance at a central latitude. Displays why posting is not accuracy.
- `compareAlignedDems(primary, reference)`: only after two **differently named and declared matching datum** numeric grids are supplied. At primary sample coordinates, bilinearly interpolate the independent reference; ignore NoData/out-of-coverage samples. Return paired bias (mean signed difference), residual RMS, residual scatter and range.
- `posteriorVerticalBias(sampleMean, parameters)`: optional normal-normal conjugate update for a mean offset using user-provided Gaussian prior mean/SD, observation SD and **effective independent sample count**. Without these, nothing is computed. The posterior is **conditional on the assumptions**, not evidence of planetary terrain accuracy.

**Not implemented:** verified matching HiRISE source for our exact 104×96 region; non-rigid registration; spatial covariance estimation; independent error budget; an end-to-end local uncertainty model. The UI does not claim otherwise. Even matching text labels for datums cannot establish actual geodetic agreement: scientific source documentation and independent checking are required.

## 5 — Complexity and performance constraints

- D* Lite: graph update touches up to a two-cell radius around changed exclusion mask cells, followed by priority-queue propagation. Worst case may approach a new full graph search; UI requires manual trigger.
- Pareto: multiobjective shortest paths can have exponentially many nondominated labels. Hence the explicit bound on labels and expansions; `truncated` invalidates claims of a complete frontier.
- Topology: sorting valid heights is `O(N log N)`; four-neighbor union-find is near-linear after sorting. For our 9,984-cell clip it is cheap enough for a browser without workers.
- DEM audit: pair sampling is `O(N/stride²)`, with a bilinear reference lookup for each cell.

The app deliberately remains plain ES modules, with no backend secrets, hosted decision services or external package dependencies. Adding React/TypeScript, Three.js or serverless compute to these four mathematical modules does not itself improve their validity.

## 6 — Honest next scientific steps

1. Obtain a licensed **overlapping and co-registered HiRISE reference DTM**; document Mars body radius, longitude direction, planetocentric/planetographic convention and vertical reference.
2. Compute overlap and reference-aligned uncertainty diagnostics, including sensitivity to registration and NoData/edge effects. Only after this can a calibrated error model be considered.
3. Compare D* Lite/A* outputs across many validated scenarios on the real DEM (not only synthetic fixtures).
4. Estimate sensitivity of Pareto membership to DEM uncertainty; if a candidate is dominated after reasonable height perturbations, report instability, not safety.
5. Use independent science target annotations with cited NASA data, not an arbitrary geology/utility score inferred from relief.
6. Test browser rendering/keyboard/mobile in the public V9 preview before promoting to production. Maintain rollback and no pre-review merges.

## Submission language

> Mars Atlas has independent A*, D* Lite and bounded multiobjective route search over a real NASA/USGS Jezero CTX DEM clip, plus 0D threshold topology and an optional DEM comparison workflow. User-configured physical and statistical assumptions are labeled illustrative. Route safety, geological targets and vertical accuracy are not certified by the project.

**NASA original source**: Mars Reconnaissance Orbiter Context Camera, USGS Mars 2020 TRN CTX DTM (Fergason et al., 2020), DOI <https://doi.org/10.5066/P906QQT8>. Source metadata, attribution and exact coverage are recorded in NASA_DATA.md and docs/SCIENCE_VALIDATION.md.
