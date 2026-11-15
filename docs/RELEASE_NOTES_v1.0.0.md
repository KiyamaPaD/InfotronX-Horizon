# Mars Atlas 1.0.0

**Explore Jezero. Plan a route. Understand the terrain.**

Mars Atlas is a manual-first Mars mission-planning workspace by InfotronX Horizon, built for the NASA Space Apps Challenge 2026. It uses public NASA and USGS data. It is a planning aid, not a navigation tool, and it is not certified or approved by NASA.

## Highlights

- **Welcome screen:** an interactive 3D Mars on real Viking and MOLA imagery, then straight into planning.
- **Plan in three steps:** Explore, Plan, Analyze, with one panel at a time and the map in front.
- **Understand the route:** distance on Mars's radius, height change and slope from a USGS CTX model, leg-by-leg bars, route comparison and a checklist. Every number says how it was made.
- **3D terrain:** Jezero Crater with your route on it, on a small planet in space.
- **Science and math tools** remain in "All tools": terrain intelligence, advanced mathematics, resource and stress models, algorithms and data sources.
- **Your work stays yours:** local autosave, exports, optional cloud library with sharing.

## Try it

Live site: https://mars-atlas-map.netlify.app/

Run locally:

```bash
git clone https://github.com/KiyamaPaD/Mars-Atlas.git
cd Mars-Atlas
npm run dev
```

## Known limits

- The bundled elevation model covers only a small area near the Jezero delta. Outside it, heights are unknown.
- The 3D curvature and the space scenery are illustrations.
- The browser map tests were not re-run for every change in this release; run the `map-browser` workflow before relying on it.

## Credits, privacy and terms

[Credits](../CREDITS.md) · [Terms](../TERMS.md) · [Privacy](../PRIVACY.md) · [Cookies](../COOKIES.md) · [MIT licence](../LICENSE)
