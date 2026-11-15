# Mission Copilot and interface revision

Based on GitHub main at 9cc507f. Earlier audit work and the superseded local assistant draft are preserved in the local stash named `Preserve local audit and preliminary design before syncing current main`.

The Copilot now offers question starters, anonymous alternative-route distances, and resource estimates calculated using saved scenario assumptions. No route titles, raw waypoints, observations or chat messages are included in those aggregate fields. The user's question and DEM source label still go to the provider only after consent.

Preview terrain route strategies invokes the existing local comparison solver. The user must load a numeric DEM, provide anchors inside coverage, inspect results and explicitly choose a candidate to add. The model receives no route-editing tool. Local fallback remains available when the AI backend or account is unavailable.

An answer arriving after a mission change is discarded. Local analysis supersedes an outstanding AI request. Errors retain the existing deterministic fallback.

The visual revision uses restrained olive/charcoal surfaces, simpler borders, a single light accent, and a clearer Copilot entry hierarchy. PureFlow's public home source was reviewed as a reference for hierarchy and spacing; no assets or code were copied. This is a first implementation of the visual direction, not a claim of complete cross-device visual acceptance.

## Verification

Run `npm test`. Start `python3 -m http.server 4173 --bind 127.0.0.1`, then run `node scripts/copilot-browser-smoke.cjs` with platform Playwright and `/usr/bin/chromium` available. `MARS_ATLAS_URL` overrides the URL. The browser smoke checks local output, prompt selection, consent, signed-out handling, missing-DEM proposals, mobile overflow and a delayed mocked AI response after switching missions. The mock validates UI behavior, not provider availability.

The static site and Supabase Edge Function must be released together to include the expanded AI context. No deployment was performed. A real signed-in model response requires the existing Supabase function, database quota setup, and provider key/model access. No secret values were read or added. Test an authorized real question after release before claiming generative AI is live. Two-account collaboration and actual mobile hardware remain separate acceptance checks.
