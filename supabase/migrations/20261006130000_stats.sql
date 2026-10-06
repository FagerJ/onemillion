-- ONE MILLION BEERS — counters (C4, D40)
--
-- ⚠ DRAFT, NOT YET APPLIED TO ANY HOSTED PROJECT. Only ever run against throwaway
--   local databases, so editing it in place is still free.
--
-- Two kinds of number:
--
--   * Running totals — global, per party, per profile — are kept by a trigger on
--     `beers`, in the same transaction as the beer. They exclude voided beers, they
--     are what milestones will cross (C12), and recompute_stats() can rebuild every
--     one of them from `beers` at any time.
--
--   * Weekly figures — beers this week, streaks — are computed when someone looks.
--     They're small, and they change when a week ends, not only when a beer lands:
--     a stored streak would need a job to break it at midnight on Sunday.
--
-- A streak week (B1) is a Monday-start week (B5) in which you were at a session
-- holding at least one live beer. The designated driver keeps their streak; an
-- empty session doesn't count.

-- ─────────────────────────────────────────────────────────────
-- Running totals
-- ─────────────────────────────────────────────────────────────
create table global_stats (
  id            int primary key default 1 check (id = 1),
  total_beers   bigint not null default 0 check (total_beers >= 0),
  updated_at    timestamptz not null default now()
);

insert into global_stats default values;

create table party_stats (
  party_id      uuid primary key references parties on delete cascade,
  total_beers   bigint not null default 0 check (total_beers >= 0),
  last_logged_at timestamptz,               -- the latest live beer
  updated_at    timestamptz not null default now()
);

create table profile_stats (
  profile_id    uuid primary key references profiles on delete cascade,
  total_beers   bigint not null default 0 check (total_beers >= 0),
  last_logged_at timestamptz,               -- the latest live beer
  updated_at    timestamptz not null default now()
);

comment on table profile_stats is
  'Across every party the person has drunk in. Party-mates can read it (D40).';

-- +1 when a live beer appears, −1 when one stops being live: a void, an un-void
-- (owner only — clients can't), or a delete (a cascaded session delete, or admin).
-- SECURITY DEFINER because clients may not write these tables themselves.
create or replace function public.count_beer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta int;
  b public.beers;
begin
  if tg_op = 'INSERT' then
    if new.voided_at is not null then return null; end if;
    delta := 1;
    b := new;
  elsif tg_op = 'DELETE' then
    if old.voided_at is not null then return null; end if;
    delta := -1;
    b := old;
  else
    if (old.voided_at is null) = (new.voided_at is null) then return null; end if;
    delta := case when new.voided_at is null then 1 else -1 end;
    b := new;
  end if;

  -- Lock order is always global → party → profile, so two rounds landing at the
  -- same moment queue behind each other instead of deadlocking.
  update public.global_stats
     set total_beers = total_beers + delta,
         updated_at = now()
   where id = 1;

  -- Adding upserts. Taking away is a plain update: the row must already exist, and
  -- an upsert would have its −1 insert row rejected by the check constraint before
  -- Postgres ever looked for the conflict.
  if delta > 0 then
    insert into public.party_stats as ps (party_id, total_beers, last_logged_at)
    values (b.party_id, 1, b.logged_at)
    on conflict (party_id) do update
       set total_beers = ps.total_beers + 1,
           last_logged_at = greatest(ps.last_logged_at, b.logged_at),
           updated_at = now();

    insert into public.profile_stats as ps (profile_id, total_beers, last_logged_at)
    values (b.profile_id, 1, b.logged_at)
    on conflict (profile_id) do update
       set total_beers = ps.total_beers + 1,
           last_logged_at = greatest(ps.last_logged_at, b.logged_at),
           updated_at = now();
  else
    update public.party_stats
       set total_beers = total_beers - 1,
           last_logged_at = (select max(x.logged_at) from public.beers x
                              where x.party_id = b.party_id and x.voided_at is null),
           updated_at = now()
     where party_id = b.party_id;

    update public.profile_stats
       set total_beers = total_beers - 1,
           last_logged_at = (select max(x.logged_at) from public.beers x
                              where x.profile_id = b.profile_id and x.voided_at is null),
           updated_at = now()
     where profile_id = b.profile_id;
  end if;

  return null;
end;
$$;

-- AFTER triggers are numbered like the BEFORE ones: milestone crossing (C12) will
-- read these totals, so it must sort after this one.
create trigger beers_10_count
  after insert or delete or update of voided_at on beers
  for each row execute function public.count_beer();

-- Rebuild every total from `beers`. For repairs, and the proof in stats_test.sql
-- that the trigger and a fresh count agree.
create or replace function public.recompute_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  lock table public.beers in share mode;   -- no beer lands while we count

  update public.global_stats
     set total_beers = (select count(*) from public.beers where voided_at is null),
         updated_at = now()
   where id = 1;

  delete from public.party_stats;
  insert into public.party_stats (party_id, total_beers, last_logged_at)
  select party_id, count(*), max(logged_at)
  from public.beers where voided_at is null
  group by party_id;

  delete from public.profile_stats;
  insert into public.profile_stats (profile_id, total_beers, last_logged_at)
  select profile_id, count(*), max(logged_at)
  from public.beers where voided_at is null
  group by profile_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Weekly figures — computed on read
-- ─────────────────────────────────────────────────────────────
-- Monday of the week `p_at` falls in, on the wall clock of `p_tz`. Postgres's
-- date_trunc('week') is ISO, so weeks start on Monday (B5).
create or replace function public.week_start(p_at timestamptz, p_tz text)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone p_tz)::date;
$$;

