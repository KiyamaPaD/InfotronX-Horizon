# Mars Atlas V7 — Advanced research & independently built concepts

Date: 2026-11-14. This is an engineering comparison, not a claim of endorsement by NASA or the other project teams. **No code, UI assets, artwork, or proprietary data have been copied from the referenced repositories.** Shared algorithmic principles are implemented separately, with source links for intellectual provenance. Public access to a repository does not imply a reuse license.

## Systems studied

| Project / source | Relevant demonstrated capabilities | Honest lesson for Mars Atlas |
| --- | --- | --- |
| [NASA AMMOS MMGIS](https://github.com/NASA-AMMOS/MMGIS) and its [Isochrone](https://nasa-ammos.github.io/MMGIS/tools/isochrone), [Sightline](https://nasa-ammos.github.io/MMGIS/tools/sightline), [Viewshed](https://nasa-ammos.github.io/MMGIS/tools/viewshed) tools | Multi-mission GIS, multi-user drawing, DEM visualization, line-of-sight, timed reachable regions, layered data; mature production-scale feature set | Implement **small, testable, scoped** DEM operations. No pretend full MMGIS capability, SPICE ephemerides, true radio telemetry or all-surface viewshed |
| [NASA TIG](https://github.com/NASA-AMMOS/tig) | Stereo reconstruction, surface normals, slope and roughness, mesh and scene fusion | Model roughness as the RMS residual of a local fitted plane; never call it rock density or independently validated hazard |
| [JPL Next-Gen AutoNav](https://robotics.jpl.nasa.gov/what-we-do/research-tasks/next-gen-autonav-concept/) and [Perseverance AutoNav](https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-self-driving-perseverance-mars-rover-takes-the-wheel/) | Vision-based terrain classification combined with risk-aware planning using onboard stereo | Existing A* only models topographic grade and grid cells; rocks, sand, wheel slip and local terrain are unmodeled; do not misstate human EVA safety |
| [AEGIS](https://ammos.nasa.gov/aegis/) | Geology target scoring with onboard vision and science preference | Future: operator chooses science goals and sources, human stays in control. No auto-classification without model evaluation and labels |
| [OpenPlanetaryMap](https://openplanetarymap.org/) | Planetary basemaps, layer design and data discovery | Make scientific layers and legends explicit; add source-specific information and quality indicator before adding decorative 3D |
| [marsgis](https://github.com/naza-official/mars-maps) | Jezero-native projection, controlled raster preprocessing, rover footprint metrics, uncertainty and optimized routing | Separate the source DEM resolution from validated effective spatial resolution; never implicitly use Earth EPSG:3857 or treat unmeasured surfaces as safe |
| [MOMAR](https://www.momar.si/how-it-works/) | Jezero imagery, CTX/HiRISE data, terrain tools and advanced UI | Similarity makes basic “Mars map alone” a weak differentiator; explanation, observability of assumptions, reversible human decisions matter more |
| [The Sol Explorers](https://github.com/saracen66/the-sol-explorers) | 3D cinematic Mars, historical traverse markers, adaptive quality | High production quality is useful, but cinematic and precision science require separate, transparent asset sources; don't copy models or textures |
| [Tour de Mars](https://github.com/pengvil/Tour-de-Mars) | Compact real CTX grid, route planning, cautious hazard claims | Keep a small **real and measured** DEM clip as the offline demo, and label analytical vs measured inputs |
| [Mars Map 3D prototype](https://github.com/RISHI-1453/NASA_Space-Apps_Challenge_Martian_Map) | Planetary Cesium globe, streaming terrain, route-based model export | Interesting post-hackathon engineering, but substantial CDN/backend complexity. Not the next stability-critical change |

## V7 features selected and reasoning

### A. Slope + roughness inspector

- **Method:** least-squares plane over a complete 3×3 DEM neighborhood; derived local surface grade (%) and RMS elevation residual (m). Draw a sampled raster where border/NoData is unmistakably unknown.
- **Why:** NASA terrain operators analyze slope and roughness independently. A slope-only planner cannot characterize local variation in the height surface.
- **Limit:** effective DEM terrain detail can be coarser than its nominal 20m grid spacing. A small residual ≠ obstacle-free ground. A 3×3 estimator does not measure rocks or wheel support footprint.
- **Tests:** planar ramp has zero RMS roughness, central relief raises RMS, NoData is not assigned a safe value.

### B. DEM line-of-sight

- **Method:** bilinear elevation sampling along a straight line between the **first and last manually chosen waypoints**, with two optional endpoint heights; sampled at most 1/2 grid pixel spacing, plus first-order spherical Mars curvature.
- **Why:** helps inspect whether an imaginary line crosses modeled topography. A visible ray is not a communication guarantee (Fresnel zone, antenna, atmospheric loss, local rocks/DEM resolution not measured).
- **Limit:** if any height is missing, output is **unknown**. We do not implement NASA's SPICE-based orbital geometry, changing lighting conditions, or a full viewshed.
- **Tests:** planar ray unobstructed; ridge blocked; missing pixels unknown; changing endpoint heights changes outcome.

### C. Dijkstra time-reachability / isochrone

- **Method:** eight connected DEM cells, signed grade threshold, distance/speed time, user-selected slope slowdown, no diagonal cutting through NoData or scenario exclusion; gradient-colored travel-time bands in a measured DEM bounding box.
- **Why:** a map of **all modeled reachable cells under a time budget** answers a different mission-planning question from A* (one particular destination).
- **Limit:** modeled speed and slope slowdown are arbitrary scenario inputs, not calibrated astronaut locomotion. No guaranteed return-to-base, and chart shading is not a safety clearance. The algorithm is clipped to the imported DEM.
- **Tests:** flat-grid reach expands monotonically, slopes block at threshold, NoData and exclusion are respected, invalid speeds/budgets rejected.

## Other valuable concepts deliberately deferred

- Terrain-correct 3D playback (Cesium/Three.js), only after a fully documented georeferenced mesh and mobile performance/streaming budgets exist.
- Mineral science goals from CRISM, only after feature grids are spatially co-registered to the CTX DEM and independently validated.
- Local camera/CV feature extraction using HiRISE/rover images; training data and source licenses, test labels and uncertainty must be addressed first.
- HiRISE vs CTX uncertainty/fusion, requires actual co-registration residual studies and reference-height conventions, not an invented uncertainty percentage.
- Real collaboration and Supabase auth, requires user accounts, RLS and a distinct explicitly authorized database.
- Exoplanet/planetary physics simulator (beyond challenge scope) — rejected.

## Provenance and credits

- NASA Mars Reconnaissance Orbiter CTX, USGS Jezero TRN DTM: Fergason et al. (2020), DOI https://doi.org/10.5066/P906QQT8; see [`NASA_DATA.md`](../NASA_DATA.md) and [`SCIENCE_VALIDATION.md`](SCIENCE_VALIDATION.md).
- Third-party project architecture and method ideas are **references**, not source code dependencies. Mars Atlas module names and algorithms are our own implementation. Acknowledge inspirations as appropriate and respect reuse requirements.
