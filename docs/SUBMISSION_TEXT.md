# Submission text (English, ready to paste)

For the official NASA Space Apps Challenge 2026 form. Check every line against the live site before sending, and replace the bracketed items.

## Project title

Mars Atlas: a Martian map for planning and understanding a walk

## Team

InfotronX Horizon (Bistrița, Romania)

## Challenge

Interplanetary Survival Guide: Martian Map

## One-line summary

Mars Atlas lets you draw a route on Mars, see the terrain in 3D and 2D from real NASA and USGS data, and understand why one route is better than another, with every number labelled as measured, calculated, illustrative or your own note.

## Short description (about 100 words)

Mars Atlas is a free, browser-based planning workspace for walking on Mars. A 3D planet built on NASA's own model of Mars and a 2D map of NASA Mars Trek imagery let you place waypoints, follow the surface, fly over the route and read its height profile. A slider trades distance against relief and explains in plain words why the best route changes. A Planning Lab of 25 small models covers oxygen and battery, radio relay, turning radius, time windows and more. Nothing is presented as more certain than the data allows. It is a planning aid, not a navigation tool.

## Full description

**The problem.** Planning a walk on Mars is a chain of decisions: where to go, which way, how steep, how much oxygen, what happens if the radio drops. Maps show places and tables show numbers, but few tools connect them and explain the result.

**What we built.**
- A 3D Mars based on NASA's own 3D model of Mars (NASA/JPL-Caltech), lifted by MOLA heights, with four surface choices, 29 real places with NASA photos, routes that follow the surface anywhere on the planet, a route fly-over with a synchronized height profile, a surface view you enter by dragging a figure onto the map, and optional slope colours.
- A 2D map with NASA Mars Trek layers (Viking, MOLA, CTX, HiRISE) for drawing and editing routes.
- An Analyze view in eight explained steps: size, height, legs, comparison, 3D, decision checklist, questions and safety. A repeatable benchmark on the Jezero delta compares three routes and shows the penalty at which the ranking changes (about 10.6).
- A Planning Lab with 25 small, explained models.
- A tutorial, a route-choice guide, legal pages and accounts where guests are never saved.

**Honesty about the data.** MOLA heights on the 3D planet are 8-bit (about 115 m per level) and are labelled approximate. The 20 m USGS CTX height model covers a clip near the Jezero delta only; outside it slopes are shown as unknown, never as flat. The resource model (time, oxygen, energy) is an illustrative scenario, not telemetry. The mathematics are written out in the README and checked by automated tests.

**What it is not.** Not a navigation tool, not a safety approval, not certified or endorsed by NASA.

## NASA and USGS data and resources used

| Resource | How it is used |
| --- | --- |
| NASA/JPL-Caltech 3D model of Mars | The planet in 3D |
| NASA Mars Trek (Viking MDIM 2.1 colour mosaic, MOLA shaded relief and colour relief, MRO CTX and HiRISE imagery) | Map layers and surface textures in 2D and 3D |
| NASA/GSFC MOLA elevation | 3D relief and heights outside the Jezero clip |
| USGS Astrogeology CTX Mars 2020 Terrain Relative Navigation DTM, 20 m (Fergason et al., 2020, DOI 10.5066/P906QQT8) | Slopes, profiles and route planning near the Jezero delta |
| NASA Image and Video Library | Photos of the 29 places |

Full attribution: [CREDITS.md](../CREDITS.md) and [NASA_DATA.md](../NASA_DATA.md).

## Use of AI tools

The software was built with AI assistance (Claude by Anthropic) for code and documentation, reviewed and directed by the team. An optional in-app explanation feature uses an AI model only with sign-in and explicit consent. All other answers are computed locally from the route's own numbers.

## Links

- Live project: https://mars-atlas.com/
- Source code: https://github.com/mari0-th/InfotronX-Horizon
- Demo (video or slides): [paste the link here]
- Terms, privacy, cookies and credits: the Legal link in the site header

## Known limits

Relief is approximate outside Jezero. Zoom is limited by the source imagery (Viking tiles stop at zoom 7). Real planet textures and a full per-feature GIS comparison are still to do. The legal texts are templates and should be reviewed by a lawyer before public use.
