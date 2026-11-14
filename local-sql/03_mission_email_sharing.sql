-- Mars Atlas: verified-account mission sharing by email.
-- Run after local-sql/01_mars_cloud_schema.sql in the dedicated Mars Atlas Supabase project.
-- Invitations are stored in the database. This does not send an email notification.

create table if not exists public.mars_email_invitations
(
    mission_id uuid not null references public.mars_missions(id) on delete cascade,
    email text not null check (email = lower(btrim(email)) and length(email) between 5 and 254),
    access text not null check (access in ('viewer', 'editor')),
    invited_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    primary key (mission_id, email)
);

create index if not exists mars_email_invitations_email_lookup
    on public.mars_email_invitations(email);

alter table public.mars_email_invitations enable row level security;
revoke all on table public.mars_email_invitations from public, anon, authenticated;

drop policy if exists mars_email_invitations_owner_read on public.mars_email_invitations;
create policy mars_email_invitations_owner_read on public.mars_email_invitations
    for select to authenticated using (mars_private.is_mission_owner(mission_id));

drop policy if exists mars_email_invitations_owner_cancel on public.mars_email_invitations;
create policy mars_email_invitations_owner_cancel on public.mars_email_invitations
    for delete to authenticated using (mars_private.is_mission_owner(mission_id));

grant select, delete on public.mars_email_invitations to authenticated;

-- SECURITY DEFINER runs only in the unexposed mars_private schema.
-- All functions verify the caller's identity and mission ownership explicitly.
create or replace function mars_private.share_mission_by_email(p_mission_id uuid, p_email text, p_access text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
    v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
    v_user_id uuid;
    v_owner_email text;
begin
    if (select auth.uid()) is null or not mars_private.is_mission_owner(p_mission_id) then
        raise exception 'Not permitted to share this mission';
    end if;

    if v_email is null or pg_catalog.length(v_email) not between 5 and 254
       or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$'
       or p_access not in ('viewer','editor') then
        raise exception 'Enter a valid teammate email and access role';
    end if;

    select pg_catalog.lower(u.email) into v_owner_email
    from auth.users u where u.id = (select auth.uid());

    if v_email = v_owner_email then
        raise exception 'You already own this mission';
    end if;

    select u.id into v_user_id
    from auth.users u
    where pg_catalog.lower(u.email) = v_email and u.email_confirmed_at is not null
    limit 1;

    if v_user_id is not null then
        insert into public.mars_mission_members (mission_id, user_id, access)
        values (p_mission_id, v_user_id, p_access)
        on conflict (mission_id, user_id) do update set access = excluded.access;

        delete from public.mars_email_invitations
        where mission_id = p_mission_id and email = v_email;
        return;
    end if;

    if not exists (select 1 from public.mars_email_invitations
                   where mission_id = p_mission_id and email = v_email)
       and (select count(*) from public.mars_email_invitations
            where mission_id = p_mission_id) >= 25 then
        raise exception 'Too many pending invitations for this mission';
    end if;

    insert into public.mars_email_invitations (mission_id, email, access, invited_by)
    values (p_mission_id, v_email, p_access, (select auth.uid()))
    on conflict (mission_id, email) do update
        set access = excluded.access, invited_by = excluded.invited_by, created_at = now();
end;
$$;

create or replace function mars_private.claim_mission_email_invitations()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
    v_email text;
    v_count integer := 0;
begin
    if (select auth.uid()) is null then
        return 0;
    end if;

    select pg_catalog.lower(u.email) into v_email
    from auth.users u
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null;

    if v_email is null then
        return 0;
    end if;

    insert into public.mars_mission_members (mission_id, user_id, access)
    select i.mission_id, (select auth.uid()), i.access
    from public.mars_email_invitations i
    where i.email = v_email
    on conflict (mission_id, user_id) do update set access = excluded.access;

    get diagnostics v_count = row_count;
    delete from public.mars_email_invitations where email = v_email;
    return v_count;
end;
$$;

create or replace function mars_private.mission_member_directory(p_mission_id uuid)
returns table (user_id uuid, email text, access text)
language sql stable security definer set search_path = ''
as $$
    select m.user_id, u.email::text, m.access
    from public.mars_mission_members m
    join auth.users u on u.id = m.user_id
    where m.mission_id = p_mission_id
      and (select auth.uid()) is not null
      and mars_private.is_mission_owner(p_mission_id);
$$;

-- Invoker-only RPC functions are callable from the client with its user JWT.
create or replace function public.mars_share_by_email(p_mission_id uuid, p_email text, p_access text)
returns void language sql security invoker set search_path = ''
as $$
    select mars_private.share_mission_by_email(p_mission_id, p_email, p_access);
$$;

create or replace function public.mars_claim_email_invitations()
returns integer language sql security invoker set search_path = ''
as $$
    select mars_private.claim_mission_email_invitations();
$$;

create or replace function public.mars_member_directory(p_mission_id uuid)
returns table (user_id uuid, email text, access text)
language sql stable security invoker set search_path = ''
as $$
    select * from mars_private.mission_member_directory(p_mission_id);
$$;

revoke all on function mars_private.share_mission_by_email(uuid,text,text) from public, anon;
revoke all on function mars_private.claim_mission_email_invitations() from public, anon;
revoke all on function mars_private.mission_member_directory(uuid) from public, anon;
grant execute on function mars_private.share_mission_by_email(uuid,text,text) to authenticated;
grant execute on function mars_private.claim_mission_email_invitations() to authenticated;
grant execute on function mars_private.mission_member_directory(uuid) to authenticated;

revoke all on function public.mars_share_by_email(uuid,text,text) from public, anon;
revoke all on function public.mars_claim_email_invitations() from public, anon;
revoke all on function public.mars_member_directory(uuid) from public, anon;
grant execute on function public.mars_share_by_email(uuid,text,text) to authenticated;
grant execute on function public.mars_claim_email_invitations() to authenticated;
grant execute on function public.mars_member_directory(uuid) to authenticated;
