# Route insights and public interface

The public assistant is a calculated view of the current mission. Four topic buttons show route metrics, numeric DEM coverage, distances for populated alternatives and resource scenarios. No prompt form, provider setup, billing instructions, API-key settings, generated-language response or AI network call is part of this UI. Scientific sources and limits remain next to the relevant calculations.

The header shortcut opens the assistant's category and section. It appears first in Models. Sidebar tools and route comparisons fold without losing their contents. Advanced scientific sections start closed. Mission Center has keyboard navigation and a wrapping mobile tab grid. Administration and API configuration remain in repository documentation rather than public controls.

## Verification

Run `npm test`, then `npm run build`. Serve the release with `python3 -m http.server 4175 --bind 127.0.0.1 --directory dist` and run `MARS_ATLAS_URL=http://127.0.0.1:4175/ node scripts/copilot-browser-smoke.cjs` with Playwright and Chromium installed.

In a headless environment that needs the machine's HTTPS proxy for public images/fonts, set `MARS_TEST_PROXY_ASSETS=1`. This forwards actual public asset responses using curl with normal TLS verification; it does not forward credentials or private backend requests.

The regression covers calculated cards, disclosures and keyboard access, real coordinate entry, reload, JSON export/reimport, DEM strategies, numeric WebGL rendering, signed-out account/profile/chat gates and widths from 320 to 1920 pixels. It checks control gaps, modal overflow and absence of AI requests and page errors. Authenticated two-account collaboration and actual phone hardware remain separate checks.

## Netlify package

`npm run build` copies an explicit allowlist to `dist`: root HTML, license, application modules, styles, assets and response headers. Internal SQL, reports, test code, server functions, root secret/env files and Git metadata are excluded. The public Supabase client configuration remains in the browser modules. Netlify's build config publishes `dist`. For manual Netlify Drop, use the extracted contents of `releases/mars-atlas-netlify.zip`.

Direct access to mars-atlas-map.netlify.app returned a proxy CONNECT 403 during this review. That result is a cloud-environment network restriction, not evidence of the website's own status. The domain was added to the environment configuration draft; draft saving does not apply the policy. Live deployment verification remains pending until the environment settings are applied. Local checks exercised the actual generated release folder and do not establish that Netlify is serving the same version.
