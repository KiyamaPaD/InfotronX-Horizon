# Mars Atlas — database and access

This public folder is intended for InfotronX Horizon teammates and code reviewers. SQL is **not a secret**. Never commit passwords, JWTs, secret/service-role API keys, database dumps, private mission contents or personal credentials.

## Setup

1. Create a **new Supabase project named Mars Atlas**. Do not reuse MathHard or InfotronX Programming Atlas.
2. In SQL Editor, execute **01_mars_cloud_schema.sql** once. Review it before rerunning.
3. Execute **03_mission_email_sharing.sql** to add email-based sharing with verified accounts. Then execute **02_security_checks.sql**, verify RLS on all four public tables and no anonymous grants. Run the Database Security Advisor.
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

**Configure email confirmation redirects in Supabase Dashboard:** open Authentication → URL Configuration, set Site URL to `https://mars-atlas-mu.vercel.app` and add the same URL plus `http://localhost:4173/**` in Redirect URLs for testing. Keep email/password provider enabled. Review email delivery quotas and confirmation behavior before distributing the login to external testers.

The schema and editor index are installed. Database table policies passed security checks; isolated, simulated owner/viewer/editor/uninvited access tests passed in a rolled-back transaction. Do not claim live auth or cross-device verification until you have tested real email accounts.

## Email sharing

The live Mars Atlas project has the email-sharing migration installed. The owner selects a cloud mission, enters an email address, and chooses **Can view** or **Can edit**. If an account with a verified matching email exists, access is granted immediately; otherwise the pending invitation is claimed automatically when that email signs in and refreshes the cloud library. The owner can revoke membership or cancel pending access.

**This is account-based sharing, not outbound email delivery.** The app does not send invitation emails. Share the Mars Atlas website link separately with your teammate. An email-delivery integration would require a separately secured server-side mail provider and rate-limiting.

Only project URLs and publishable keys are in browser code. No secrets or user email lists belong in the repository. Email addresses and pending invitations are protected by access checks; direct access to Auth users is not exposed.
