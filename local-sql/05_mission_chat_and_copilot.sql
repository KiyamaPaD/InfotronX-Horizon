-- Mars Atlas: private mission chat, moderation reports, and optional AI quota.
-- Apply ONCE after 01_mars_cloud_schema.sql, 03_mission_email_sharing.sql
-- and 04_owner_insert_returning_rls_fix.sql. Existing mars_private permission helpers required.
-- The Edge Function source/deploy is in ../supabase/functions/mars-mission-copilot/index.ts.

create table if not exists public.mars_mission_chat_messages
(
    id uuid primary key default gen_random_uuid(),
    mission_id uuid not null references public.mars_missions(id) on delete cascade,
    sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    body text not null check (char_length(btrim(body)) between 1 and 600),
    created_at timestamptz not null default now()
);
create index if not exists mars_chat_mission_date_idx
    on public.mars_mission_chat_messages(mission_id,created_at desc);
create index if not exists mars_chat_sender_date_idx
    on public.mars_mission_chat_messages(sender_id,created_at desc);
alter table public.mars_mission_chat_messages enable row level security;
grant select,insert,delete on public.mars_mission_chat_messages to authenticated;

create table if not exists public.mars_chat_blocks
(
    blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    blocked_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (blocker_id,blocked_id),
    constraint mars_chat_no_self_block check (blocker_id <> blocked_id)
);
create index if not exists mars_chat_blocks_blocked_lookup
    on public.mars_chat_blocks(blocked_id);
alter table public.mars_chat_blocks enable row level security;
grant select,insert,delete on public.mars_chat_blocks to authenticated;

drop policy if exists "Chat blocker reads own blocks" on public.mars_chat_blocks;
create policy "Chat blocker reads own blocks" on public.mars_chat_blocks
    for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists "Chat blocker creates own blocks" on public.mars_chat_blocks;
create policy "Chat blocker creates own blocks" on public.mars_chat_blocks
    for insert to authenticated with check (blocker_id = (select auth.uid()));
drop policy if exists "Chat blocker removes own blocks" on public.mars_chat_blocks;
create policy "Chat blocker removes own blocks" on public.mars_chat_blocks
    for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists "Members read mission chat excluding blocked authors"
    on public.mars_mission_chat_messages;
create policy "Members read mission chat excluding blocked authors"
on public.mars_mission_chat_messages for select to authenticated
using (
    mars_private.can_read_mission(mission_id)
    and not exists (
        select 1 from public.mars_chat_blocks b
        where b.blocker_id = (select auth.uid()) and b.blocked_id = sender_id
    )
);
drop policy if exists "Members send messages only as themselves"
    on public.mars_mission_chat_messages;
create policy "Members send messages only as themselves"
on public.mars_mission_chat_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and mars_private.can_read_mission(mission_id));
drop policy if exists "Authors delete own mission messages"
    on public.mars_mission_chat_messages;
create policy "Authors delete own mission messages"
on public.mars_mission_chat_messages for delete to authenticated
using (sender_id = (select auth.uid()) and mars_private.can_read_mission(mission_id));

create table if not exists public.mars_chat_reports
(
    id bigint generated always as identity primary key,
    message_id uuid references public.mars_mission_chat_messages(id) on delete set null,
    mission_id uuid not null references public.mars_missions(id) on delete cascade,
    reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    reported_user_id uuid not null references auth.users(id) on delete cascade,
    reason text not null check (reason in ('spam','harassment','inappropriate','other')),
    created_at timestamptz not null default now(),
    status text not null default 'pending' check (status in ('pending','reviewed')),
    unique(message_id,reporter_id)
);
create index if not exists mars_chat_reports_mission_lookup on public.mars_chat_reports(mission_id);
create index if not exists mars_chat_reports_reported_user_lookup on public.mars_chat_reports(reported_user_id);
create index if not exists mars_chat_reports_reporter_lookup on public.mars_chat_reports(reporter_id);
alter table public.mars_chat_reports enable row level security;
grant select on public.mars_chat_reports to authenticated;
revoke insert on public.mars_chat_reports from authenticated;
grant insert (message_id,mission_id,reporter_id,reported_user_id,reason)
    on public.mars_chat_reports to authenticated;

