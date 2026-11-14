# Mars Atlas — InfotronX Horizon

**Competition:** NASA Space Apps Challenge **2026**  
**Team:** InfotronX Horizon · team season **2026–2027**  
**Project:** Mars Atlas — Collaborative Planetary Mission Intelligence

## Project overview

Mars Atlas is a browser-based, human-controlled mission planning and terrain-analysis environment centered on Jezero Crater. Users create, edit and compare potential exploration routes, add georeferenced field observations, preserve checkpoints and export complete missions. It combines public NASA/USGS Mars datasets with deterministic graph algorithms and scientific visualization.

The project is an independent entry by InfotronX Horizon, not a tool approved by NASA for actual exploration or astronaut navigation.

## The problem

Planning an exploration route requires decisions beyond drawing the shortest line: unknown terrain, elevation changes, potential exclusion regions, timing and limited resources can affect route choices. A map alone rarely explains the assumptions behind those decisions.

## Our approach

Mars Atlas retains direct human control. A map-first workspace supports route creation, waypoint movement, multiple plans and reversible edits. Numerical science modules use source-labeled elevation data to help users inspect alternatives and understand trade-offs.

### Engineering and scientific components

- Public NASA Mars Trek CTX, MOLA and Viking map imagery; numerical USGS/NASA MRO CTX Jezero digital terrain model.
- Spherical Mars coordinates, route distances, elevation profiles and slope-aware A* graph search.
- D* Lite incremental replanning for changed hypothetical exclusion regions and bounded Pareto route alternatives.
- Local terrain roughness, gradient, line-of-sight and time-reachability analysis.
- Haar multi-resolution altitude contrasts, sphere-weighted area integrals, hypsometry and Marching Squares contours.
- Empirical Wasserstein-1 and CVaR statistics over user-defined or illustrative distributions; 0D persistent topology of peaks and basins.
- Local mission checkpoints, JSON/GeoJSON exports, readable mission briefs and URL-copy sharing.

## Validation and limitations

The included Jezero numeric terrain clip contains **104 × 96 measured elevation samples** from a USGS/NASA CTX DTM with approximately 20 m nominal posting. Detailed source documentation and vertical/horizontal conventions are in `NASA_DATA.md` and `docs/SCIENCE_VALIDATION.md`.

Route lengths, slope estimates, travel speed and resource consumption are model-dependent. They do not establish safe mobility, verified oxygen consumption, radiation exposure, traction, actual radio reliability or real-time field telemetry. Limited-area DEM coverage does not represent the entire crater.

The last independently verified algorithm baseline was **118/118 automated tests** on V9. Later branding edits require a fresh CI and browser review before final submission. Live multi-account mission synchronization and authenticated cloud storage have not been delivered.

## Demonstration

1. Open a separate Jezero science mission and load the original-source DEM clip.
2. Draw/edit a route manually; inspect its source-driven elevation and slope information.
3. Compare A* alternatives, introduce a hypothetical region to avoid and inspect D* Lite replanning.
4. Explore route trade-offs, time reachability, terrain contours and source uncertainty.
5. Save a checkpoint, modify the route and export/share the mission.

## Team and project

**InfotronX Horizon** is the team name for the **2026–2027 season**. The competition entry itself is for the **2026 NASA Space Apps Challenge**. GitHub contributors and project roles should reflect actual human contributions and reviewed work; names and roles are not invented in this document.

Repository: https://github.com/KiyamaPaD/Mars-Atlas-NASA-2026 (may transfer to an organization).  
Latest V9 prototype: https://mars-atlas-nasa-2026-mmayo5ed1-kiyama1.vercel.app.

## Final acknowledgments — sources, software and AI tools used

This section is the single consolidated tooling disclosure for the final submission.

- **NASA/USGS data:** NASA Mars Reconnaissance Orbiter Context Camera (CTX) and USGS Astrogeology Mars 2020 Jezero DTM (Fergason et al., 2020; DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8)); NASA Mars Trek background imagery; Mars Global Surveyor MOLA and Viking Orbiter products. Verify the exact NASA challenge Resources-list eligibility before official submission.
- **Development and deployment:** GitHub, GitHub Actions, Vercel, JavaScript/HTML/CSS, Python for DEM preprocessing, Node.js for automated tests.
- **Generative AI assistance:** **OpenAI ChatGPT** was used extensively in research, software architecture, algorithm/code drafting and implementation, testing assistance and documentation. Automated tests verify specified behavior but do **not** replace independent human code review, geospatial validation or real-browser testing. Work produced with such assistance should not be misrepresented as exclusively authored by a particular teammate.
- **External research:** Public NASA/JPL MMGIS, TIG and planetary robotics references and general mathematical literature informed original implementation decisions. No source code from competitor repositories should be claimed as original if later reused; check licenses and record any actual third-party material.
- **Human contributors:** List each participant and their actual contributions only after the team supplies and confirms that information.

This acknowledgment must be kept accurate and completed before submitting the project.
