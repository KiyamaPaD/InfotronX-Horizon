-- Mars Atlas: fix RLS rejection of INSERT ... RETURNING for an authorized owner.
-- Applied to the live Mars Atlas Supabase project in November 2026.
--
-- A previously installed SELECT policy called only a STABLE helper that queried
-- mars_missions. On INSERT ... RETURNING, that helper can see the statement's
-- previous snapshot and miss the freshly inserted row, causing SQLSTATE 42501.
--
-- Keep RLS enabled. This adds no new privilege: owners were already authorized
-- to read their own missions. Sharing still uses the private membership helper.

alter policy mars_mission_select on public.mars_missions
    using (
        owner_id = (select auth.uid())
        or mars_private.can_read_mission(id)
    );

-- Verify with a signed-in test account and an INSERT ... RETURNING id, revision.
-- Also verify that an unrelated account cannot SELECT or INSERT for the owner.
-- Never grant anon access or relax the INSERT WITH CHECK policy.