-- Gaps and islands: consecutive weeks share the same (week − 7·rank). The current
-- streak is the run that ends this week or last week — a week isn't broken until
-- it's over.
create or replace function public.streak_of(
  p_weeks date[],
  p_this_week date,
  out current_weeks int,
  out best_weeks int
)
language sql
immutable
set search_path = ''
as $$
  with weeks as (
    select distinct unnest(p_weeks) as wk
  ),
  islands as (
    select max(wk) as last_wk, count(*)::int as len
    from (
      select wk, wk - (row_number() over (order by wk))::int * 7 as grp
      from weeks
    ) runs
    group by grp
  )
  select
    coalesce((select len from islands
               where last_wk >= p_this_week - 7
               order by last_wk desc limit 1), 0),
    coalesce((select max(len) from islands), 0);
$$;

-- Everything a profile's dashboard tiles need, in one call. Visible to yourself and
-- your party-mates, like profile_stats. "This week" is the viewer's week; each
-- session counts in the week it started, in its own timezone.
create or replace function public.profile_summary(p_profile uuid)
returns table (
  total_beers bigint,
  beers_this_week bigint,
  current_streak_weeks int,
  best_streak_weeks int,
  last_logged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  this_week date;
begin
  if not (p_profile = auth.uid() or public.shares_party_with(p_profile)) then
    return;
  end if;

  select public.week_start(now(), p.timezone) into this_week
  from public.profiles p where p.id = auth.uid();

  return query
  with attended as (
    select s.id, public.week_start(s.started_at, s.timezone) as wk
    from public.session_attendees a
    join public.sessions s on s.id = a.session_id
    where a.profile_id = p_profile
      and exists (select 1 from public.beers x
                   where x.session_id = s.id and x.voided_at is null)
  )
  select
    coalesce(ps.total_beers, 0),
    (select count(*) from public.beers x
       join attended m on m.id = x.session_id
      where x.profile_id = p_profile and x.voided_at is null and m.wk = this_week),
    st.current_weeks,
    st.best_weeks,
    ps.last_logged_at
  from public.streak_of((select array_agg(wk) from attended), this_week) st
  left join public.profile_stats ps on ps.profile_id = p_profile;
end;
$$;

create or replace function public.party_summary(p_party uuid)
returns table (
  total_beers bigint,
  beers_this_week bigint,
  current_streak_weeks int,
  best_streak_weeks int,
  last_logged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  this_week date;
begin
  if not public.is_party_member(p_party) then
    return;
  end if;

  select public.week_start(now(), p.timezone) into this_week
  from public.profiles p where p.id = auth.uid();

  return query
  with nights as (
    select s.id, public.week_start(s.started_at, s.timezone) as wk
    from public.sessions s
    where s.party_id = p_party
      and exists (select 1 from public.beers x
                   where x.session_id = s.id and x.voided_at is null)
  )
  select
    coalesce(ps.total_beers, 0),
    (select count(*) from public.beers x
       join nights m on m.id = x.session_id
      where x.voided_at is null and m.wk = this_week),
    st.current_weeks,
    st.best_weeks,
    ps.last_logged_at
  from public.streak_of((select array_agg(wk) from nights), this_week) st
  left join public.party_stats ps on ps.party_id = p_party;
end;
$$;

-- profile_summary walks a person's sessions; the attendees primary key leads with
-- session_id, so it can't serve that.
create index session_attendees_profile_idx on session_attendees (profile_id);

-- ─────────────────────────────────────────────────────────────
-- Access (D39 rules: read-only for clients, nothing for anon)
-- ─────────────────────────────────────────────────────────────
alter table global_stats  enable row level security;
alter table party_stats   enable row level security;
alter table profile_stats enable row level security;

revoke all on public.global_stats, public.party_stats, public.profile_stats
  from anon, authenticated;
grant select on public.global_stats, public.party_stats, public.profile_stats
  to authenticated;

-- The million is global (D1): everyone signed in watches the same number.
create policy global_stats_select on public.global_stats
  for select to authenticated
  using (true);

create policy party_stats_select on public.party_stats
  for select to authenticated
  using (public.is_party_member(party_id));

create policy profile_stats_select on public.profile_stats
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.shares_party_with(profile_id));

revoke execute on function
  public.count_beer(), public.recompute_stats()
  from public, anon, authenticated;

revoke execute on function
  public.profile_summary(uuid), public.party_summary(uuid),
  public.week_start(timestamptz, text), public.streak_of(date[], date)
  from public, anon;

grant execute on function
  public.profile_summary(uuid), public.party_summary(uuid),
  public.week_start(timestamptz, text), public.streak_of(date[], date)
  to authenticated;
