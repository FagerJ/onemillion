-- ONE MILLION BEERS — combos and achievements (G1–G4, D62–D69)
--
-- Achievements are data (D7): a catalogue row each, with a rule from a small closed
-- vocabulary that a CHECK enforces. An unlock is once per holder — a person or a crew,
-- a guild later — and nothing ever deletes one: a void doesn't revoke (D16, D28).
--
-- Unlocks are written two ways, by the same SQL:
--   * live  — AFTER triggers on beers, session_attendees, sessions and crew_members call
--             the evaluators that event can move, scoped to the people, crews and nights
--             involved. A round is one statement, so it is evaluated once.
--   * sweep — sweep_achievements() runs every evaluator over all history. pg_cron runs
--             it nightly (that's how a week off is noticed, and how a retuned threshold
--             reaches old nights); this migration runs it once as the backfill.
--
-- Combos (D20) are a record of the night first: session_combos holds one row per night
-- per rung — what the live banner listens to, every night. Each attendee, late arrivals
-- included while the night is open, then holds that rung's badge once.

-- ─────────────────────────────────────────────────────────────
-- 1. The catalogue
-- ─────────────────────────────────────────────────────────────
-- The closed vocabulary (D62). A rule type is a branch here and an evaluator below.
create function public.achievement_rule_ok(p_tier text, p_rule jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case p_rule->>'type'
      when 'session_total'      then p_tier = 'person'
      when 'lifetime_beers'     then p_tier in ('person', 'crew')
      when 'alcohol_free_beers' then p_tier = 'person'
      when 'nights'             then p_tier = 'person'
      when 'streak_weeks'       then p_tier in ('person', 'crew')
      when 'rounds_poured'      then p_tier = 'person'
      when 'nights_driving'     then p_tier = 'person'
      when 'week_off'           then p_tier = 'person'
      when 'members'            then p_tier = 'crew'
      when 'session_size'       then p_tier = 'crew'
      when 'full_crew'          then p_tier = 'crew'
      when 'combo_rungs'        then p_tier = 'crew'
      else false
    end
    and case p_rule->>'type'
      when 'week_off'    then true
      when 'combo_rungs' then true
      when 'full_crew'   then jsonb_typeof(p_rule->'min_members') = 'number'
                              and (p_rule->>'min_members')::numeric >= 2
                              and (p_rule->>'min_members')::numeric % 1 = 0
      else jsonb_typeof(p_rule->'min') = 'number'
           and (p_rule->>'min')::numeric >= 1
           and (p_rule->>'min')::numeric % 1 = 0
    end,
    false);
$$;

create table achievements (
  code         text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  tier         text not null check (tier in ('person', 'crew', 'guild')),
  category     text not null check (category in
                 ('combo', 'firsts', 'showing_up', 'streak', 'care', 'giving', 'numbers', 'squad')),
  title        text not null check (length(title) between 1 and 40),
  description  text not null check (length(description) between 1 and 200),
  flavor       text check (flavor is null or length(flavor) <= 120),
  points       int  not null check (points between 0 and 1000),
  is_secret    boolean not null default false,
  -- how the client draws it: {glyph|text, metal (person) | finish (crew), accent}
  art          jsonb not null default '{}' check (jsonb_typeof(art) = 'object'),
  sort         int  not null,
  rule         jsonb not null,
  retired_at   timestamptz,             -- no new unlocks; holders keep theirs
  created_at   timestamptz not null default now(),
  unique (code, tier),
  constraint achievements_rule_is_known check (public.achievement_rule_ok(tier, rule))
);

comment on table achievements is
  'D7/D62 — the catalogue. A new achievement of a known rule type is an insert, in a '
  'migration; a new rule type is a new evaluator. Text is English, rendered as data (D67).';

-- One row per night per rung (D64). The banner fires on this, every night.
create table session_combos (
  session_id       uuid not null references sessions on delete cascade,
  achievement_code text not null references achievements,
  crew_id          uuid not null references crews,
  beer_id          uuid references beers on delete set null,  -- the beer that took the tally there
  reached_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  primary key (session_id, achievement_code)
);

create index session_combos_crew_idx on session_combos (crew_id, reached_at);

create table achievement_unlocks (
  id               uuid primary key default gen_random_uuid(),
  achievement_code text not null,
  tier             text not null,
  profile_id       uuid references profiles on delete cascade,  -- the holder, for a person
  crew_id          uuid references crews on delete cascade,     -- the holder for a crew; where it happened for a person
  guild_id         uuid,             -- snapshot from the beer or night (D6); FK with the guilds table
  session_id       uuid references sessions on delete set null,
  beer_id          uuid references beers on delete set null,
  unlocked_at      timestamptz not null,   -- when it happened (D65)
  source           text not null default 'live' check (source in ('live', 'sweep', 'backfill')),
  created_at       timestamptz not null default now(),   -- when it was written
  foreign key (achievement_code, tier) references achievements (code, tier),
  constraint achievement_unlocks_holder check (
    case tier
      when 'person' then profile_id is not null
      when 'crew'   then crew_id is not null and profile_id is null
      when 'guild'  then guild_id is not null and profile_id is null
      else false
    end)
);

-- Once per holder, forever (D62). Nothing updates or deletes a row.
create unique index achievement_unlocks_once_person
  on achievement_unlocks (achievement_code, profile_id) where tier = 'person';
create unique index achievement_unlocks_once_crew
  on achievement_unlocks (achievement_code, crew_id) where tier = 'crew';
create unique index achievement_unlocks_once_guild
  on achievement_unlocks (achievement_code, guild_id) where tier = 'guild';
