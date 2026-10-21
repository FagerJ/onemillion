-- A fingerprint of the schema, section by section (DEPLOY.md § How a change goes live).
-- Run it on the local database and on production after a migration: every line must match.
with
fns as (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k,
         md5(pg_get_functiondef(p.oid)) as v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
),
pols as (
  select tablename || '.' || policyname as k,
         md5(concat_ws('|', cmd, roles::text, qual, with_check, permissive)) as v
  from pg_policies where schemaname = 'public'
),
views as (
  select viewname as k, md5(pg_get_viewdef(('public.' || viewname)::regclass, true)) as v
  from pg_views where schemaname = 'public'
),
trigs as (
  select c.relname || '.' || t.tgname as k, md5(pg_get_triggerdef(t.oid)) as v
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
cons as (
  select c.relname || '.' || con.conname as k, md5(pg_get_constraintdef(con.oid)) as v
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
idx as (
  select indexname as k, md5(indexdef) as v from pg_indexes where schemaname = 'public'
),
cols as (
  select table_name || '.' || column_name as k,
         md5(concat_ws('|', data_type, is_nullable, column_default)) as v
  from information_schema.columns where table_schema = 'public'
),
tgrants as (
  select table_name || '.' || grantee || '.' || privilege_type as k, 'y' as v
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
),
cgrants as (
  select table_name || '.' || column_name || '.' || grantee || '.' || privilege_type as k, 'y' as v
  from information_schema.column_privileges
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
),
fgrants as (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ').' || r.rolname as k,
         has_function_privilege(r.oid, p.oid, 'execute')::text as v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join pg_roles r
  where n.nspname = 'public' and r.rolname in ('anon', 'authenticated')
),
rls as (
  select relname as k, (relrowsecurity::text || relforcerowsecurity::text) as v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
jobs as (
  select jobname as k, md5(schedule || '|' || command) as v from cron.job
),
pub as (
  select schemaname || '.' || tablename as k, 'y' as v
  from pg_publication_tables where pubname = 'supabase_realtime'
),
catalogue as (
  select code as k, md5(row(code, tier, category, title, description, flavor, points, is_secret,
                           art, sort, rule, retired_at)::text) as v
  from public.achievements
),
ladder as (
  select threshold::text as k, md5(row(threshold, kind, scopes, tier)::text) as v from public.milestones
),
sections(name, k, v) as (
  select 'functions', k, v from fns union all
  select 'policies', k, v from pols union all
  select 'views', k, v from views union all
  select 'triggers', k, v from trigs union all
  select 'constraints', k, v from cons union all
  select 'indexes', k, v from idx union all
  select 'columns', k, v from cols union all
  select 'table grants', k, v from tgrants union all
  select 'column grants', k, v from cgrants union all
  select 'function grants', k, v from fgrants union all
  select 'rls', k, v from rls union all
  select 'cron jobs', k, v from jobs union all
  select 'publication', k, v from pub union all
  select 'catalogue', k, v from catalogue union all
  select 'ladder', k, v from ladder
)
select name, count(*) as items, md5(string_agg(k || '=' || v, ',' order by k)) as fingerprint
from sections group by name order by name;
