-- Mars Atlas, InfotronX Horizon. Use only in a NEW dedicated Supabase project.
create schema if not exists mars_private;
revoke all on schema mars_private from public, anon;
grant usage on schema mars_private to authenticated;

create table if not exists public.mars_missions
(
    id uuid primary key,
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null check (length(trim(title)) between 1 and 90),
    description text not null default '' check (length(description) <= 300),
    payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 1048576),
    revision integer not null default 1 check (revision between 1 and 1000000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists mars_missions_owner_recent on public.mars_missions(owner_id, updated_at desc);

create table if not exists public.mars_mission_members
(
    mission_id uuid not null references public.mars_missions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    access text not null check (access in ('viewer', 'editor')),
    created_at timestamptz not null default now(),
    primary key (mission_id, user_id)
);
create index if not exists mars_members_user_lookup on public.mars_mission_members(user_id, mission_id);

create table if not exists public.mars_mission_versions
(
    id bigint generated always as identity primary key,
    mission_id uuid not null references public.mars_missions(id) on delete cascade,
    editor_id uuid not null references auth.users(id),
    revision integer not null check (revision > 0),
    payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 1048576),
    created_at timestamptz not null default now(),
    unique (mission_id, revision)
);

-- Internal UID-based helpers avoid RLS recursion. The schema must NOT be exposed in Data API.
-- SECURITY DEFINER deliberately queries membership without table RLS, but still checks auth.uid().
create or replace function mars_private.is_mission_owner(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
    select (select auth.uid()) is not null
       and exists (select 1 from public.mars_missions m
           where m.id = p_id and m.owner_id = (select auth.uid()));
$$;

create or replace function mars_private.can_read_mission(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
    select (select auth.uid()) is not null and
      (mars_private.is_mission_owner(p_id) or exists
       (select 1 from public.mars_mission_members mm where mm.mission_id = p_id
        and mm.user_id = (select auth.uid())));
$$;

create or replace function mars_private.can_edit_mission(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
    select (select auth.uid()) is not null and
      (mars_private.is_mission_owner(p_id) or exists
       (select 1 from public.mars_mission_members mm where mm.mission_id = p_id
        and mm.user_id = (select auth.uid()) and mm.access = 'editor'));
$$;

revoke all on function mars_private.is_mission_owner(uuid) from public, anon;
revoke all on function mars_private.can_read_mission(uuid) from public, anon;
revoke all on function mars_private.can_edit_mission(uuid) from public, anon;
grant execute on function mars_private.is_mission_owner(uuid) to authenticated;
grant execute on function mars_private.can_read_mission(uuid) to authenticated;
grant execute on function mars_private.can_edit_mission(uuid) to authenticated;

alter table public.mars_missions enable row level security;
alter table public.mars_mission_members enable row level security;
alter table public.mars_mission_versions enable row level security;

drop policy if exists mars_mission_select on public.mars_missions;
create policy mars_mission_select on public.mars_missions
for select to authenticated using (mars_private.can_read_mission(id));
drop policy if exists mars_mission_insert on public.mars_missions;
create policy mars_mission_insert on public.mars_missions
for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists mars_mission_update on public.mars_missions;
create policy mars_mission_update on public.mars_missions
for update to authenticated using (mars_private.can_edit_mission(id))
with check (mars_private.can_edit_mission(id));
drop policy if exists mars_mission_delete on public.mars_missions;
create policy mars_mission_delete on public.mars_missions
for delete to authenticated using (mars_private.is_mission_owner(id));

drop policy if exists mars_members_select on public.mars_mission_members;
create policy mars_members_select on public.mars_mission_members
for select to authenticated using (user_id = (select auth.uid()) or mars_private.is_mission_owner(mission_id));
drop policy if exists mars_members_insert on public.mars_mission_members;
create policy mars_members_insert on public.mars_mission_members
for insert to authenticated with check (mars_private.is_mission_owner(mission_id) and user_id <> (select auth.uid()));
drop policy if exists mars_members_update on public.mars_mission_members;
create policy mars_members_update on public.mars_mission_members
for update to authenticated using (mars_private.is_mission_owner(mission_id))
with check (mars_private.is_mission_owner(mission_id));
drop policy if exists mars_members_delete on public.mars_mission_members;
create policy mars_members_delete on public.mars_mission_members
for delete to authenticated using (mars_private.is_mission_owner(mission_id));

drop policy if exists mars_versions_select on public.mars_mission_versions;
create policy mars_versions_select on public.mars_mission_versions
for select to authenticated using (mars_private.can_read_mission(mission_id));
drop policy if exists mars_versions_insert on public.mars_mission_versions;
create policy mars_versions_insert on public.mars_mission_versions
for insert to authenticated
with check (editor_id = (select auth.uid()) and mars_private.can_edit_mission(mission_id));

-- Explicit grants complement RLS. No owner_id, mission_id or member user_id updates.
revoke all on table public.mars_missions from public, anon, authenticated;
revoke all on table public.mars_mission_members from public, anon, authenticated;
revoke all on table public.mars_mission_versions from public, anon, authenticated;
grant select, delete on public.mars_missions to authenticated;
grant insert (id, owner_id, title, description, payload) on public.mars_missions to authenticated;
grant update (title, description, payload, revision, updated_at) on public.mars_missions to authenticated;
grant select, insert, delete on public.mars_mission_members to authenticated;
grant update (access) on public.mars_mission_members to authenticated;
grant select on public.mars_mission_versions to authenticated;
grant insert (mission_id, editor_id, revision, payload) on public.mars_mission_versions to authenticated;
grant usage, select on sequence public.mars_mission_versions_id_seq to authenticated;

create index if not exists mars_mission_versions_editor_lookup
    on public.mars_mission_versions(editor_id);
