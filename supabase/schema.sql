-- Optional cloud persistence for a NEW, dedicated Mars Atlas Supabase project.
-- The standalone frontend works without this migration.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mars_missions
(
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 90),
    description text not null default '',
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint mars_missions_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists mars_missions_owner_updated_idx on public.mars_missions (owner_id, updated_at desc);

alter table public.mars_missions enable row level security;

drop policy if exists "Owners can read missions" on public.mars_missions;
create policy "Owners can read missions"
    on public.mars_missions for select to authenticated
    using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create missions" on public.mars_missions;
create policy "Owners can create missions"
    on public.mars_missions for insert to authenticated
    with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update missions" on public.mars_missions;
create policy "Owners can update missions"
    on public.mars_missions for update to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete missions" on public.mars_missions;
create policy "Owners can delete missions"
    on public.mars_missions for delete to authenticated
    using ((select auth.uid()) = owner_id);

-- In Supabase projects with restricted Data API exposure, grant table privileges explicitly.
grant select, insert, update, delete on public.mars_missions to authenticated;

-- Self-contained URL-fragment sharing is implemented in the static frontend.
-- A dedicated, authenticated cloud collaboration design can be added later.