create index achievement_unlocks_profile_idx on achievement_unlocks (profile_id, unlocked_at desc);
create index achievement_unlocks_crew_idx    on achievement_unlocks (crew_id, unlocked_at desc);
create index achievement_unlocks_code_idx    on achievement_unlocks (achievement_code);

comment on column achievement_unlocks.source is
  'live = a trigger wrote it as it happened (the app toasts these); sweep/backfill = '
  'found later by sweep_achievements() (never toasted).';

-- ─────────────────────────────────────────────────────────────
-- 2. What counts — shared by the evaluators and the progress reads
-- ─────────────────────────────────────────────────────────────
-- A night counts once it holds a live beer: D40's streak rule. The driver's night
-- counts; a night whose every beer was voided doesn't.
create view public.counted_nights
with (security_invoker = true) as
select s.id as session_id, s.crew_id, s.guild_id, s.started_at, s.closed_at,
       public.week_start(s.started_at, s.timezone) as week,
       fb.id as first_beer_id, fb.logged_at as first_beer_at, fb.global_seq as first_beer_seq
from public.sessions s
cross join lateral (
  select b.id, b.logged_at, b.global_seq
  from public.beers b
  where b.session_id = s.id and b.voided_at is null
  order by b.global_seq
  limit 1
) fb;

-- D68: drove the night — out of the rounds, nothing alcoholic of their own, and
-- somebody else had a beer. Decided at full time (only closed nights; D69 freezes it).
create view public.driven_nights
with (security_invoker = true) as
select sa.profile_id, s.id as session_id, s.crew_id, s.guild_id, s.closed_at
from public.session_attendees sa
join public.sessions s on s.id = sa.session_id
where s.status = 'closed'
  and not sa.in_rounds
  and not exists (select 1 from public.beers b
                   where b.session_id = s.id and b.profile_id = sa.profile_id
                     and b.voided_at is null and not b.is_alcohol_free)
  and exists (select 1 from public.beers b
               where b.session_id = s.id and b.profile_id <> sa.profile_id
                 and b.voided_at is null);

-- A round is for the table: one tap, two or more live beers. A round of one is a +.
create view public.poured_rounds
with (security_invoker = true) as
select b.added_by as profile_id, b.round_id,
       min(b.global_seq) as first_seq,
       (array_agg(b.id order by b.global_seq))[1]         as beer_id,
       (array_agg(b.session_id order by b.global_seq))[1] as session_id,
       (array_agg(b.crew_id order by b.global_seq))[1]    as crew_id,
       (array_agg(b.guild_id order by b.global_seq))[1]   as guild_id,
       min(b.logged_at) as poured_at
from public.beers b
where b.round_id is not null and b.voided_at is null
group by b.added_by, b.round_id
having count(*) >= 2;

create index beers_rounds_by_pourer_idx on beers (added_by)
  where round_id is not null and voided_at is null;
create index beers_alcohol_free_idx on beers (profile_id)
  where is_alcohol_free and voided_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. The evaluators — one per rule type, set-based, idempotent
-- ─────────────────────────────────────────────────────────────
-- Scope arrays: null means everyone (only sweep_achievements() passes it), '{}' means
-- nobody. Each one skips what's held (not exists) and survives a race (on conflict).

create function public.award_combo_rungs(p_crews uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  with ladder as (
    select code from public.achievements
    where rule->>'type' = 'session_total' and retired_at is null
  ),
  firsts as (                 -- each crew's first night at each rung
    select distinct on (c.crew_id, c.achievement_code)
           c.crew_id, c.achievement_code, c.session_id, c.beer_id, c.reached_at, b.global_seq as seq
    from public.session_combos c
    join ladder l on l.code = c.achievement_code
    left join public.beers b on b.id = c.beer_id
    where p_crews is null or c.crew_id = any (p_crews)
    -- ties (one moment, several nights) go to the beer that went in first, as live
    order by c.crew_id, c.achievement_code, c.reached_at, b.global_seq
  ),
  complete as (               -- crews holding the whole ladder, and the night that finished it
    select distinct on (f.crew_id) f.crew_id, f.session_id, f.beer_id, f.reached_at
    from firsts f
    where (select count(*) from firsts g where g.crew_id = f.crew_id) = (select count(*) from ladder)
    order by f.crew_id, f.reached_at desc, f.seq desc
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'crew', null, k.crew_id, s.guild_id, k.session_id, k.beer_id, k.reached_at, p_source
  from complete k
  join public.sessions s on s.id = k.session_id
  cross join public.achievements a
  where a.rule->>'type' = 'combo_rungs' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'crew' and u.achievement_code = a.code and u.crew_id = k.crew_id)
  on conflict do nothing;
$$;

create function public.award_lifetime_beers(p_profiles uuid[], p_crews uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  -- A person's counter passing the rung (D28), credited to the beer that took it there:
  -- the min-th live beer in arrival order. The stats row is the cheap gate, so the
  -- ranking only runs at the crossing.
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'person', ps.profile_id, k.crew_id, k.guild_id, k.session_id, k.id, k.logged_at, p_source
  from public.achievements a
  join public.profile_stats ps on ps.total_beers >= (a.rule->>'min')::bigint
  cross join lateral (
    select x.id, x.crew_id, x.guild_id, x.session_id, x.logged_at
    from (select b.id, b.crew_id, b.guild_id, b.session_id, b.logged_at,
                 row_number() over (order by b.global_seq) as n
          from public.beers b
          where b.profile_id = ps.profile_id and b.voided_at is null) x
    where x.n = (a.rule->>'min')::int
  ) k
  where a.tier = 'person' and a.rule->>'type' = 'lifetime_beers' and a.retired_at is null
    and (p_profiles is null or ps.profile_id = any (p_profiles))
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = ps.profile_id)
  on conflict do nothing;

  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'crew', null, cs.crew_id, k.guild_id, k.session_id, k.id, k.logged_at, p_source
  from public.achievements a
  join public.crew_stats cs on cs.total_beers >= (a.rule->>'min')::bigint
  cross join lateral (
    select x.id, x.guild_id, x.session_id, x.logged_at
    from (select b.id, b.guild_id, b.session_id, b.logged_at,
                 row_number() over (order by b.global_seq) as n
          from public.beers b
          where b.crew_id = cs.crew_id and b.voided_at is null) x
    where x.n = (a.rule->>'min')::int
  ) k
  where a.tier = 'crew' and a.rule->>'type' = 'lifetime_beers' and a.retired_at is null
    and (p_crews is null or cs.crew_id = any (p_crews))
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'crew' and u.achievement_code = a.code
                       and u.crew_id = cs.crew_id)
  on conflict do nothing;
