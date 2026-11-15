# MARS ATLAS — Live website, GitHub, Supabase and 3D/AI audit
**Date:** 15 November 2026 · **Team:** InfotronX Horizon

This is an engineering **verification snapshot**, not a blanket claim that every account workflow or production service has been tested. Manual-first planning and deterministic scientific calculations must remain usable without optional AI.

## 1. Public domains, deployments and actual code

| Target | Verified finding | Follow-up |
| --- | --- | --- |
| GitHub `KiyamaPaD/Mars-Atlas` `main` | Active source repository; GitHub Actions verifies JS and selected Chromium runs | Use a SHA-pinned archive for releases; do not force-push |
| `https://mars-atlas-map.netlify.app/` | HTTP 200; page booted and public Chromium interactions worked | Netlify Drop is a manual release; re-upload the current GitHub checkout |
| Public Netlify asset hashes | 10 of 14 files match the GitHub source at the time of audit; four lagged: `index.html`, `src/main.js`, `src/cloud-ui.js`, `src/mission-copilot-ui.js` | Redeploy exact current commit; rerun `Verify` manually or push `[public-audit]` |
| `https://mars-atlas-mu.vercel.app/` | Vercel project `mars-atlas` exists, but last production deployment inspected corresponded to commit `3b84049`, older than GitHub HEAD; team protection settings show SSO for protected deployment types | Do not use as the authoritative latest demo |
| Custom domain | No custom domain connection verified | Netlify `.netlify.app` is the site address actually used |

