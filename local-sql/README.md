# Mars Atlas — database and access

This public folder is intended for InfotronX Horizon teammates and code reviewers. SQL is **not a secret**. Never commit passwords, JWTs, secret/service-role API keys, database dumps, private mission contents or personal credentials.

## Setup

1. Create a **new Supabase project named Mars Atlas**. Do not reuse MathHard or InfotronX Programming Atlas.
2. In SQL Editor, execute **01_mars_cloud_schema.sql** once. Review it before rerunning.
3. Execute **03_mission_email_sharing.sql** to add email-based sharing with verified accounts. Apply **04_owner_insert_returning_rls_fix.sql** to existing deployments. Apply **05_mission_chat_and_copilot.sql** to install private chat, block/report policies, AI request limits, indexes and Realtime publication. Then execute **02_security_checks.sql** and run the Database Security Advisor. Every exposed table must have RLS and account/mission-scoped policies.
4. Enable email/password sign-in with confirmation under Authentication. Set Site URL and Redirect URLs to the deployed site and the local test address.
5. Copy only the public project URL and **publishable** API key into src/cloud-config.js. Publishable keys are permitted in browser code because RLS protects the data. Never paste a service_role/secret key.
6. Test two real accounts: user A creates a mission; B cannot access it until A explicitly invites them; viewer can read but not edit; editor may update; only owner manages members and deletes missions.
7. The app keeps working in local-only mode before activation. Cloud controls appear once the valid project is configured. A live backend and real session still need end-to-end testing.

## Structure

- **mars_missions:** JSON mission content, routes/waypoints/notes/checkpoints, owner and optimistic revision.
- **mars_mission_members:** sharing roles viewer/editor per mission, shared by email through secured RPC functions, with viewer/editor access.
- **mars_mission_versions:** stored cloud snapshots; not an immutable external audit log.
- **mars_email_invitations:** pending access for email addresses without a confirmed account, restricted to the mission owner.
- **mars_private:** non-exposed UID-based RLS helpers; not a public API.

Cloud Save and Open are explicit actions; they do not claim realtime simultaneous editing. A stale revision rejects writes to avoid accidental overwrites. On-device mission data remain available independently.

Security references: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/api/securing-your-api

## Connected project

Supabase project: [Mars Atlas](https://supabase.com/dashboard/project/yuvdrjptwumbfzjsimoe). The browser client uses the public project URL and publishable key in `src/cloud-config.js` (no private credentials).

**Configure email confirmation redirects in Supabase Dashboard:** open Authentication → URL Configuration and use `https://mars-atlas-map.netlify.app` as the Site URL for the currently shared Netlify deployment. Include `https://mars-atlas-map.netlify.app/**`, `https://mars-atlas-mu.vercel.app/**` (only if still used), and `http://localhost:4173/**` in allowed redirects. Confirm settings and mail delivery by real account registration/confirmation, not by the config screen alone.

The schema and editor index are installed. Database table policies passed security checks; isolated, simulated owner/viewer/editor/uninvited access tests passed in a rolled-back transaction. Do not claim live auth or cross-device verification until you have tested real email accounts.

## Email sharing

The live Mars Atlas project has the email-sharing migration installed. The owner selects a cloud mission, enters an email address, and chooses **Can view** or **Can edit**. If an account with a verified matching email exists, access is granted immediately; otherwise the pending invitation is claimed automatically when that email signs in and refreshes the cloud library. The owner can revoke membership or cancel pending access.

**This is account-based sharing, not outbound email delivery.** The app does not send invitation emails. Share the Mars Atlas website link separately with your teammate. An email-delivery integration would require a separately secured server-side mail provider and rate-limiting.

Only project URLs and publishable keys are in browser code. No secrets or user email lists belong in the repository. Email addresses and pending invitations are protected by access checks; direct access to Auth users is not exposed.

## Mission save security fix

The policy update in `04_owner_insert_returning_rls_fix.sql` is already installed on the live Mars Atlas project. It fixes a PostgreSQL `INSERT ... RETURNING` rejection where a `STABLE` SELECT-policy helper could not see the new mission in the same SQL statement. The owner now matches directly on `owner_id = auth.uid()`, while teammates still require their existing explicit permissions.

The original failure was reproduced as SQLSTATE `42501` using a synthetic authenticated user. After the update, a test transaction passed mission `INSERT ... RETURNING`, a version snapshot, owner UPDATE, and denied uninvited reads and owner spoofing. The transaction was rolled back, leaving no fake accounts or missions.

## AI diagnostics and deployment status

The browser's **Mission Copilot → Check AI service status** calls the authenticated `mars-mission-copilot` Edge Function using `{ "action": "status" }` without consuming the paid model quota. The Edge Function is deployed on the Mars Atlas Supabase project (v2, 15 November 2026). It supports Supabase's modern `SUPABASE_PUBLISHABLE_KEYS` JSON and legacy publishable/anon variables. Do not treat a `503` response as meaning that no backend exists.

To enable actual OpenAI generation, the owner must set `OPENAI_API_KEY` directly under [Edge Function Secrets](https://supabase.com/dashboard/project/yuvdrjptwumbfzjsimoe/functions/secrets) and configure a billing-enabled OpenAI API account. Never put a secret in GitHub, Netlify frontend, team chats, or a support screenshot. The presence of a key is NOT proof that the model account has access; test a real authenticated response.

New chat, reporting and Copilot SQL is in `05_mission_chat_and_copilot.sql`; this makes the live schema reproducible for future environments. Global chat and real-time simultaneous waypoint edits remain unimplemented. Test RLS from two real accounts before inviting users broadly.

Netlify Drop is a **manual deployment** independent of GitHub `main`. Publishing an updated GitHub commit does not publish the latest UI to the current Netlify domain. The workflow `Verify` can compare public asset SHA256 and run anonymous Chromium tests when dispatched or on commits tagged `[public-audit]`.
