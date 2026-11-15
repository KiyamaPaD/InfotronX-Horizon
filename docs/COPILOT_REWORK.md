# Mission Copilot and interface revision

Based on GitHub main at 9cc507f. Earlier audit work and the superseded local assistant draft are preserved in the local stash named `Preserve local audit and preliminary design before syncing current main`.

The Copilot now offers question starters, anonymous alternative-route distances, and resource estimates calculated using saved scenario assumptions. No route titles, raw waypoints, observations or chat messages are included in those aggregate fields. The user's question and DEM source label still go to the provider only after consent.

Preview terrain route strategies invokes the existing local comparison solver. The user must load a numeric DEM, provide anchors inside coverage, inspect results and explicitly choose a candidate to add. The model receives no route-editing tool. Local fallback remains available when the AI backend or account is unavailable.

An answer arriving after a mission change is discarded. Local analysis supersedes an outstanding AI request. AI errors are displayed independently. A missing server-side provider key is identified as a configuration issue, with a link to the owner settings. The local report is only generated when explicitly requested; it is not appended to a failed AI answer.

The visual revision uses graphite surfaces, restrained Mars-orange accents, the original outlined orbit logo, and a more compact Copilot entry hierarchy. PureFlow's public home source was reviewed as a reference for hierarchy and spacing; no assets or code were copied. This is a first implementation of the visual direction, not a claim of complete cross-device visual acceptance.

## Verification

Run `npm test`. Start `python3 -m http.server 4173 --bind 127.0.0.1`, then run `node scripts/copilot-browser-smoke.cjs` with platform Playwright and `/usr/bin/chromium` available. `MARS_ATLAS_URL` overrides the URL. The browser smoke checks local output, prompt selection, consent, signed-out handling, missing-DEM proposals, the DEM strategy preview without automatic route creation, widths from 320 to 1480 pixels, keyboard-operated disclosures, draft preservation, and a delayed mocked AI response after switching missions. It also simulates the AI_NOT_CONFIGURED response to verify the explicit error and separate local report. The mock validates UI behavior, not provider availability.

The static site and Supabase Edge Function must be released together to include the expanded AI context. No deployment was performed. A real signed-in model response requires the existing Supabase function, database quota setup, and provider key/model access. No secret values were read or added. Test an authorized real question after release before claiming generative AI is live. Two-account collaboration and actual mobile hardware remain separate acceptance checks.


## Refined workspace

The header's Copilot shortcut opens the right tab, analytics category and expanded assistant together, including on mobile. Planning controls, map layers and route comparison can be folded without rebuilding their contents. Advanced science panels start closed, while the DEM lab, telemetry, waypoint list and Copilot remain immediately accessible. Route color, duplication and destructive actions live in Route options. Repeated mission objectives, a second route-summary panel and the redundant Last point action were removed from the UI. A hint identifies an empty active route when another route already contains data. The DEM context refreshes after terrain loads.

The reported live AI_NOT_CONFIGURED response maps to the function's missing OPENAI_API_KEY branch. No administrative Supabase binding or provider key is available in this machine; activation could not be completed here. The project owner must configure the key securely in Supabase Edge Function Secrets and then verify an authenticated model response. Never put that key in the static frontend or chat.


## No-payment default

Copilot starts in free local mode. The primary question form dispatches supported route, terrain, comparison, resource and safety questions to deterministic functions over the current facts. It makes no request to the AI endpoint and does not require sign-in, consent or an API key in this mode. Unsupported prompts receive a clear capability message; this is not a local language model. English and common Romanian topic keywords are recognized.

External generation is disabled by default behind Optional external AI. It requires an explicit mode switch, fresh consent, authentication and separately configured API billing. No free OpenAI API quota is assumed. The existing DEM preview and manually accepted candidates work independently of the external model.

Unit tests verify local numerical output, no-data handling and exclusion of empty route alternatives. The browser regression checks the default question flow generates no AI backend request; the optional external mode retains its consent, sign-in, stale-response and error checks.
