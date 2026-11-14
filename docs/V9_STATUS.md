# V9 — Team workstream takeover (review candidate)

**Target branch**: `feature/team-algorithms-v9` based on `feature/math-research-v8`. Public production `main` is not promoted.

## Implemented now

- D* Lite fixed-start/goal incremental replan under user-defined hypothetical exclusion zones, with independent A* cost check.
- Two-objective Pareto label-setting on DEM (distance vs cumulative ascent) with explicit completeness bounds and manually editable alternative routes.
- 0D persistent topology of superlevel peaks and sublevel basins using 4-neighbor union-find, elder-rule pairing and plateau-safe thresholds.
- Local DEM metadata quality check; optional independent reference DEM JSON residual comparison with matching datum declarations; optional user-parameterized conditional Gaussian posterior for a global height offset.
- Dedicated Science panel `ADVANCED ALGORITHMS`, keyboard and touch-friendly controls, Mission Brief append when context is current.

## What is not complete

- No independently downloaded matching HiRISE DTM has been compared to the V8 Jezero CTX clip. This is the largest blocker for Issue #22. Results from the published regional papers are not local accuracy measurements.
- D* Lite does not handle moving starts, streamed live rover observations, changing DEM heights or realtime collaborative updates; it only updates user-entered exclusion cells on a fixed DEM.
- Pareto is bounded, only between two operator-selected waypoint anchors, and has only two objectives (distance/ascent), not a combined science stop utility. The full solution for Issue #25 is intentionally NOT claimed.
- Topology computes 0D peak/basin persistence, not full Morse–Smale segmentation, Morse index, 1D holes or geological significance.
- Frontend needs an on-device, deployed-browser end-to-end review before release.

## Review route

1. Open V9 preview, press **Open real-data Jezero demo**, then **Load official Jezero CTX elevations**.
2. Science → Advanced Algorithms → **Initialize baseline D* Lite**; note cost and expanded vertices.
3. In DEM Route Lab select the **Hypothetical survey obstruction** observation and a 70–90 m radius, then press **Replan with current exclusion**. Check D* Lite/A* cost equality and what-if disclaimer. Remove exclusion and replan again.
4. Run **Compute distance/ascent tradeoffs**. Study non-dominated alternatives and explicit `truncated` label; add an editable candidate and verify the original route persists.
5. Choose **Analyze elevation connectivity** at persistence 2 m and 5 m; verify threshold changes the number of peaks/basins rather than inventing geology labels.
6. Run **Audit loaded DEM metadata**. It must state that numerical posting is not accuracy. Only use **Compare my independent DEM JSON** if you genuinely have another reference with documented matching vertical/horizontal datums.
7. Export Mission Brief, JSON and GeoJSON; verify scenario provenance and ability to continue editing. Repeat smoke tests on mobile.

## Issue mapping

- #22 DEM error model: honest metadata and optional comparison UI delivered; actual co-registered HiRISE validation remains blocked.
- #23 D* Lite: core incremental fixed-endpoint implementation delivered; benchmark and review remain.
- #24 Terrain topology: 0D persistent components delivered; full Morse/contour tree is not delivered.
- #25 Pareto: 2-objective bounded labels delivered; science-stop utility and global-complete frontier are not delivered.

See docs/V9_RESEARCH.md for derivations, limits and literature. No external code copied.