$$;

create function public.award_alcohol_free_beers(p_profiles uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  with ranked as (
    select b.id, b.profile_id, b.crew_id, b.guild_id, b.session_id, b.logged_at,
           row_number() over (partition by b.profile_id order by b.global_seq) as k
    from public.beers b
    where b.is_alcohol_free and b.voided_at is null
      and (p_profiles is null or b.profile_id = any (p_profiles))
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'person', r.profile_id, r.crew_id, r.guild_id, r.session_id, r.id, r.logged_at, p_source
  from public.achievements a
  join ranked r on r.k = (a.rule->>'min')::int
  where a.rule->>'type' = 'alcohol_free_beers' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = r.profile_id)
  on conflict do nothing;
$$;

create function public.award_nights(p_profiles uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  -- A night counts for you from the later of its first live beer and you sitting down.
  with nights as (
    select sa.profile_id, n.session_id, n.crew_id, n.guild_id,
           greatest(sa.joined_at, n.first_beer_at) as counted_at,
           row_number() over (partition by sa.profile_id
                              order by greatest(sa.joined_at, n.first_beer_at), n.first_beer_seq) as k
    from public.session_attendees sa
    join public.counted_nights n on n.session_id = sa.session_id
    where p_profiles is null or sa.profile_id = any (p_profiles)
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'person', x.profile_id, x.crew_id, x.guild_id, x.session_id, null, x.counted_at, p_source
  from public.achievements a
  join nights x on x.k = (a.rule->>'min')::int
  where a.rule->>'type' = 'nights' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = x.profile_id)
  on conflict do nothing;
$$;

create function public.award_streak_weeks(p_profiles uuid[], p_crews uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  -- A person: the weeks they were at a counted night, as profile_summary() counts them.
  with weeks as (
    select distinct on (sa.profile_id, n.week)
           sa.profile_id, n.week, n.session_id, n.crew_id, n.guild_id,
           greatest(sa.joined_at, n.first_beer_at) as counted_at
    from public.session_attendees sa
    join public.counted_nights n on n.session_id = sa.session_id
    where p_profiles is null or sa.profile_id = any (p_profiles)
    order by sa.profile_id, n.week, greatest(sa.joined_at, n.first_beer_at), n.first_beer_seq
  ),
  runs as (   -- gaps and islands, as in streak_of(): one run shares (week − 7·rank)
    select w.*, w.week - (row_number() over (partition by w.profile_id order by w.week))::int * 7 as grp
    from weeks w
  ),
  pos as (
    select r.*, row_number() over (partition by r.profile_id, r.grp order by r.week) as k
    from runs r
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select distinct on (a.code, p.profile_id)
         a.code, 'person', p.profile_id, p.crew_id, p.guild_id, p.session_id, null, p.counted_at, p_source
  from public.achievements a
  join pos p on p.k = (a.rule->>'min')::int
  where a.tier = 'person' and a.rule->>'type' = 'streak_weeks' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = p.profile_id)
  order by a.code, p.profile_id, p.week
  on conflict do nothing;

  -- A crew: the weeks it had a counted night, as crew_summary() counts them.
  with weeks as (
    select distinct on (n.crew_id, n.week)
           n.crew_id, n.week, n.session_id, n.guild_id, n.first_beer_id, n.first_beer_at
    from public.counted_nights n
    where p_crews is null or n.crew_id = any (p_crews)
    order by n.crew_id, n.week, n.first_beer_at, n.first_beer_seq
  ),
  runs as (
    select w.*, w.week - (row_number() over (partition by w.crew_id order by w.week))::int * 7 as grp
    from weeks w
  ),
  pos as (
    select r.*, row_number() over (partition by r.crew_id, r.grp order by r.week) as k
    from runs r
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select distinct on (a.code, p.crew_id)
         a.code, 'crew', null, p.crew_id, p.guild_id, p.session_id, p.first_beer_id, p.first_beer_at, p_source
  from public.achievements a
  join pos p on p.k = (a.rule->>'min')::int
  where a.tier = 'crew' and a.rule->>'type' = 'streak_weeks' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'crew' and u.achievement_code = a.code and u.crew_id = p.crew_id)
  order by a.code, p.crew_id, p.week
  on conflict do nothing;
$$;

create function public.award_rounds_poured(p_profiles uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  with ranked as (
    select r.*, row_number() over (partition by r.profile_id order by r.first_seq) as k
    from public.poured_rounds r
    where p_profiles is null or r.profile_id = any (p_profiles)
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'person', r.profile_id, r.crew_id, r.guild_id, r.session_id, r.beer_id, r.poured_at, p_source
  from public.achievements a
  join ranked r on r.k = (a.rule->>'min')::int
  where a.rule->>'type' = 'rounds_poured' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = r.profile_id)
  on conflict do nothing;
$$;

create function public.award_nights_driving(p_profiles uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  with ranked as (
    select d.*, row_number() over (partition by d.profile_id order by d.closed_at, d.session_id) as k
    from public.driven_nights d
    where p_profiles is null or d.profile_id = any (p_profiles)
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'person', r.profile_id, r.crew_id, r.guild_id, r.session_id, null, r.closed_at, p_source
  from public.achievements a
  join ranked r on r.k = (a.rule->>'min')::int
  where a.rule->>'type' = 'nights_driving' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = r.profile_id)
  on conflict do nothing;
$$;

create function public.award_week_off(p_profiles uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Rest counts (ARCHITECTURE §9): a week out, then a whole week without a night that
  -- is already over in your own timezone. Nothing happens in an empty week, so only
  -- the sweep can notice it. Credited at the Monday the empty week ended.
  with weeks as (
    select distinct sa.profile_id, n.week
    from public.session_attendees sa
    join public.counted_nights n on n.session_id = sa.session_id
    where p_profiles is null or sa.profile_id = any (p_profiles)
  ),
  rests as (
    select w.profile_id, w.week, p.timezone
    from weeks w
    join public.profiles p on p.id = w.profile_id
    where w.week + 14 <= public.week_start(now(), p.timezone)
      and not exists (select 1 from weeks x
                       where x.profile_id = w.profile_id and x.week = w.week + 7)
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select distinct on (a.code, r.profile_id)
         a.code, 'person', r.profile_id, last.crew_id, last.guild_id, last.session_id, null,
         (r.week + 14)::timestamp at time zone r.timezone, p_source
  from public.achievements a
  join rests r on true
  cross join lateral (       -- the night before the rest
    select n.session_id, n.crew_id, n.guild_id
    from public.session_attendees sa
    join public.counted_nights n on n.session_id = sa.session_id
    where sa.profile_id = r.profile_id and n.week = r.week
    order by n.first_beer_at desc
    limit 1
  ) last
  where a.rule->>'type' = 'week_off' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = a.code
                       and u.profile_id = r.profile_id)
  order by a.code, r.profile_id, r.week
  on conflict do nothing;
$$;

create function public.award_members(p_crews uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  with seated as (
    select cm.crew_id, cm.joined_at,
           row_number() over (partition by cm.crew_id order by cm.joined_at, cm.profile_id) as k
    from public.crew_members cm
    where cm.left_at is null and (p_crews is null or cm.crew_id = any (p_crews))
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select a.code, 'crew', null, m.crew_id, c.guild_id, null, null, m.joined_at, p_source
  from public.achievements a
  join seated m on m.k = (a.rule->>'min')::int
  join public.crews c on c.id = m.crew_id
  where a.rule->>'type' = 'members' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'crew' and u.achievement_code = a.code and u.crew_id = m.crew_id)
  on conflict do nothing;
$$;

create function public.award_session_size(p_crews uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  with seats as (
    select n.crew_id, n.session_id, n.guild_id, n.first_beer_at, n.first_beer_seq, sa.joined_at,
           row_number() over (partition by sa.session_id order by sa.joined_at, sa.profile_id) as k
    from public.counted_nights n
    join public.session_attendees sa on sa.session_id = n.session_id
    where p_crews is null or n.crew_id = any (p_crews)
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select distinct on (a.code, s.crew_id)
         a.code, 'crew', null, s.crew_id, s.guild_id, s.session_id, null,
         greatest(s.first_beer_at, s.joined_at), p_source
  from public.achievements a
  join seats s on s.k = (a.rule->>'min')::int
  where a.rule->>'type' = 'session_size' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'crew' and u.achievement_code = a.code and u.crew_id = s.crew_id)
  order by a.code, s.crew_id, greatest(s.first_beer_at, s.joined_at), s.first_beer_seq
  on conflict do nothing;
$$;

create function public.award_full_crew(p_crews uuid[], p_source text)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Everyone who was in the crew during the night was at it. Someone who joins the crew
  -- mid-night counts; someone who left before it started doesn't.
  with nights as (
    select n.crew_id, n.session_id, n.guild_id, n.first_beer_at, n.first_beer_seq,
           (select count(*) from public.crew_members cm
             where cm.crew_id = n.crew_id
               and cm.joined_at <= coalesce(n.closed_at, now())
               and (cm.left_at is null or cm.left_at > n.started_at)) as squad,
           (select count(*) from public.session_attendees sa
             where sa.session_id = n.session_id) as present,
           (select max(sa.joined_at) from public.session_attendees sa
             where sa.session_id = n.session_id) as last_in
    from public.counted_nights n
    where p_crews is null or n.crew_id = any (p_crews)
  )
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select distinct on (a.code, x.crew_id)
         a.code, 'crew', null, x.crew_id, x.guild_id, x.session_id, null,
         greatest(x.first_beer_at, x.last_in), p_source
  from public.achievements a
  join nights x on x.present >= x.squad and x.squad >= (a.rule->>'min_members')::int
  where a.rule->>'type' = 'full_crew' and a.retired_at is null
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'crew' and u.achievement_code = a.code and u.crew_id = x.crew_id)
  order by a.code, x.crew_id, greatest(x.first_beer_at, x.last_in), x.first_beer_seq
  on conflict do nothing;
$$;

create function public.award_session_total(p_sessions uuid[], p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched uuid[];
begin
  -- The night reaches a rung: once per night, credited to the beer that took the live
  -- count there — the min-th live beer in arrival order (D28). Voids never remove it.
  with reached as (
    insert into public.session_combos (session_id, achievement_code, crew_id, beer_id, reached_at)
    select s.id, a.code, s.crew_id, k.id, k.logged_at
    from public.sessions s
    cross join public.achievements a
    cross join lateral (
      select x.id, x.logged_at
      from (select b.id, b.logged_at, row_number() over (order by b.global_seq) as n
            from public.beers b
            where b.session_id = s.id and b.voided_at is null) x
      where x.n = (a.rule->>'min')::int
    ) k
    where a.rule->>'type' = 'session_total' and a.retired_at is null
      and (p_sessions is null or s.id = any (p_sessions))
      and not exists (select 1 from public.session_combos c
                       where c.session_id = s.id and c.achievement_code = a.code)
    on conflict do nothing
    returning crew_id
  )
  select array_agg(distinct crew_id) into touched from reached;

  -- Everyone at the table holds every rung the night reached — late arrivals too, while
  -- it's open (D20, D64). A closed night takes no new attendees (the schema's trigger).
  insert into public.achievement_unlocks
    (achievement_code, tier, profile_id, crew_id, guild_id, session_id, beer_id, unlocked_at, source)
  select distinct on (c.achievement_code, a.profile_id)
         c.achievement_code, 'person', a.profile_id, c.crew_id, s.guild_id, c.session_id, c.beer_id,
         greatest(c.reached_at, a.joined_at), p_source
  from public.session_combos c
  join public.sessions s on s.id = c.session_id
  join public.session_attendees a on a.session_id = c.session_id
  left join public.beers b on b.id = c.beer_id
  where (p_sessions is null or c.session_id = any (p_sessions))
    and not exists (select 1 from public.achievement_unlocks u
                     where u.tier = 'person' and u.achievement_code = c.achievement_code
                       and u.profile_id = a.profile_id)
  -- the earliest night it counted for them; ties go to the beer that went in first, as live
  order by c.achievement_code, a.profile_id, greatest(c.reached_at, a.joined_at), b.global_seq
  on conflict do nothing;

  if touched is not null then
    perform public.award_combo_rungs(touched, p_source);
  end if;
end;
$$;

-- Everything one night can unlock.
create function public.award_session(p_session uuid, p_night_level boolean, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew uuid;
  people uuid[];
begin
  -- One evaluation per night at a time. A beer and a late arrival landing together
  -- would otherwise each miss the other: the rung crossed without them, or them sitting
  -- down without the rung. (Beers already queue on global_stats; arrivals don't.)
  select s.crew_id into v_crew from public.sessions s where s.id = p_session for no key update;

  perform public.award_session_total(array[p_session], p_source);

  -- What being at a counted night can unlock. Only worth asking when the night has
  -- just become one (its first live beer) or someone has just sat down.
  if p_night_level then
    select coalesce(array_agg(a.profile_id), '{}') into people
    from public.session_attendees a where a.session_id = p_session;

    perform public.award_nights(people, p_source);
    perform public.award_streak_weeks(people, array[v_crew], p_source);
    perform public.award_session_size(array[v_crew], p_source);
    perform public.award_full_crew(array[v_crew], p_source);
  end if;
end;
$$;

-- The whole engine over all history: the backfill, the nightly job, and the repair
-- after an un-void, a retune or a fixed bug. Live and sweep share every evaluator.
create function public.sweep_achievements(p_source text default 'sweep')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_before bigint;
begin
  -- Live inserts wait the few milliseconds this takes, rather than deadlocking with it
  -- over the same unlock.
  lock table public.session_combos, public.achievement_unlocks in share row exclusive mode;
  select count(*) into n_before from public.achievement_unlocks;

  perform public.award_session_total(null, p_source);   -- before combo_rungs, which reads it
  perform public.award_combo_rungs(null, p_source);
  perform public.award_lifetime_beers(null, null, p_source);
  perform public.award_alcohol_free_beers(null, p_source);
  perform public.award_nights(null, p_source);
  perform public.award_streak_weeks(null, null, p_source);
  perform public.award_rounds_poured(null, p_source);
  perform public.award_nights_driving(null, p_source);
  perform public.award_week_off(null, p_source);
  perform public.award_members(null, p_source);
  perform public.award_session_size(null, p_source);
  perform public.award_full_crew(null, p_source);

  return (select count(*) from public.achievement_unlocks) - n_before;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. When the live path runs
-- ─────────────────────────────────────────────────────────────
-- Statement-level AFTER triggers fire after every row-level AFTER trigger of the same
-- statement, so beers_10_count has already moved profile_stats/crew_stats and
-- beers_20_milestones has recorded any crossing. A badge must never cost a beer: any
-- error here is logged, and tonight's sweep catches up once it's fixed.

create function public.achievements_after_beers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
begin
  begin
    -- A round is one statement: one evaluation, not one per glass. Beers born voided
    -- never count (D40), so they're left out throughout.
    for n in
      select x.session_id,
             not exists (select 1 from public.beers b
                          where b.session_id = x.session_id and b.voided_at is null
                            and not exists (select 1 from new_beers y where y.id = b.id)) as first_beers
      from (select distinct session_id from new_beers where voided_at is null) x
    loop
      perform public.award_session(n.session_id, n.first_beers, 'live');
    end loop;

    -- Never null here: null means "everyone", which only the sweep asks for.
    perform public.award_lifetime_beers(
      coalesce((select array_agg(distinct profile_id) from new_beers where voided_at is null), '{}'),
      coalesce((select array_agg(distinct crew_id) from new_beers where voided_at is null), '{}'),
      'live');
    perform public.award_rounds_poured(
      coalesce((select array_agg(distinct added_by) from new_beers
                 where round_id is not null and voided_at is null), '{}'),
      'live');
    perform public.award_alcohol_free_beers(
      coalesce((select array_agg(distinct profile_id) from new_beers
                 where is_alcohol_free and voided_at is null), '{}'),
      'live');
  exception when others then
    raise warning 'achievements skipped for these beers: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create trigger beers_30_achievements
  after insert on public.beers
  referencing new table as new_beers
  for each statement execute function public.achievements_after_beers();

create function public.achievements_after_attendees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s uuid;
begin
  begin
    for s in select distinct session_id from new_attendees loop
      perform public.award_session(s, true, 'live');   -- late arrivals get the night's rungs
    end loop;
  exception when others then
    raise warning 'achievements skipped for these arrivals: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create trigger session_attendees_30_achievements
  after insert on public.session_attendees
  referencing new table as new_attendees
  for each statement execute function public.achievements_after_attendees();

-- Full time decides the driver (D68): the whistle, or the 09:00 job.
create function public.achievements_after_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.award_nights_driving(
      coalesce((select array_agg(a.profile_id) from public.session_attendees a
                 where a.session_id = new.id), '{}'),
      'live');
  exception when others then
    raise warning 'achievements skipped for night %: % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create trigger sessions_30_achievements
  after update of status on public.sessions
  for each row
  when (old.status = 'open' and new.status = 'closed')
  execute function public.achievements_after_close();

create function public.achievements_after_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.award_members(array[new.crew_id], 'live');
  exception when others then
    raise warning 'achievements skipped for crew %: % (%)', new.crew_id, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create trigger crew_members_30_achievements
  after insert or update of left_at on public.crew_members
  for each row execute function public.achievements_after_members();

-- ─────────────────────────────────────────────────────────────
-- 5. Reads for the app
-- ─────────────────────────────────────────────────────────────
-- D66: a person's unlocks to them and their crew-mates (like profile_stats, D40), a
-- crew's to its members. Guild tier: Phase 3.
create function public.can_see_unlock(p_tier text, p_profile uuid, p_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tier
    when 'person' then p_profile = (select auth.uid()) or public.shares_crew_with(p_profile)
    when 'crew'   then public.is_crew_member(p_crew)
    else false
  end;
$$;

-- The catalogue, with a secret's words and art blank until you can see someone's
-- unlock of it. Retired ones still show to whoever can see one held.
create function public.achievement_catalogue()
returns table (
  code text, tier text, category text,
  title text, description text, flavor text,
  points int, target int, is_secret boolean, is_retired boolean, art jsonb, sort int
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.code, a.tier, a.category,
         case when v.shown then a.title end,
         case when v.shown then a.description end,
         case when v.shown then a.flavor end,
         a.points,
         case when v.shown then (a.rule->>'min')::int end,
         a.is_secret,
         a.retired_at is not null,
         case when v.shown then a.art else '{}'::jsonb end,
         a.sort
  from public.achievements a
  cross join lateral (
    select exists (select 1 from public.achievement_unlocks u
                    where u.achievement_code = a.code
                      and public.can_see_unlock(u.tier, u.profile_id, u.crew_id)) as seen
  ) h
  cross join lateral (select not a.is_secret or h.seen as shown) v
  where a.tier in ('person', 'crew')
    and (a.retired_at is null or h.seen)
  order by a.sort;
$$;

-- Progress for showing up, giving, driving, streaks and the squad only — never toward
-- a beer count or a night's total (D68: no nudges to drink more).
create function public.profile_achievement_progress(p_profile uuid)
returns table (code text, progress bigint, target int)
language sql
stable
security definer
set search_path = ''
as $$
  with figures (kind, value) as (
    select 'nights', (select count(*) from public.session_attendees sa
                        join public.counted_nights n on n.session_id = sa.session_id
                       where sa.profile_id = p_profile)
    union all
    select 'rounds_poured', (select count(*) from public.poured_rounds r where r.profile_id = p_profile)
    union all
    select 'nights_driving', (select count(*) from public.driven_nights d where d.profile_id = p_profile)
    union all
    select 'streak_weeks', (select st.best_weeks::bigint from public.streak_of(
             (select array_agg(distinct n.week) from public.session_attendees sa
                join public.counted_nights n on n.session_id = sa.session_id
               where sa.profile_id = p_profile), current_date) st)
  )
  select a.code, least(f.value, (a.rule->>'min')::bigint), (a.rule->>'min')::int
  from public.achievements a
  join figures f on f.kind = a.rule->>'type'
  where a.tier = 'person' and a.retired_at is null and not a.is_secret
    and (p_profile = (select auth.uid()) or public.shares_crew_with(p_profile));
$$;

create function public.crew_achievement_progress(p_crew uuid)
returns table (code text, progress bigint, target int)
language sql
stable
security definer
set search_path = ''
as $$
  with figures (kind, value) as (
    select 'members', (select count(*) from public.crew_members cm
                         where cm.crew_id = p_crew and cm.left_at is null)
    union all
    select 'session_size', (select coalesce(max(z.people), 0) from (
             select count(*) as people
             from public.counted_nights n
             join public.session_attendees sa on sa.session_id = n.session_id
             where n.crew_id = p_crew
             group by n.session_id) z)
    union all
    select 'streak_weeks', (select st.best_weeks::bigint from public.streak_of(
             (select array_agg(distinct n.week) from public.counted_nights n
               where n.crew_id = p_crew), current_date) st)
  )
  select a.code, least(f.value, (a.rule->>'min')::bigint), (a.rule->>'min')::int
  from public.achievements a
  join figures f on f.kind = a.rule->>'type'
  where a.tier = 'crew' and a.retired_at is null and not a.is_secret
    and public.is_crew_member(p_crew);
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Access (D39) — read-only for clients, nothing for anon
-- ─────────────────────────────────────────────────────────────
alter table public.achievements        enable row level security;   -- no policies: functions only
alter table public.session_combos      enable row level security;
alter table public.achievement_unlocks enable row level security;

revoke all on public.achievements, public.session_combos, public.achievement_unlocks
  from anon, authenticated;
revoke all on public.counted_nights, public.driven_nights, public.poured_rounds
  from anon, authenticated;
grant select on public.session_combos, public.achievement_unlocks to authenticated;

create policy session_combos_select on public.session_combos
  for select to authenticated
  using (public.is_crew_member(crew_id) or public.is_session_attendee(session_id));

create policy achievement_unlocks_select on public.achievement_unlocks
  for select to authenticated
  using (public.can_see_unlock(tier, profile_id, crew_id));

-- D69: a closed night's table is frozen — driving is decided at full time.
drop policy session_attendees_update on public.session_attendees;
create policy session_attendees_update on public.session_attendees
  for update to authenticated
  using (
    public.is_session_attendee(session_id)
    and exists (select 1 from public.sessions s
                 where s.id = session_id and s.status = 'open' and now() < s.closes_at)
  )
  with check (public.is_session_attendee(session_id));

revoke execute on function
  public.achievement_rule_ok(text, jsonb),
  public.award_combo_rungs(uuid[], text),
  public.award_lifetime_beers(uuid[], uuid[], text),
  public.award_alcohol_free_beers(uuid[], text),
  public.award_nights(uuid[], text),
  public.award_streak_weeks(uuid[], uuid[], text),
  public.award_rounds_poured(uuid[], text),
  public.award_nights_driving(uuid[], text),
  public.award_week_off(uuid[], text),
  public.award_members(uuid[], text),
  public.award_session_size(uuid[], text),
  public.award_full_crew(uuid[], text),
  public.award_session_total(uuid[], text),
  public.award_session(uuid, boolean, text),
  public.sweep_achievements(text),
  public.achievements_after_beers(),
  public.achievements_after_attendees(),
  public.achievements_after_close(),
  public.achievements_after_members()
  from public, anon, authenticated;

revoke execute on function
  public.can_see_unlock(text, uuid, uuid),
  public.achievement_catalogue(),
  public.profile_achievement_progress(uuid),
  public.crew_achievement_progress(uuid)
  from public, anon;
grant execute on function
  public.can_see_unlock(text, uuid, uuid),
  public.achievement_catalogue(),
  public.profile_achievement_progress(uuid),
  public.crew_achievement_progress(uuid)
  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. The starter catalogue (D68)
-- ─────────────────────────────────────────────────────────────
-- art: person = bottle cap {glyph|text, metal tin|brass|gold|foil, accent gold|fire|hop};
--      crew = beer mat {glyph|text, finish print|emboss|foil|framed}.
insert into public.achievements
  (code, tier, category, title, description, flavor, points, is_secret, art, sort, rule) values
-- combos: the night's total across the table, for everyone at it (D20, F1, F2)
('ON_FIRE', 'person', 'combo', 'ON FIRE',
  'The night hits 10 beers, counted across everyone at the table.', 'The table is on fire!', 10, false,
  '{"glyph":"flame","metal":"brass","accent":"fire"}', 10, '{"type":"session_total","min":10}'),
('BOOMSHAKALAKA', 'person', 'combo', 'BOOMSHAKALAKA',
  '25 beers in one night, across the table.', 'BOOMSHAKALAKA!', 20, false,
  '{"glyph":"zap","metal":"gold","accent":"fire"}', 20, '{"type":"session_total","min":25}'),
('WORLDIE', 'person', 'combo', 'WORLDIE',
  '50 in one night, across the table.', 'That is an absolute worldie.', 30, false,
  '{"glyph":"globe","metal":"gold","accent":"fire"}', 30, '{"type":"session_total","min":50}'),
('RAMPAGE', 'person', 'combo', 'RAMPAGE',
  '100 in one night, across the table.', 'The away end has lost its mind.', 40, false,
  '{"glyph":"megaphone","metal":"foil","accent":"fire"}', 40, '{"type":"session_total","min":100}'),
-- showing up — drinking or driving
('DEBUT', 'person', 'firsts', 'Debut',
  'Your first night at the table.', 'Welcome to the team sheet.', 10, false,
  '{"glyph":"star","metal":"tin","accent":"gold"}', 110, '{"type":"nights","min":1}'),
('REGULAR', 'person', 'showing_up', 'Regular',
  '10 nights at the table — drinking or driving.', 'Same time next week?', 20, false,
  '{"glyph":"calendar","metal":"brass","accent":"gold"}', 120, '{"type":"nights","min":10}'),
('ON_A_RUN', 'person', 'streak', 'On a Run',
  'A night three weeks running.', 'Three on the bounce.', 15, false,
  '{"text":"3W","metal":"tin","accent":"fire"}', 210, '{"type":"streak_weeks","min":3}'),
('FORM_OF_YOUR_LIFE', 'person', 'streak', 'Form of Your Life',
  'A night ten weeks running.', 'Ten unbeaten. Frame the form guide.', 40, false,
  '{"text":"10W","metal":"gold","accent":"fire"}', 220, '{"type":"streak_weeks","min":10}'),
('GET_THE_DRINKS_IN', 'person', 'giving', 'Get the Drinks In',
  'You''ve poured 10 rounds for the table.', 'Whose round? Yours, again.', 20, false,
  '{"glyph":"tray","metal":"brass","accent":"gold"}', 310, '{"type":"rounds_poured","min":10}'),
-- looking after each other
('DESIGNATED_DRIVER', 'person', 'care', 'Designated Driver',
  'You drove the night: at the table, out of the rounds, nothing alcoholic.', 'Everyone home. Hero.', 25, false,
  '{"glyph":"car","metal":"brass","accent":"hop"}', 410, '{"type":"nights_driving","min":1}'),
('THE_CHAUFFEUR', 'person', 'care', 'The Chauffeur',
  '10 nights driving.', 'Where to, boss?', 60, false,
  '{"glyph":"key","metal":"gold","accent":"hop"}', 420, '{"type":"nights_driving","min":10}'),
('CLEAR_HEAD', 'person', 'care', 'Clear Head',
  'Your first alcohol-free beer.', 'Zero point zero. Full marks.', 15, false,
  '{"text":"0,0","metal":"tin","accent":"hop"}', 430, '{"type":"alcohol_free_beers","min":1}'),
('CLEAN_SHEET', 'person', 'care', 'Clean Sheet',
  'A whole week off, straight after a week out. Rest counts.', 'Nothing conceded. Nothing poured.', 15, false,
  '{"glyph":"moon","metal":"tin","accent":"hop"}', 440, '{"type":"week_off"}'),
-- the owner's numbers (A4) — lifetime, never one night
('SIX_SEVEN', 'person', 'numbers', 'The Kids Think This Is Fun',
  'Your 67th beer.', 'Six… seven.', 5, true,
  '{"text":"67","metal":"tin","accent":"gold"}', 510, '{"type":"lifetime_beers","min":67}'),
('NICE', 'person', 'numbers', 'hehehe',
  'Your 69th beer.', 'Nice.', 5, true,
  '{"text":"69","metal":"tin","accent":"gold"}', 520, '{"type":"lifetime_beers","min":69}'),
('FIVE_HUNDRED', 'person', 'numbers', 'I Would Drink 500 Beers',
  'Your 500th beer.', 'Somebody cue the Proclaimers.', 5, false,
  '{"text":"500","metal":"brass","accent":"gold"}', 530, '{"type":"lifetime_beers","min":500}'),
('FIVE_HUNDRED_MORE', 'person', 'numbers', 'And I Would Drink 500 More',
  'Your 1.000th beer.', 'A thousand. That''s the encore.', 5, true,
  '{"text":"1K","metal":"gold","accent":"gold"}', 540, '{"type":"lifetime_beers","min":1000}'),
-- crew
('OFF_THE_MARK', 'crew', 'firsts', 'Off the Mark',
  'The crew''s first beer.', 'And they''re off!', 5, false,
  '{"text":"1","finish":"print"}', 1010, '{"type":"lifetime_beers","min":1}'),
('THE_INVITE', 'crew', 'firsts', 'The Invite',
  'The first friend joins with the invite code.', 'Squad assembling.', 10, false,
  '{"glyph":"ticket","finish":"print"}', 1020, '{"type":"members","min":2}'),
('FIVE_A_SIDE', 'crew', 'squad', 'Five-a-Side',
  'Five in the crew.', 'Enough for a game.', 15, false,
  '{"text":"5","finish":"emboss"}', 1110, '{"type":"members","min":5}'),
('TABLE_FOR_EIGHT', 'crew', 'squad', 'Table for Eight',
  'Eight at one night.', 'Push the tables together.', 25, false,
  '{"glyph":"users","finish":"emboss"}', 1120, '{"type":"session_size","min":8}'),
('FULL_HOUSE', 'crew', 'squad', 'Full House',
  'Every member at the same night — four of you or more.', 'Nobody missing. Nobody.', 40, false,
  '{"glyph":"house","finish":"foil"}', 1130, '{"type":"full_crew","min_members":4}'),
('BACK_TO_BACK', 'crew', 'streak', 'Back-to-Back',
  'Crew nights two weeks running.', 'Same again next week.', 10, false,
  '{"glyph":"layers","finish":"print"}', 1210, '{"type":"streak_weeks","min":2}'),
('MONTH_OF_FIXTURES', 'crew', 'streak', 'A Month of Fixtures',
  'Crew nights four weeks running.', 'A proper fixture list.', 30, false,
  '{"glyph":"calendar","finish":"foil"}', 1220, '{"type":"streak_weeks","min":4}'),
('ALL_FOUR_RUNGS', 'crew', 'combo', 'All Four Rungs',
  'The crew''s nights have hit every combo on the ladder.', 'ON FIRE to RAMPAGE. The full set.', 50, true,
  '{"glyph":"trophy","finish":"framed"}', 1310, '{"type":"combo_rungs"}');

-- ─────────────────────────────────────────────────────────────
-- 8. Backfill what's already happened — quietly
-- ─────────────────────────────────────────────────────────────
select public.sweep_achievements('backfill');

-- Realtime after the backfill, so none of it is broadcast. The app toasts source='live' only.
alter publication supabase_realtime add table public.session_combos, public.achievement_unlocks;

-- Nightly, after the purge (04:17). Monday's run is the one that notices a week off.
select cron.schedule('sweep-achievements', '37 4 * * *',
                     $$select public.sweep_achievements()$$);
