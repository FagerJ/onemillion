-- ONE MILLION BEERS — milestones and the Golden Goal (C9, C12, G5; D28, D54–D61)
--
-- The ladder moves into the database, and every time a live counter lands on a rung the
-- beer that did it is written down: the Golden Goal.
--
--   * `milestones` is the ladder: one row per rung, naming the scopes it applies to. The
--     67 and 69 easter eggs are rows too (kind 'egg'): recorded, never a gauge rung.
--   * `milestone_events` is who crossed what, once per scope, for good. A void that takes
--     a count back under a rung leaves its event alone (D16); landing on it again records
--     nothing.
--   * beers_20_milestones sorts after beers_10_count, so it reads the totals that trigger
--     has just moved for the same row. A round is one INSERT of many rows; Postgres fires
--     both triggers row by row, so the row that made the count hit the number is credited.
--   * Beers logged before this migration are replayed once by backfill_milestones() and
--     flagged `backfilled`: recorded, never celebrated.
--
-- Reads follow the counters (D40): global rungs for everyone signed in, a crew's for its
-- members, a person's for them and their crew-mates. Nobody writes either table.
--
-- Additive only (D50): the app build before this one never reads these tables.

-- ─────────────────────────────────────────────────────────────
-- 1. The ladder (C9)
-- ─────────────────────────────────────────────────────────────
create table milestones (
  threshold  bigint primary key check (threshold > 0),
  kind       text not null default 'rung' check (kind in ('rung', 'egg')),
  scopes     text[] not null check (
               cardinality(scopes) > 0
               and scopes <@ array['global', 'crew', 'profile']::text[]),
  tier       text not null check (tier in ('bronze', 'silver', 'gold', 'legendary'))
);

comment on table milestones is
  'The ladder (ARCHITECTURE §4). A rung drives the gauge of every scope it lists; an egg '
  'is recorded but never drives a gauge. Names live in the app (en.ts), keyed by threshold.';

insert into milestones (threshold, kind, scopes, tier) values
  (     10, 'rung', '{crew}',                'bronze'),
  (     25, 'rung', '{crew}',                'bronze'),
  (     50, 'rung', '{crew,profile}',        'bronze'),
  (     67, 'egg',  '{profile}',             'bronze'),   -- the owner's, A4
  (     69, 'egg',  '{profile}',             'bronze'),   -- the owner's, A4
  (    100, 'rung', '{crew,profile}',        'silver'),
  (    250, 'rung', '{crew,profile}',        'silver'),
  (    500, 'rung', '{crew,profile}',        'silver'),
  (   1000, 'rung', '{global,crew,profile}', 'gold'),
  (   2500, 'rung', '{global,crew}',         'gold'),
  (   5000, 'rung', '{global,crew}',         'gold'),
  (  10000, 'rung', '{global,crew}',         'gold'),
  (  25000, 'rung', '{global,crew}',         'gold'),
  (  50000, 'rung', '{global,crew}',         'gold'),
  ( 100000, 'rung', '{global,crew}',         'gold'),
  ( 250000, 'rung', '{global}',              'gold'),
  ( 500000, 'rung', '{global}',              'gold'),
  (1000000, 'rung', '{global}',              'legendary');

-- ─────────────────────────────────────────────────────────────
-- 2. Crossings (C12, D28)
-- ─────────────────────────────────────────────────────────────
create table milestone_events (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('global', 'crew', 'profile')),
  scope_id    uuid,                                       -- the crew or person; null for global
  threshold   bigint not null references milestones,      -- a rung with events can't be deleted
  beer_id     uuid references beers on delete set null,   -- the Golden Goal
  profile_id  uuid not null references profiles,          -- its drinker: the scorer
  added_by    uuid not null references profiles,          -- who tapped it: the assist
  crew_id     uuid not null,          -- where it was scored; no FK, like beers.crew_id
  session_id  uuid references sessions on delete set null,
  round_id    uuid,
  crossed_at  timestamptz not null default now(),         -- when the count got there
  backfilled  boolean not null default false,             -- replayed history: never celebrated
  constraint milestone_events_scope_id_check check ((scope = 'global') = (scope_id is null))
);

-- Once per scope, for good. An expression rather than NULLS NOT DISTINCT, so the global
-- scope's null scope_id collides with itself.
create unique index milestone_events_once on milestone_events
  (scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), threshold);
create index milestone_events_crew_idx  on milestone_events (crew_id, crossed_at desc);
create index milestone_events_scope_idx on milestone_events (scope, scope_id, crossed_at desc);

comment on table milestone_events is
  'Who crossed what (D28). Written only by beers_20_milestones and backfill_milestones(); '
  'never updated or deleted: voids revoke nothing (D16).';

-- Only a beer becoming live moves a count up: a new one, or an un-void (owner only).
create function public.record_milestones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g bigint;
  c bigint;
  p bigint;