drop policy if exists "Reporters read own reports" on public.mars_chat_reports;
create policy "Reporters read own reports" on public.mars_chat_reports
    for select to authenticated using (reporter_id = (select auth.uid()));
drop policy if exists "Members report visible other member messages" on public.mars_chat_reports;
create policy "Members report visible other member messages" on public.mars_chat_reports
    for insert to authenticated
    with check (
        reporter_id = (select auth.uid()) and reporter_id <> reported_user_id
        and mars_private.can_read_mission(mission_id)
        and exists (
            select 1 from public.mars_mission_chat_messages m
            where m.id = message_id
              and m.mission_id = mars_chat_reports.mission_id
              and m.sender_id = reported_user_id
        )
    );

create or replace function mars_private.enforce_mission_chat_limits()
returns trigger language plpgsql set search_path = ''
as $$
declare
    recent timestamptz;
    minute_count integer;
begin
    if new.sender_id is distinct from (select auth.uid()) then
        raise exception 'You may only send your own messages';
    end if;
    new.created_at := clock_timestamp();
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(new.sender_id::text,923031));
    select max(created_at),count(*) into recent,minute_count
    from public.mars_mission_chat_messages
    where sender_id = new.sender_id and created_at > new.created_at - interval '60 seconds';
    if (recent is not null and recent > new.created_at - interval '3 seconds') or minute_count >= 10 then
        raise exception 'Chat limit reached: wait before posting again';
    end if;
    return new;
end;
$$;
revoke all on function mars_private.enforce_mission_chat_limits() from public;
drop trigger if exists mars_chat_limit_insert on public.mars_mission_chat_messages;
create trigger mars_chat_limit_insert before insert on public.mars_mission_chat_messages
for each row execute function mars_private.enforce_mission_chat_limits();

create table if not exists public.mars_copilot_requests
(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
create index if not exists mars_copilot_user_window_idx
    on public.mars_copilot_requests(user_id,created_at desc);
alter table public.mars_copilot_requests enable row level security;
grant select,insert on public.mars_copilot_requests to authenticated;

drop policy if exists "Users view own AI request accounting" on public.mars_copilot_requests;
create policy "Users view own AI request accounting"
on public.mars_copilot_requests for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists "Users count only their own AI requests" on public.mars_copilot_requests;
create policy "Users count only their own AI requests"
on public.mars_copilot_requests for insert to authenticated
with check (user_id = (select auth.uid()));

create or replace function mars_private.enforce_copilot_limits()
returns trigger language plpgsql set search_path = ''
as $$
declare recent_count integer;
begin
    if new.user_id is distinct from (select auth.uid()) then
        raise exception 'Request identity mismatch';
    end if;
    new.created_at := clock_timestamp();
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(new.user_id::text,915313));
    select count(*) into recent_count from public.mars_copilot_requests r
    where r.user_id = new.user_id
      and r.created_at > new.created_at - interval '10 minutes';
    if recent_count >= 5 then
        raise exception 'AI request limit reached: maximum five per ten minutes';
    end if;
    return new;
end;
$$;
revoke all on function mars_private.enforce_copilot_limits() from public;
drop trigger if exists mars_copilot_limit on public.mars_copilot_requests;
create trigger mars_copilot_limit before insert on public.mars_copilot_requests
for each row execute function mars_private.enforce_copilot_limits();

create index if not exists mars_email_invitations_inviter_lookup
    on public.mars_email_invitations(invited_by);

do $$
begin
    if not exists (select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public'
          and tablename='mars_mission_chat_messages') then
        alter publication supabase_realtime add table public.mars_mission_chat_messages;
    end if;
end;
$$;

-- Security acceptance:
-- SELECT tablename,policyname,cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename LIKE 'mars_%';
-- Use Supabase Security Advisor and separate authenticated viewer/editor accounts.
