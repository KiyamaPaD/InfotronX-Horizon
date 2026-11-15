# Mars Atlas 1.0.0

**Explore Jezero. Plan a route. Understand the terrain.**

Mars Atlas is a manual-first Mars mission-planning workspace by InfotronX Horizon, built for the NASA Space Apps Challenge 2026. It uses public NASA and USGS data. It is a planning aid, not a navigation tool, and it is not certified or approved by NASA.

## Highlights

- **Welcome screen:** an interactive 3D Mars on real Viking and MOLA imagery with the Sun, moons, satellites and a rocket, then straight into route planning.
- **Plan in three steps:** Explore, Plan, Analyze. One panel at a time, with the map in front. Side panels can be hidden.
- **Analyze, step by step:** six explained steps (size, height, legs, comparison, 3D, decision) with animated charts and a checklist. Each step says what it helps with and gives a plain sentence built from your own numbers. Every figure is labelled calculated, measured, illustrative or your own note.
- **Ask a question:** a seventh step where you can ask about your route. Answers come from your own numbers, work offline and need no account. An optional AI explanation (sign-in and consent required) sends only route totals, never coordinates, titles or notes.
- **How to choose a route:** a short guide for comparing alternatives.
- **3D terrain:** Jezero Crater with your route, on a small planet in space with real Viking colour and MOLA relief, a corner globe, moons and shooting stars. The curvature and scenery are illustrations.
- **Science and math tools** remain in "All tools": terrain intelligence, advanced mathematics, resource and stress models, algorithms and data sources. The group is calmer, with the main tool of each section open.
- **Your work stays yours:** local autosave, exports, an optional cloud library with sharing, and the team's Insights dialog.
- **Smoother on modest computers:** a low-power mode and an automatic watchdog turn decoration down if frames stay slow.
- **Legal pages:** Terms of Use, Privacy Policy, Cookies and local storage, and Credits, also available inside the app at `legal.html`.

## Try it

- Live site: https://mars-atlas-mu.vercel.app/ and https://mars-atlas-map.netlify.app/
- Run locally:

```bash
git clone https://github.com/KiyamaPaD/Mars-Atlas.git
cd Mars-Atlas
npm run dev
```

Then open http://localhost:4173. Run the tests with `npm test`.

## Known limits

- The bundled elevation model covers only a small area near the Jezero delta. Outside it, heights are unknown and are never treated as safe.
- The 3D curvature, the globe and the space scenery are illustrations, not real positions.
- AI answers need a deployed Supabase function with a server-side model key. Without it, local answers still work.
- The interface was merged with the team's latest design and has not been fully checked on every browser and screen size. The browser map tests were not re-run for every change; run the `map-browser` workflow before relying on it.

## Credits, privacy and terms

[Credits](https://github.com/KiyamaPaD/Mars-Atlas/blob/main/CREDITS.md) · [Terms](https://github.com/KiyamaPaD/Mars-Atlas/blob/main/TERMS.md) · [Privacy](https://github.com/KiyamaPaD/Mars-Atlas/blob/main/PRIVACY.md) · [Cookies](https://github.com/KiyamaPaD/Mars-Atlas/blob/main/COOKIES.md) · [MIT licence](https://github.com/KiyamaPaD/Mars-Atlas/blob/main/LICENSE)
