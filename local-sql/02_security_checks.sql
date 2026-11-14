-- Read-only Mars Atlas RLS inspection. Run after the main schema.
select schemaname, tablename, rowsecurity
from pg_tables where schemaname='public'
and tablename in ('mars_missions','mars_mission_members','mars_mission_versions');
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' and tablename like 'mars_%'
order by tablename, policyname;
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name like 'mars_%'
and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
-- Additionally run Security Advisor and test two distinct authenticated accounts.
