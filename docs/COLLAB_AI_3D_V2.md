# MARS ATLAS — Collaboration, Chat, AI Copilot & 3D Terrain V2

**Version:** 15 November 2026. Application remains manual-first: no AI or chat function is required to edit a map, route, waypoint, observation or mission.

## 1. Authenticated collaboration already available

Existing features: Supabase cloud mission saving, per-mission viewer/editor invites by confirmed email, optimistic revision conflict detection, revision snapshots and local JSON export. Chat does not grant cloud editing rights. Only the existing `mars_missions` RLS and mission member `access` attribute determine editor rights.

**Team chat** is in **Mission Center → Team chat**. A team member must first:
1. Sign in from Mission Center → Cloud library.
2. Save their mission to the cloud, or accept an invitation to someone else's mission.
3. Open Team chat and choose an authorized cloud mission.
4. Type and send a message. Users may delete their own messages, report or block another author, and unblock later.

Conversations are stored in `public.mars_mission_chat_messages` and are not exported in a mission's JSON file. Realtime Postgres Changes is enabled for that table and scoped to the selected mission; a polling fallback checks for new messages at 12-second intervals while the panel is open. **This is live chat, not live co-editing** of routes. Realtime access is still subject to database RLS.

The backend additionally uses:
- `mars_chat_blocks`: a user's own personal block list, used by the chat message SELECT policy to hide blocked authors.
- `mars_chat_reports`: reporter-owned reports of other users' messages. Reports are **stored for administrative review**, not automatically moderated or guaranteed to be handled within a certain time.
- An INSERT trigger imposing **at least three seconds between sends** and **at most 10 messages in a 60-second window** per account, using a transaction-scoped advisory lock.
- A composite mission ID and time index, row-level permission checks and a limited fetch of the newest 60 messages.

**RLS guarantees:** authenticated users can read/send only in missions they own or have explicitly been added to. Message author ID is compared with `auth.uid()`; only the author may delete their own message. Blocks can only be created/removed by their owner, and a reporter cannot report their own message. The backend uses existing audited private-schema `mars_private.can_read_mission` checks.

### Why no public global chat yet?

A public conversation needs actual staffed moderation, reporting workflows, spam/abuse controls and published retention/visibility rules. That infrastructure is not complete, so **global chat is intentionally disabled**. Never describe the team-only conversation as a launched global chat network.

## 2. Numeric WebGL 3D terrain

Location: **Science → Terrain → 3D Terrain Explorer → Explore numeric terrain in 3D**.

- Loads the currently selected numeric DEM (bundled Jezero CTX sample or independently imported validated JSON).
- Creates actual 3D mesh vertices from grid coordinates and elevation values in meters.
- Each triangle is emitted only if all of its source numeric cells are valid. NoData samples remain holes.
- The color gradient conveys **relative elevation only**, not measured visible-spectrum color or a photo mosaic.
- Orange dots show user waypoints mapped to the nearest supported DEM cell. They are visualization anchors, not scientifically corrected physical route locations.
- Native WebGL 1 renders a 3D terrain surface without JavaScript libraries or a remote 3D service.
- Drag/touch = orbit; mouse wheel = zoom; sliders = viewing angle and vertical exaggeration 1×–20×. Displayed exaggeration is **purely visual**, not part of DEM calculations.
- Graceful status fallback if WebGL is not available. 2D elevation tools and the map continue working.

**Limitations:** Approximate Mars spherical horizontal coordinates, source DEM quantization, no NASA 3D texture, no rover collision testing or safe 3D route assessment. A 3D render never increases numeric spatial resolution.

## 3. Local and optional AI Mission Copilot

Location: **Science → Models → Mission Copilot**.

The first button, **Analyze mission with verified calculations**, is not an LLM. It uses the existing deterministic JavaScript geometry and DEM sampling without a cloud account.

The optional external **Ask AI** workflow is implemented as a read-only Supabase Edge Function, `mars-mission-copilot`, with `verify_jwt: true`. It also independently checks Supabase Auth using the supplied user JWT.

**Activating real AI:** The project owner must create the `OPENAI_API_KEY` secret on the *Supabase project server*, not in `src/cloud-config.js` or the static site. An optional `OPENAI_MODEL` secret can override the default `gpt-4.1-mini` in the Edge Function. No API key has been added by this implementation, and a working paid model response is **not yet verified**.

The endpoint:
- Requires a signed-in user, explicit per-request consent and a question 1–240 characters.
- Accepts only a bounded summary of active route distance, counts, optional DEM source/coverage and previously modeled route statistics. **No raw waypoint coordinates, mission titles, observation text, chat messages, passwords or photos** are transmitted.
- Uses OpenAI's Responses API with `store: false`, bounded output, explicit read-only scientific instructions and **no function/tool write permissions**.
- Limits the invoking account through an RLS-protected `mars_copilot_requests` table and a trigger to five requests per ten minutes. External upstream costs remain the project owner's responsibility.
- Returns a clear unavailable message when a server secret or upstream AI provider is unavailable. It does not silently fall back to fake AI answers.
- Does not issue mission editing/database writes other than the request quota accounting itself.

Full scientific source and model assertions still belong to the deterministic route engine. The AI is an explanatory option only and cannot establish route safety.

References: [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth); [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses).

## 4. Backend audit and unfinished checks

Live project: dedicated Mars Atlas Supabase, project ref `yuvdrjptwumbfzjsimoe`.

Created or modified:
- `mars_mission_chat_messages`: three RLS policies, indexes, rate trigger and Realtime publication
- `mars_chat_blocks`: three RLS policies
- `mars_chat_reports`: two RLS policies
- `mars_copilot_requests`: two RLS policies and request-rate trigger
- Edge Function `mars-mission-copilot` with a user JWT requirement

**Verified:** table creation, RLS policy presence, publication registration, active Edge Function status, security advisor review and automated code/unit tests.

**Outstanding:** manually testing a complete owner/viewer/editor conversation from distinct live accounts; cross-account RLS and block verification using real authenticated tokens; reviewing what happens if a member is removed mid-session; configuring and paying for the model key; a successful real AI provider response; 3D view QA on devices with different GPU/WebGL support; Netlify redeployment of the exact GitHub SHA.

The Supabase security advisor currently reports **Leaked Password Protection Disabled** for Supabase Auth. Project owners should consider enabling this in Auth configuration: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 5. Deployment

The static site is published through manual uploads to https://mars-atlas-map.netlify.app/. Updating the GitHub `main` branch **does not automatically publish the latest code to this Netlify site**. Download a ZIP pinned to the chosen SHA, extract it and upload the extracted site folder inside the *existing* Netlify site Deploys section. Retest in an incognito browser; do not mistake local CI for public deployment.

The repository remains a single `main` branch, with separate coauthor work happening on the same branch. Never force-push or overwrite the teammate's work.
