# Private Crew Profile — Mars Atlas

## Purpose

A Mars Atlas account can maintain a **self-described team profile**: display name, callsign, mission role, specialty, biography and an optional private profile photo. It is not a NASA astronaut credential, personnel record, license or verified professional badge.

The UI is under **Mission Center → Crew profile** and is optional. It does not affect the ability to create missions manually or use scientific tools without signing in.

## Backend

Dedicated Supabase Mars Atlas project `yuvdrjptwumbfzjsimoe` (EU). A migration named `mars_crew_profiles_private_avatars` was applied on November 15, 2026.

- `public.mars_crew_profiles`: owner UUID referencing `auth.users`, name, callsign, user-defined role, specialty, biography, optional private avatar storage path, timestamps.
- `storage.buckets`: `mars_crew_avatars` is **private**, with a 2 MiB maximum object size and MIME allowlist PNG/JPEG/WebP.
- `storage.objects` policies allow authenticated users to operate only within their own `<auth.uid()>/avatar.<format>` directory.
- Every read/insert/update/delete on `mars_crew_profiles` uses owner-scoped RLS. Data API roles are granted only the permissions required by those policies.

**Never ship a secret/service-role key in the client.** Only the project's publishable key is browser-accessible. Avatar previews use temporary signed URLs, valid for 15 minutes, after account ownership has been checked.

The account owner can replace and remove their image. No user listing, public photo gallery, public search or global chat identity exposure is enabled. Adding these later requires a separate, explicitly designed visibility and moderation policy.

## UI behavior and caveats

- The user must sign in through **Mission Center → Cloud library** before editing their profile.
- Uploaded image files must be PNG, JPEG or WebP and no larger than 2 MB.
- The interface displays name and initials if no private photo is present.
- On-device statistics summarize local mission counts, waypoints and observations; they are not official activity/achievement records.
- Profile creation never inserts random missions, sample waypoints or automatic observations.
- Changes are explicitly submitted by the user. Cloud profile and local mission plans are separate stores.

## Verification

Verified on the live Mars Atlas Supabase project:

- The table exists with RLS enabled.
- Four owner-scoped profile policies (SELECT, INSERT, UPDATE, DELETE) exist.
- A private avatar bucket exists with a 2 MiB limit and PNG/JPEG/WebP MIME allowlist.
- Four owner-scoped storage policies exist.

Automated unit tests mock logged-in Supabase responses and test metadata limits, avatar paths, signed URLs, upload/remove and unauthorized account handling. The Chromium smoke suite verifies the **signed-out** UI and that profile content is hidden.

A complete production end-to-end validation of a real authenticated photo upload, RLS denial from a second account, expiry after 15 minutes, and removal from another browser is **still outstanding**. Do not represent that missing test as completed.

The current Supabase security advisor also reports that leaked-password protection is disabled at the project level. Enabling it is recommended when configuring account security, and is independent of the crew profile migration. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Next version

An eventual opt-in public crew directory, global chat or shared photo identity must introduce explicit privacy/consent settings, rate limits, report/moderation flows, and role-independent membership/authorization checks before release. Chat message authorship must never be determined from user-editable display name or client-side role text.