begin
  if tg_op = 'INSERT' then
    if new.voided_at is not null then return null; end if;
  elsif old.voided_at is null or new.voided_at is not null then
    return null;                       -- a void, or an update that leaves it as it was
  end if;

  -- beers_10_count has just counted this very row, and this transaction holds those rows
  -- until it commits: each total is exactly the count this beer made.
  select total_beers into g from public.global_stats  where id = 1;
  select total_beers into c from public.crew_stats    where crew_id = new.crew_id;
  select total_beers into p from public.profile_stats where profile_id = new.profile_id;

  if not exists (select 1 from public.milestones where threshold in (g, c, p)) then
    return null;                       -- nearly every beer stops here
  end if;

  begin
    insert into public.milestone_events
      (scope, scope_id, threshold, beer_id, profile_id, added_by, crew_id, session_id, round_id)
    select x.scope, x.scope_id, m.threshold, new.id, new.profile_id, new.added_by,
           new.crew_id, new.session_id, new.round_id
    from (values ('global',  null::uuid,     g),
                 ('crew',    new.crew_id,    c),
                 ('profile', new.profile_id, p)) as x(scope, scope_id, total)
    join public.milestones m on m.threshold = x.total and x.scope = any (m.scopes)
    on conflict do nothing;            -- crossed before, then voided back under: keep the first
  exception when others then
    -- A milestone must never cost a beer. backfill_milestones() can find this one again.
    raise warning 'Milestone not recorded for beer %: %', new.id, sqlerrm;
  end;

  return null;
end;
$$;

create trigger beers_20_milestones
  after insert or update of voided_at on beers
  for each row execute function public.record_milestones();

-- Replays every change to the counts in the order it happened, and records each first
-- landing on a rung that has no event yet. Never re-attributes an existing one. For this
-- migration, and after recompute_stats() or a ladder change.
create function public.backfill_milestones()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  lock table public.beers in share mode;   -- no beer lands while we replay

  with changes as (
    -- every beer counted from the moment it went in …
    select b.id, b.crew_id, b.profile_id, b.added_by, b.session_id, b.round_id,
           b.created_at as at, 0 as step, b.global_seq as seq, 1 as delta
    from public.beers b
    union all
    -- … and stopped when it was voided. voided_at is the clock of the phone that tapped
    -- "−", so it may never come before the beer itself.
    select b.id, b.crew_id, b.profile_id, b.added_by, b.session_id, b.round_id,
           greatest(b.voided_at, b.created_at), 1, b.global_seq, -1
    from public.beers b
    where b.voided_at is not null
  ),
  running as (
    select ch.*,
           sum(ch.delta) over (order by ch.at, ch.step, ch.seq
                               rows unbounded preceding) as g_total,
           sum(ch.delta) over (partition by ch.crew_id order by ch.at, ch.step, ch.seq
                               rows unbounded preceding) as c_total,
           sum(ch.delta) over (partition by ch.profile_id order by ch.at, ch.step, ch.seq
                               rows unbounded preceding) as p_total
    from changes ch
  ),
  crossings as (
    select distinct on (x.scope, x.scope_id, m.threshold)
           x.scope, x.scope_id, m.threshold,
           r.id as beer_id, r.profile_id, r.added_by, r.crew_id, r.session_id, r.round_id, r.at
    from running r
    cross join lateral (values ('global',  null::uuid,   r.g_total),
                               ('crew',    r.crew_id,    r.c_total),
                               ('profile', r.profile_id, r.p_total)) as x(scope, scope_id, total)
    join public.milestones m on m.threshold = x.total and x.scope = any (m.scopes)
    where r.delta = 1
      -- A count moves by one from zero, so every rung up to today's total really was
      -- landed on. Above it, the replay's order (phone clocks, ties) may have overshot what
      -- the live count reached; those are left for the live trigger to find (D58).
      and m.threshold <= case x.scope
            when 'global' then (select g.total_beers from public.global_stats g where g.id = 1)
            when 'crew'   then coalesce((select c.total_beers from public.crew_stats c
                                          where c.crew_id = x.scope_id), 0)
            else               coalesce((select p.total_beers from public.profile_stats p
                                          where p.profile_id = x.scope_id), 0)
          end
    order by x.scope, x.scope_id, m.threshold, r.at, r.step, r.seq
  )
  insert into public.milestone_events
    (scope, scope_id, threshold, beer_id, profile_id, added_by, crew_id, session_id,
     round_id, crossed_at, backfilled)
  select scope, scope_id, threshold, beer_id, profile_id, added_by, crew_id, session_id,
         round_id, at, true
  from crossings
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- The trigger exists and this transaction holds beers, so nothing can slip between the
-- replay and the live trigger.
select public.backfill_milestones();

-- ─────────────────────────────────────────────────────────────
-- 3. Access (D39: read-only for clients, nothing for anon)
-- ─────────────────────────────────────────────────────────────
alter table milestones       enable row level security;
alter table milestone_events enable row level security;

revoke all on public.milestones, public.milestone_events from anon, authenticated;
grant select on public.milestones, public.milestone_events to authenticated;

create policy milestones_select on public.milestones
  for select to authenticated
  using (true);

create policy milestone_events_select on public.milestone_events
  for select to authenticated
  using (
    scope = 'global'
    or (scope = 'crew' and public.is_crew_member(scope_id))
    or (scope = 'profile'
        and (scope_id = (select auth.uid()) or public.shares_crew_with(scope_id)))
  );

revoke execute on function public.record_milestones(), public.backfill_milestones()
  from public, anon, authenticated;

-- G5: the takeover lands on every phone at the table, and the global rungs on everyone's.
-- After the backfill, so replayed rows are never broadcast.
alter publication supabase_realtime add table public.milestone_events;