Evidence: public GitHub Actions audit [run 43721398211](https://github.com/KiyamaPaD/Mars-Atlas/actions/runs/43721398211), which uses the source-pinned `scripts/public-site-audit.mjs` and a real Playwright Chromium pass against Netlify.

### Confirmed on public Netlify (anonymous, actual user interaction)

- Homepage is reachable and JS initializes.
- Mission Center's team-chat tab exists; unauthenticated chat messages are correctly hidden behind sign-in.
- Bundled numeric Jezero CTX DEM loads into Analytics.
- WebGL 3D Terrain Explorer in Analytics renders the **real 104×96 DEM** with **9,984 valid numeric samples** and **19,570 triangles**, including source labels and correct altitude range.
- Local deterministic Mission Copilot reports route data without AI access or login.
- No uncaught browser JavaScript errors in this public inspection.

### NOT yet present in Netlify deployment at this audit

- **Check AI service status** button from the recent `src/mission-copilot-ui.js` changes.
- Coauthor's new **map-overlay whole-crater 3D button** from recent `src/main.js` changes.

These are release version mismatches, not missing files in GitHub. The app may further hide tools behind the new Explore → Plan → Analyze workflow: choose **All tools** and the corresponding Analytics tab when testing.

## 2. Copilot backend diagnosis (highest-priority user bug)

- Supabase project `yuvdrjptwumbfzjsimoe` is `ACTIVE_HEALTHY`, region `eu-central-1`.
- The actual authenticated browser invoked `POST /functions/v1/mars-mission-copilot`; Supabase logs contain **HTTP 503** responses on 15 November 2026. The request reached the backend. The old frontend's claim that the backend was unavailable masked several different causes.
- Edge Function `mars-mission-copilot` is **ACTIVE, version 2**, `verify_jwt: true`.
- Deployed v2 additionally reads current Supabase `SUPABASE_PUBLISHABLE_KEYS` JSON credentials, supporting legacy publishable/anon keys too.
- New authenticated, quota-free `{ "action": "status" }` request distinguishes a missing `OPENAI_API_KEY` from a configured endpoint. The frontend now shows specific error classes and deterministic fallback.
- Actual OpenAI model invocation is **not verified** because the presence of a provider key, API billing and model access cannot be confirmed from the accessible tools. Do not claim generative AI is live yet.

**Owner action:** set `OPENAI_API_KEY` directly via [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/yuvdrjptwumbfzjsimoe/functions/secrets) using an API account with appropriate billing and access. Never paste the secret into GitHub, Netlify, a chat or screenshot. When updated Netlify code is live, sign in and use Analytics → Models → Mission Copilot → **Check AI service status**, then test one real question. A configured-key status alone does not prove upstream access.

References: [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses).

## 3. Supabase database, Auth, Realtime, storage

Live database inspection confirmed:
- Mission tables `mars_missions`, `mars_mission_members`, `mars_mission_versions`, `mars_email_invitations` have owner/editor/viewer RLS policies.
- Crew profile table has owner-scoped SELECT/INSERT/UPDATE/DELETE RLS.
- `mars_mission_chat_messages` has mission-scoped RLS, sender INSERT validation and own-message deletion.
- `mars_chat_blocks` has owner-scoped RLS; `mars_chat_reports` has reporter-scoped RLS and restricted INSERT column privileges.
- `mars_copilot_requests` has owner-scoped RLS and a DB-enforced request quota.
- Mission chat is registered in the `supabase_realtime` publication.
- The avatar storage bucket `mars_crew_avatars` is private, max 2 MiB, PNG/JPEG/WebP, with folder-owner RLS policies.
- Five missing foreign-key indexes were created and verified; subsequent Supabase performance advisor had no unindexed foreign-key findings. Its 'unused index' INFO flags are expected on newly created/unused tables, not an immediate corruption signal.
- The security advisor still reports **Leaked Password Protection Disabled**: [enable it in Auth configuration](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The live schema of mission chat/moderation/Copilot is now reproduced as `local-sql/05_mission_chat_and_copilot.sql`.

**Not completed / requires actual separate authenticated test accounts:** owner/editor/viewer end-to-end permissions, signup email delivery and redirect configuration, avatar upload and signed URL expiry, private mission chat send/receive/block/report/revoke behavior, account removal and long-running Realtime behavior. A policy inspection cannot prove a real two-account workflow.

## 4. Map GIS and science

- NASA Mars Trek global Viking and local CTX/HiRISE PNG imagery; monochrome MOLA/HRSC hillshade; responsible source labels, coverage clipping, caching and tile reuse.
- Numeric DTM is separate from photographic imagery. Jezero study clip: USGS/NASA MRO CTX ~20 m posting, source DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8), limited region only.
- Haversine, source-backed DEM grid A*, D* Lite, bounded Pareto, 3-strategy comparison, Why This Route? deterministic cost identity `C = D + λ(A + H)`, hypothesized user exclusions, interactive elevation profile, export scientific comparison.
- Automated regression suite and earlier Chromium with NASA live tiles pass; this **does not** certify physically safe rover/EVA routes.
- Potential remaining map edge cases include slow external NASA tiles, long/mobile pan and uneven coverage.

### Two DIFFERENT 3D viewers

1. **Analytics → Terrain → 3D Terrain Explorer:** numeric CTX local DEM; source-elevation heights; validated in public Netlify Chromium.
2. **New map-level 3D button:** collaborator's whole-crater Three.js view; uses NASA *rendered 8-bit grayscale MOLA tiles* mapped through a presumed linear intensity-to-height transfer. This is not independently verified meter-calibrated elevation data. The software now labels whole-crater rendering **qualitative / illustrative**, not a validated elevation surface. The smaller 'Delta detail' mode still uses the documented numeric CTX DEM. A strong browser gate was added to insist on a real WebGL canvas and loaded terrain status rather than accepting 'could not load' as success. An independent check of the raster transfer function remains necessary before numerical science claims.

## 5. Current release gate and responsibilities

1. Verify the latest SHA and green JavaScript **and** browser CI before release.
2. Download the ZIP of that exact SHA, extract and manually upload the folder with root `index.html`, `src`, `assets` to the **existing** Netlify site Deploys. Do not create a new site.
3. Refresh the live site with a cache-busting hard reload; use **All tools** to see the whole workspace.
4. Rerun `Verify` manually via GitHub Actions and inspect `public-site-audit.json` plus `public-site-browser.json`. All 14 assets should match, and anonymous signed-out flows should succeed. The public 3D map viewer needs additional checks of CDN/WebGL.
5. Log in as two distinct test users and test mission save, role-based sharing, team chat, profile/photo, report, block and revocation. Never paste test-user tokens into public issue threads or chats.
6. Add and verify OpenAI API secret server-side if external generative AI is desired; local deterministic Copilot must remain available even without it.
7. Preserve citations, declared AI assistance, manual-first mission editing and the project's pre-hackathon development timeline. Confirm any challenge/eligibility requirements with organizers.

**Audit limitations:** The inspection used public unauthenticated browser sessions, GitHub Actions, Supabase SQL/advisors/logs, and Vercel deployment metadata. It did not gain access to arbitrary logged-in user sessions, the Netlify account's deployment history, hidden API secrets, or the external paid AI provider. Do not infer results for untested flows from tool presence alone.
