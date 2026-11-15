# Changelog

All notable changes to Mars Atlas. Format based on [Keep a Changelog](https://keepachangelog.com/), dates are `YYYY-MM-DD`.

## [1.0.0] - 2026-11-15

### Added
- Welcome screen with a 3D Mars (NASA Viking and MOLA imagery), the Sun, moons, satellites and a rocket, leading straight into route planning.
- One side panel that follows the Explore, Plan and Analyze steps; the map takes the rest of the screen. Panels can be hidden.
- Analyze dashboard in six explained steps: size, height, legs, comparison, 3D and a decision checklist, each with a plain sentence built from the route's own numbers.
- "How to choose a route" guide and a first-visit tutorial.
- A seventh Analyze step to ask questions about the route: local answers from your own numbers, or an optional AI explanation (sign-in and consent required).
- Low-power mode and an automatic watchdog that reduce effects when frames stay slow.
- 3D view of the whole planet using NASA's 3D model of Mars (NASA/JPL-Caltech): one texture, denser mesh lifted by real MOLA heights, the route anywhere on Mars, a space backdrop with moons, satellites and a rocket.
- Sign-in window at the start with guest mode. Guests are never saved and are warned before leaving; signed-in users are saved automatically to their account.
- Real places always on the planet (rover and lander sites, volcanoes, canyons, basins) with facts and NASA photos, a Fit route button, deeper zoom, and waypoints that can be dropped on the 3D planet.
- A quick window after each new waypoint with ready-made kinds (base camp, sample site, science target, photo stop, hazard and more) that fill in name, type, symbol, colour and a plan.
- The start page is one click away from the step bar; the Help button and the tour are now one.
- Legal pages: Terms of Use, Privacy Policy, Cookies and local storage, Credits.

### Changed
- The "All tools" view is calmer: only the first tool in each group is open, and the groups are named Overview, Terrain & math, Models & resources and Mission. All science, math and resource tools remain.
- Lower memory use: no automatic 3D at start, smaller terrain texture, GPU resources freed when views close.
- README and CONTRIBUTING rewritten.

### Notes
- Planning aid only. Not for real navigation. Not certified or approved by NASA.
