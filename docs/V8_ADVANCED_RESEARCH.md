# MARS ATLAS V8 — Applied Mathematics Research & Engineering Record

**Date:** 2026-11-14 · **Branch:** `feature/math-research-v8` · **State:** review candidate, not production-approved.

## Executive decision

We examined planetary GIS, autonomous navigation, image processing, geomorphometry, stochastic optimization and robust route planning. Our selection criterion is not the number of sophisticated terms in a slide. The feature must operate on a real numeric DEM or on explicit user assumptions, produce an intelligible result, have deterministic tests, and preserve the **manual-first** principle. It must never silently convert a terrain image into physical measurements, or call hypothetical EVA estimates NASA telemetry.

We selected three new operations:

1. **Spherical area-weighted hypsometry** on the USGS/NASA MRO CTX numerical Jezero DEM clip.
2. **Marching Squares level-set extraction** and spherical-coordinate segment length, including a documented ambiguity rule and NoData behavior.
3. **Paired empirical resource-distribution comparison** using upper-tail conditional value at risk (CVaR) and 1D Wasserstein optimal transport. These are hypothetical tests unless scientifically calibrated inputs become available.

These complement earlier V7/V7.1 A*, Dijkstra reachability, 3×3 slope/roughness, line of sight, and Haar height contrast. Each new mathematical module is independently implemented; **no source code or artwork from third-party repositories was copied**. The NASA/USGS dataset must still receive its requested attribution.

## 1. What existing projects taught us — evidence and limitations

| System / research | Verified functionality or mathematical connection | Adaptation in Mars Atlas | What we must NOT imply |
| --- | --- | --- | --- |
| [NASA AMMOS MMGIS](https://github.com/NASA-AMMOS/MMGIS) / [Isochrone](https://nasa-ammos.github.io/MMGIS/tools/isochrone) | Mature 2D/3D planetary mapping, multi-user drawing, multi-model isochrones, sightline and viewshed | Build comprehensible standalone numerical analyses and visible assumptions | Mars Atlas is not a copy or a flight-ready MMGIS replacement |
| [NASA JPL Next-Gen AutoNav](https://robotics.jpl.nasa.gov/what-we-do/research-tasks/next-gen-autonav-concept/) | Vision-based terrain classifier plus risk-aware planner | Pair terrain route planning with uncertainty labels and human decisions | We do **not** detect rocks, wheel slip, or classify soil from CTX DEM |
| [JPL Field D*](https://www-robotics.jpl.nasa.gov/what-we-do/research-tasks/d-integration-into-mer/) | Incremental re-planning when travel costs change | Future: D* Lite when frequently updating obstruction observations, instead of full A* every time | We have not implemented incremental D* in V8 |
| [JPL Mars Global Localization (2026)](https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-now-autonomously-pinpoints-its-location-on-mars/) | Matching onboard terrain images with orbital maps to improve autonomous localization | Future: registration and calibrated localization uncertainty, distinct from mapping | The current site does not know a rover's actual location |
| [scikit-image Marching Squares](https://scikit-image.org/docs/stable/api/skimage.measure.html#skimage.measure.find_contours) | Linear sub-cell interpolation; diagonal high/low saddle ambiguity; masked/no-data handling | Independently extract clipped, geometrically plausible DEM contour segments | An interpolated line is not a measured continuous surface or a geological boundary |
| [Mars basin hypsometry study (2025)](https://doi.org/10.1016/j.epsl.2025.119226) | Elevation-area distributions help study basin formation and landscape history | Area-weighted Jezero height distribution, integrated with spherical measure | Local 104×96 sample cannot establish ancient oceans or climate processes |
| [SciPy Wasserstein-1 documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.wasserstein_distance.html) | Optimal transport in one dimension, equivalently integral of absolute CDF/quantile differences | Compare full empirical duration/O₂/Wh distributions, not only averages | W₁ is not a probability that either route is safe |
| [POT 1D OT](https://pythonot.github.io/_modules/ot/lp/solver_1d.html) | Exact 1D quantile coupling, weighted distributions | O((n+m) log(n+m)) exact empirical implementation, no Python dependency | Neither sample distribution is calibrated using NASA suit measurements |
| [Distributionally robust motion planning with CVaR (ICRA 2020)](https://doi.org/10.1109/ICRA40945.2020.9196857) | Combines Wasserstein ambiguity with CVaR motion-planning risk constraints | Educate future robust planning; current V8 only estimates empirical tail means | A computed CVaR is **not** a solved distributionally robust chance-constrained plan |
| [Fast Marching / eikonal](https://escholarship.org/uc/item/7kx079v5) | Continuous wavefront arrival-time solutions via an upwind discretization, typically O(N log N) | Future smoother route-time fields beyond 8-neighbor Dijkstra | Our current Dijkstra is **not** a fast-marching PDE solver |
| [NASA AEGIS](https://superintelligence.jpl.nasa.gov/public/projects/aegis/) | Human-configurable science-target profile + onboard target recognition | Future: operator-selected science targets tied to validated observations | No autonomous rock-detection or spectrometer exists in Mars Atlas |

## 2. Spherical Lebesgue-area measure and hypsometry

Let \(R=3\,396\,190\,\mathrm m\), \(\phi\) be planetocentric latitude and \(\lambda\) east-positive longitude, both in radians. For a region \(D\) on a reference sphere:

\[
\mathrm{Area}(D)=R^2\int_D\cos\phi\,d\phi\,d\lambda.
\]

The area of the DEM cell centered at latitude \(\phi_r\), with angular height \(\Delta\phi\) and width \(\Delta\lambda\), is:

\[
A_r=R^2\Delta\lambda\,\Big(\sin(\phi_r+\Delta\phi/2)-\sin(\phi_r-\Delta\phi/2)\Big).
\]

V7.1 already implemented this in `marsCellAreaSqMeters`. V8 constructs an **area-weighted elevation measure** \(\nu(B)=\sum_{i:z_i\in B}A_i\) over valid numerical sample heights. Normalized by total valid area, \(P(B)=\nu(B)/\nu(\mathbb R)\) becomes the empirical **area fraction** in elevation range \(B\). We compute:

- histogram of elevation bands, each measured in km² and fraction of valid DEM area;
- cumulative area-at-or-below the bin's upper elevation;
- area-weighted mean \(\bar z=\sum_iA_i z_i/\sum_iA_i\);
- area-weighted median, the first sorted elevation where cumulative valid area reaches 50%.

**Limits:** area is measured on a *reference sphere* at the DEM sample spacing, not the corrugated 3D terrain area. Histogram values are discretized cell-center summaries. No interpolation of unknown areas, automatic geological classification or ocean inference.

## 3. Marching Squares and the coarea formula

A level set of an elevation surface \(z(x,y)\) at height \(h\) is \(L_h=\{(x,y):z(x,y)=h\}\). To approximate the line where an edge from height \(z_a\) to \(z_b\) crosses \(h\), we use the linear interpolation fraction

\[
t=\frac{h-z_a}{z_b-z_a},\quad p=(1-t)p_a+tp_b.
\]

Each complete 2×2 DEM cell contributes 0, 1 or 2 segments. A saddle with four crossings is ambiguous; **our documented rule** checks the arithmetic-mean center height and connects crossing edges around corners on the *opposite* side from the center. A tie uses center ≥ level. This is a consistent deterministic choice, **not** the topology of a proven smooth bilinear interpolant at the saddle. Cases intersecting NoData are omitted without bridging. Open contours at the DEM edge are legitimate. The output is a collection of line segments rather than a guaranteed polygon topology.

Each segment's length is calculated with the spherical Mars distance formula between linearly interpolated planetocentric coordinates. Reported total length \(\ell_h\) is the sum of sampled contour segments, NOT an exact geodesic of an unknown underlying continuous surface.

A deeper mathematical relationship is the **coarea formula**. Under suitable regularity conditions for an elevation function \(z\) on a surface \(M\),

\[
\int_M \lVert\nabla_M z\rVert\,dA=\int_{-\infty}^{\infty}\mathcal H^1(z^{-1}(h))\,dh,
\]

where \(\mathcal H^1\) is contour length and \(\nabla_M z\) the surface gradient. A related formal relation for regular heights is

\[
\frac{d}{dh}\operatorname{Area}\{z\le h\}=\int_{z=h}\frac{1}{\lVert\nabla_M z\rVert}\,d\ell.
\]

**What we implemented** is the *discrete, sampled* height histogram and interpolated contours, NOT a rigorous numerical proof of the full continuous coarea identity on the actual Martian terrain. Numerical comparisons across DEM resolutions would be needed to quantify error.

Time: O(W×H) per contour level and hypsometry scan plus O(N log N) for the weighted median. All V8 sample arrays are bounded by the DEM size. Pure functions are independent of browser state.

## 4. Conditional Value-at-Risk (CVaR), expected shortfall and robust decisions

For a random *cost* \(X\) and confidence level \(\alpha\in(0,1)\), the expected upper-tail loss is

\[
\mathrm{CVaR}_\alpha(X)=\frac{1}{1-\alpha}\int_\alpha^1 F_X^{-1}(u)\,du.
\]

V8 computes this **exactly on an empirical distribution** of at most 3,000 equal-weight observations: sort the values, accumulate from the greatest values downwards until the upper \((1-\alpha)\) sample mass is exhausted; weight the last sample fractionally if necessary. This is more precise than taking a rounded count of samples. For \(\alpha=0.90\), CVaR90 means the average of the costliest *10% of modeled outcomes*, not a 90% safe mission guarantee.

V8 produces, for two user-drawn route distances, paired synthetic outcomes

\[
T=\frac{\rho L}{1000\,v}+\frac{t_{\mathrm{science}}}{60},\quad O=T\,q_{O_2},\quad E=T\,P,
\]

where \(\rho\in\{1,2\}\) controls one-way/return, \(L\) is modeled route distance in meters, \(v\) walking speed (km/h), \(q_{O_2}\) oxygen kg/h and \(P\) electrical watts. For each iteration the **same** sampled speed, oxygen rate and wattage are applied to both routes; this is the *common random numbers* design for a fair route comparison. Trials use **independent uniform ±10–50% variations**, a chosen deterministic random seed and 500 iterations by default. Uniformity and independence are hypotheses with no NASA telemetry validation.

No physiological or mechanical terrain-effect factor is inferred from DEM elevation; CVaR does not correct that missing science.

## 5. Wasserstein-1 and optimal transport

For empirical distributions of the same quantity, with quantile functions \(Q_A\) and \(Q_B\),

\[
W_1(A,B)=\int_0^1|Q_A(u)-Q_B(u)|\,du.
\]

V8 sorts each sample array and walks the union of their quantile breakpoints; it computes the **exact 1D empirical W₁** even if sample counts differ. Its unit matches the underlying quantity (hours for duration, kg for oxygen, Wh for energy); it is never combined across different units into a meaningless scalar. A zero result means the empirical distributions are identical, not that the routes are equally safe. Wasserstein compares distribution shapes/locations, while CVaR emphasizes the expensive tail.

- **CVaR reference vs alternative:** which route has higher worst-tail modeled duration/O₂/Wh under the same assumptions?
- **W₁:** by how much are the *whole distributions* separated, in original physical units?
- **Where it fails:** arbitrarily selected distributions cannot produce real-world operational failure probabilities; high terrain slopes can add delays not in our model; no DEM vertical accuracy or suit physiological uncertainty distribution has been scientifically calibrated.

Complexity for two sample arrays of size \(n,m\): O(n log n + m log m) sorting, O(n+m) quantile merge.

## 6. Further research: what's actually worth building next?

| Rank | Advanced mathematics / computer science | What to do | Data prerequisite | Status |
| --- | --- | --- | --- | --- |
| 1 | **DEM uncertainty propagation / Bayesian inference** | CTX-to-HiRISE co-registration, residual height errors, confidence intervals on slope and route cost | Verified overlapping DEMs with known vertical reference | Not implemented; no synthetic error bars sold as science |
| 2 | **Multi-objective/Pareto optimization** | Frontier of route length vs ascent vs science-stop priority vs hypothetical resource budget | Operator goals and validated DEM/science sources | Candidate, not the current three fixed penalties |
| 3 | **D* Lite / dynamic shortest paths** | Incremental update after a new field-note exclusion, as opposed to recomputing global A* | Reliable blocked-cell updates, graph consistency | Strong algorithmic research topic |
| 4 | **Fast Marching / Hamilton–Jacobi eikonal** | Smooth travel-time potential on the gridded surface; compare with 8-neighbor Dijkstra grid artifacts | A calibrated motion-speed field | Separate PDE solver required |
| 5 | **Morse theory / persistent homology** | Robust peaks, basins, saddles across many levels, persistence to reject small artifacts | Multiple DEM resolutions and NoData-aware topology | High research value, moderate implementation cost |
| 6 | **Variational / Finsler geometry** | Direction-dependent cost for climbing vs descending; require full path ascent and motor/suit model | Measured locomotion/energy properties | Do not call arbitrary weights NASA calibrated |
| 7 | **Active learning / mutual information** | Prioritize science stops where observations most reduce model uncertainty | Real uncertainty map and science objective values | Human-first controls retained |
| 8 | **Differential geometry + 3D mesh normals** | Route-plotted actual DEM mesh, slope/orientation, georeferenced 3D with multiple LODs | Model datum, correct texture georegistration | Useful after review, WebGL/Three.js optional |
| 9 | **SO(3) and quaternion probability** | Vehicle orientation/pose uncertainties, rotation-invariant sampling via Haar measure | 3D sensor/rover pose stream | Overkill for today's surface area calculator |
| 10 | **Spectral graph theory** | Graph Laplacian smoothness, segmentation, candidate traversability clusters | Validated multidimensional measured terrain features | Investigate complexity vs interpretability |

**Rule:** a new visual/hazard feature is acceptable only if its data provenance, numerical assumptions, uncertainty and reproducible tests can be explained plainly in the Mission Brief. Larger code size alone is not a competition advantage.

## 7. Test and manual-review plan

1. Load V8 from its separate Vercel preview; use **Open real-data Jezero demo** then **Load official Jezero CTX elevations** in Science → DEM Route Lab.
2. In Science → **Advanced Mathematics Lab**, click *Analyze elevation bands*. Verify all ten fractions sum to 100% (allow rounding) and total valid area agrees with V7.1.
3. Set a contour level within real DEM min/max (e.g., around −2570 m); click *Trace contour*. Verify visible segments, metric length, no-data legend, accessible text.
4. Duplicate a route; modify one manually, then select it as alternative. Run 500 paired scenarios. Verify CVaR90 / W₁ fields have the **correct units** and a clear synthetic-data disclaimer.
5. Export Mission Brief. If source mission, route, assumptions or inputs have changed after a calculation, stale outputs must not be exported.
6. Test keyboard focus, responsive mobile Science drawer, local saved routes, JSON/GeoJSON export, and the production/preview separation.
7. Flag any CTX tile/georeferencing issue, NoData region, or cross-reference/source mismatch. V8 does NOT guarantee a NASA Space Apps award or mission safety.

## Official source acknowledgement

The bundled raster is a numerical clip of **USGS Astrogeology / NASA Mars Reconnaissance Orbiter CTX Jezero TRN DTM**, Fergason et al. (2020), DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8), 20 m raster posting; see `NASA_DATA.md` and `docs/SCIENCE_VALIDATION.md`. Cite source data, GIS methods and third-party code used; consolidated tooling acknowledgments are in SUBMISSION.md. The reference repositories above were researched for general principles; source code was not copied in the V8 implementation.
