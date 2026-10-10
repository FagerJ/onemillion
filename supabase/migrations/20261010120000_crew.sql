-- ONE MILLION BEERS — the party is now a crew (D45)
--
-- The group of friends is called a crew from here on (owner, 2026-10-10). Only names
-- change: no data, no behaviour.
--
--   * Tables and columns are renamed in place, so their rows, column grants and the
--     Realtime publication come along untouched.
--   * Constraints, indexes, triggers and policies get the new word too, so error
--     messages and the catalogue don't talk about parties.
--   * A function can't change its parameter names under CREATE OR REPLACE, and most
--     of these take `p_party`. So every function that mentions a party is created
--     again under its new name — and the policies that call one are dropped first
--     and created again after. The bodies are the ones from the earlier migrations
--     with the word changed: from here on, this file is where they live.
--
-- "party" isn't used for anything any more. A night out is a session (a night).

-- ─────────────────────────────────────────────────────────────
-- 1. Out with the old — the policies first, then the functions they call
-- ─────────────────────────────────────────────────────────────
drop policy profiles_select           on public.profiles;
drop policy parties_select            on public.parties;
drop policy parties_update            on public.parties;
drop policy party_members_select      on public.party_members;
drop policy sessions_select           on public.sessions;
drop policy sessions_insert           on public.sessions;
drop policy session_attendees_select  on public.session_attendees;
drop policy session_attendees_insert  on public.session_attendees;
drop policy beers_select              on public.beers;
drop policy party_stats_select        on public.party_stats;
drop policy profile_stats_select      on public.profile_stats;

drop function public.is_party_member(uuid);
drop function public.is_party_captain(uuid);
drop function public.shares_party_with(uuid);
drop function public.create_party(text);
drop function public.join_party(text);
drop function public.leave_party(uuid);
drop function public.remove_member(uuid, uuid);
drop function public.promote_member(uuid, uuid);
drop function public.regenerate_invite_code(uuid);
drop function public.party_summary(uuid);
drop function public.party_leaderboard(uuid);
drop function public.party_feed(uuid, int, timestamptz);

-- ─────────────────────────────────────────────────────────────
-- 2. Tables, columns, constraints, indexes, triggers
-- ─────────────────────────────────────────────────────────────
alter table public.parties       rename to crews;
alter table public.party_members rename to crew_members;
alter table public.party_stats   rename to crew_stats;

alter table public.crew_members      rename column party_id to crew_id;
alter table public.sessions          rename column party_id to crew_id;
alter table public.session_attendees rename column party_id to crew_id;
alter table public.beers             rename column party_id to crew_id;
alter table public.crew_stats        rename column party_id to crew_id;

-- Renaming a primary key or unique constraint renames its index as well.
alter table public.crews rename constraint parties_pkey              to crews_pkey;
alter table public.crews rename constraint parties_name_check        to crews_name_check;
alter table public.crews rename constraint parties_invite_code_key   to crews_invite_code_key;
alter table public.crews rename constraint parties_invite_code_check to crews_invite_code_check;
alter table public.crews rename constraint parties_max_members_check to crews_max_members_check;
alter table public.crews rename constraint parties_created_by_fkey   to crews_created_by_fkey;

alter table public.crew_members rename constraint party_members_pkey            to crew_members_pkey;
alter table public.crew_members rename constraint party_members_party_id_fkey   to crew_members_crew_id_fkey;
alter table public.crew_members rename constraint party_members_profile_id_fkey to crew_members_profile_id_fkey;
alter table public.crew_members rename constraint party_members_role_check      to crew_members_role_check;

alter table public.crew_stats rename constraint party_stats_pkey              to crew_stats_pkey;
alter table public.crew_stats rename constraint party_stats_party_id_fkey     to crew_stats_crew_id_fkey;
alter table public.crew_stats rename constraint party_stats_total_beers_check to crew_stats_total_beers_check;

alter table public.sessions rename constraint sessions_party_id_fkey to sessions_crew_id_fkey;
alter table public.session_attendees
  rename constraint session_attendees_party_id_profile_id_fkey to session_attendees_crew_id_profile_id_fkey;

alter index public.parties_guild_id_idx        rename to crews_guild_id_idx;
alter index public.party_members_profile_idx   rename to crew_members_profile_idx;
alter index public.sessions_party_started_idx  rename to sessions_crew_started_idx;
alter index public.sessions_one_open_per_party rename to sessions_one_open_per_crew;
alter index public.beers_party_idx             rename to beers_crew_idx;

alter trigger party_members_respect_cap     on public.crew_members      rename to crew_members_respect_cap;
alter trigger session_attendees_stamp_party on public.session_attendees rename to session_attendees_stamp_crew;

comment on table public.crews is
  'The persistent group of friends, joined with an invite code. Called a party until D45.';
comment on index public.sessions_one_open_per_crew is
  'A crew can only have one night running at a time. Keeps "the current session" '
  'unambiguous in the UI and stops stray sessions collecting beers.';
comment on table public.profile_stats is
  'Across every crew the person has drunk in. Crew-mates can read it (D40).';

-- ─────────────────────────────────────────────────────────────
-- 3. Trigger functions — renamed in place, so their triggers stay attached
-- ─────────────────────────────────────────────────────────────
alter function public.assert_party_not_full()        rename to assert_crew_not_full;
alter function public.stamp_attendee_party()         rename to stamp_attendee_crew;
alter function public.close_stale_session_of_party() rename to close_stale_session_of_crew;

-- Crew size cap (B2 / D33). Checked on joining and on rejoining (left_at cleared).
create or replace function public.assert_crew_not_full()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n int;
  cap int;
begin
  if tg_op = 'UPDATE' and not (old.left_at is not null and new.left_at is null) then
    return new;
  end if;

  -- Lock the crew row so two people joining at once can't both take the last seat.
  select max_members into cap from crews where id = new.crew_id for update;
  select count(*) into n
  from crew_members
  where crew_id = new.crew_id and left_at is null;

  if n >= cap then
    raise exception 'Crew % is full (% of % members)', new.crew_id, n, cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.stamp_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select c.guild_id into new.guild_id from crews c where c.id = new.crew_id;

  -- B5: the session creator's timezone, unless the client passed one.
  if new.timezone is null then
    select timezone into new.timezone from profiles where id = new.created_by;
  end if;

  -- D32: 09:00 local the morning after. A session started before 06:00 belongs
  -- to the night before, so a 01:00 start still closes at 09:00 that morning
  -- and a breakfast start doesn't close within minutes. Range: 3h to 27h.
  --
  -- D41: measured from the later of the start and the moment it was opened, so
  -- last night can still be logged today (D16) instead of closing on arrival.
  new.closes_at :=
    ((((greatest(new.started_at, new.created_at) at time zone new.timezone)
        - interval '6 hours')::date + 1)
      + time '09:00') at time zone new.timezone;

  return new;
end;
$$;

create or replace function public.stamp_beer_from_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  select crew_id, guild_id, status, closes_at into s from sessions where id = new.session_id;

  -- `not found` also covers a session the caller can't see under RLS. Past its
  -- closing time counts as closed even before the job gets to it (D41).
  if not found or s.status <> 'open' or now() >= s.closes_at then
    raise exception 'Session % is not open', new.session_id
      using errcode = 'check_violation';
  end if;

  new.crew_id := s.crew_id;
  new.guild_id := s.guild_id;
  return new;
end;
$$;

create or replace function public.stamp_attendee_crew()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  select crew_id, status, closes_at into s from sessions where id = new.session_id;

  -- Joining a closed night would hand out its combos after the fact.
  if not found or s.status <> 'open' or now() >= s.closes_at then
    raise exception 'Session % is not open', new.session_id
      using errcode = 'check_violation';
  end if;

  new.crew_id := s.crew_id;

  -- The FK only proves the membership row exists; someone who has left the crew
  -- still has one (B4 keeps it for history). Check they are current.
  if not exists (
    select 1 from crew_members
    where crew_id = new.crew_id
      and profile_id = new.profile_id
      and left_at is null
  ) then
    raise exception 'Profile % is not a current member of crew %',
      new.profile_id, new.crew_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- The safety net from D41: opening a night closes the crew's stale one first.
create or replace function public.close_stale_session_of_crew()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions
     set status = 'closed', closed_at = closes_at
   where crew_id = new.crew_id and status = 'open' and closes_at <= now();
  return new;
end;
$$;

-- +1 when a live beer appears, −1 when one stops being live (D40).
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

  -- Lock order is always global → crew → profile, so two rounds landing at the
  -- same moment queue behind each other instead of deadlocking.
  update public.global_stats
     set total_beers = total_beers + delta,
         updated_at = now()
   where id = 1;

  -- Adding upserts. Taking away is a plain update: an upsert would have its −1
  -- insert row rejected by the check constraint before Postgres looked for the
  -- conflict.
  if delta > 0 then
    insert into public.crew_stats as cs (crew_id, total_beers, last_logged_at)
    values (b.crew_id, 1, b.logged_at)
    on conflict (crew_id) do update
       set total_beers = cs.total_beers + 1,
           last_logged_at = greatest(cs.last_logged_at, b.logged_at),
           updated_at = now();

    insert into public.profile_stats as ps (profile_id, total_beers, last_logged_at)
    values (b.profile_id, 1, b.logged_at)
    on conflict (profile_id) do update
       set total_beers = ps.total_beers + 1,
           last_logged_at = greatest(ps.last_logged_at, b.logged_at),
           updated_at = now();
  else
    update public.crew_stats
       set total_beers = total_beers - 1,
           last_logged_at = (select max(x.logged_at) from public.beers x
                              where x.crew_id = b.crew_id and x.voided_at is null),
           updated_at = now()
     where crew_id = b.crew_id;

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

-- ─────────────────────────────────────────────────────────────
-- 4. Plain functions whose bodies mention the old names
-- ─────────────────────────────────────────────────────────────
-- No I, O, 1 or 0: these get read aloud in pubs.
create or replace function public.generate_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for attempt in 1..20 loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from crews where invite_code = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Could not generate a free invite code';
end;
$$;

-- Rebuild every total from `beers` (D40).
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

  delete from public.crew_stats;
  insert into public.crew_stats (crew_id, total_beers, last_logged_at)
  select crew_id, count(*), max(logged_at)
  from public.beers where voided_at is null
  group by crew_id;

  delete from public.profile_stats;
  insert into public.profile_stats (profile_id, total_beers, last_logged_at)
  select profile_id, count(*), max(logged_at)
  from public.beers where voided_at is null
  group by profile_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. The RLS helpers (D39) — each one only ever answers about the caller
-- ─────────────────────────────────────────────────────────────
create function public.is_crew_member(p_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = p_crew
      and profile_id = (select auth.uid())
      and left_at is null
  );
$$;

create function public.is_crew_captain(p_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = p_crew
      and profile_id = (select auth.uid())
      and left_at is null
      and role = 'captain'
  );
$$;

-- Has p_profile ever been in a crew the caller is in now? `left_at` is only checked
-- on the caller's side, so someone who left keeps their name in the crew's history.
create function public.shares_crew_with(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crew_members me
    join public.crew_members them on them.crew_id = me.crew_id
    where me.profile_id = (select auth.uid())
      and me.left_at is null
      and them.profile_id = p_profile
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Membership — functions only (D39)
-- ─────────────────────────────────────────────────────────────
create function public.create_crew(p_name text)
returns public.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  c public.crews;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  insert into public.crews (name, created_by) values (p_name, me) returning * into c;
  insert into public.crew_members (crew_id, profile_id, role) values (c.id, me, 'captain');
  return c;
end;
$$;

-- Codes are case-insensitive. Someone who left can rejoin with the current code and
-- keeps their original joined_at; the cap trigger checks the seat either way.
create function public.join_crew(p_code text)
returns public.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  c public.crews;
  was_left timestamptz;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  select * into c from public.crews where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'No crew has that code' using errcode = 'no_data_found';
  end if;

  select left_at into was_left
  from public.crew_members
  where crew_id = c.id and profile_id = me;

  if not found then
    insert into public.crew_members (crew_id, profile_id) values (c.id, me);
  elsif was_left is not null then
    update public.crew_members set left_at = null
    where crew_id = c.id and profile_id = me;
  end if;

  return c;
end;
$$;

-- B4: leaving sets left_at and keeps all history. If the last captain leaves, the
-- longest-standing member gets the armband so the crew is never captainless.
create function public.leave_crew(p_crew uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
begin
  update public.crew_members
     set left_at = now(), role = 'member'
   where crew_id = p_crew and profile_id = me and left_at is null;

  if not found then
    raise exception 'You are not in that crew' using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.crew_members
    where crew_id = p_crew and role = 'captain' and left_at is null
  ) then
    update public.crew_members set role = 'captain'
    where (crew_id, profile_id) = (
      select crew_id, profile_id from public.crew_members
      where crew_id = p_crew and left_at is null
      order by joined_at, profile_id
      limit 1
    );
  end if;
end;
$$;

-- B4: a captain removes a member. Same effect as them leaving: history stays.
-- They can rejoin with the code, so pair this with regenerate_invite_code().
create function public.remove_member(p_crew uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_crew_captain(p_crew) then
    raise exception 'Only a captain can remove members' using errcode = 'insufficient_privilege';
  end if;
  if p_profile = auth.uid() then
    raise exception 'Use leave_crew() to leave' using errcode = 'invalid_parameter_value';
  end if;

  update public.crew_members
     set left_at = now(), role = 'member'
   where crew_id = p_crew and profile_id = p_profile and left_at is null;

  if not found then
    raise exception 'Not a current member' using errcode = 'no_data_found';
  end if;
end;
$$;

-- B4: the founder is captain and can promote others; captains are equals.
create function public.promote_member(p_crew uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_crew_captain(p_crew) then
    raise exception 'Only a captain can promote members' using errcode = 'insufficient_privilege';
  end if;

  update public.crew_members set role = 'captain'
   where crew_id = p_crew and profile_id = p_profile and left_at is null;

  if not found then
    raise exception 'Not a current member' using errcode = 'no_data_found';
  end if;
end;
$$;

create function public.regenerate_invite_code(p_crew uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_crew_captain(p_crew) then
    raise exception 'Only a captain can change the invite code' using errcode = 'insufficient_privilege';
  end if;

  update public.crews set invite_code = public.generate_invite_code()
   where id = p_crew
  returning invite_code into code;
  return code;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Reads for the dashboard (D40) and the screens (C6, C7)
-- ─────────────────────────────────────────────────────────────
-- Unchanged apart from calling shares_crew_with().
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
  if not (p_profile = auth.uid() or public.shares_crew_with(p_profile)) then
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

create function public.crew_summary(p_crew uuid)
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
  if not public.is_crew_member(p_crew) then
    return;
  end if;

  select public.week_start(now(), p.timezone) into this_week
  from public.profiles p where p.id = auth.uid();

  return query
  with nights as (
    select s.id, public.week_start(s.started_at, s.timezone) as wk
    from public.sessions s
    where s.crew_id = p_crew
      and exists (select 1 from public.beers x
                   where x.session_id = s.id and x.voided_at is null)
  )
  select
    coalesce(cs.total_beers, 0),
    (select count(*) from public.beers x
       join nights m on m.id = x.session_id
      where x.voided_at is null and m.wk = this_week),
    st.current_weeks,
    st.best_weeks,
    cs.last_logged_at
  from public.streak_of((select array_agg(wk) from nights), this_week) st
  left join public.crew_stats cs on cs.crew_id = p_crew;
end;
$$;

-- C6: everyone who has been in the crew, with their beers in it. Departed members
-- stay on the board (history is never rewritten) with is_current = false.
create function public.crew_leaderboard(p_crew uuid)
returns table (
  profile_id uuid,
  display_name text,
  initials text,
  avatar_color text,
  total_beers bigint,
  beers_this_week bigint,
  is_current boolean
)
language sql
stable
set search_path = ''
as $$
  with viewer as (
    select public.week_start(now(), p.timezone) as this_week
    from public.profiles p where p.id = (select auth.uid())
  )
  select
    pr.id,
    pr.display_name,
    pr.initials,
    pr.avatar_color,
    count(b.id),
    count(b.id) filter (
      where public.week_start(s.started_at, s.timezone) = (select this_week from viewer)
    ),
    cm.left_at is null
  from public.crew_members cm
  join public.profiles pr on pr.id = cm.profile_id
  left join public.beers b
    on b.crew_id = cm.crew_id and b.profile_id = cm.profile_id and b.voided_at is null
  left join public.sessions s on s.id = b.session_id
  where cm.crew_id = p_crew
  group by pr.id, cm.left_at
  order by count(b.id) desc, pr.display_name;
$$;

-- C7: the crew's nights, newest first, the live one included.
-- Page backwards with p_before = the oldest started_at already shown.
create function public.crew_feed(
  p_crew uuid,
  p_limit int default 20,
  p_before timestamptz default null
)
returns table (
  session_id uuid,
  status text,
  started_at timestamptz,
  closed_at timestamptz,
  closes_at timestamptz,
  note text,
  total_beers bigint,
  attendees jsonb
)
language sql
stable
set search_path = ''
as $$
  select
    s.id,
    s.status,
    s.started_at,
    s.closed_at,
    s.closes_at,
    s.note,
    (select count(*) from public.beers b
      where b.session_id = s.id and b.voided_at is null),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'profile_id', p.id,
               'display_name', p.display_name,
               'initials', p.initials,
               'avatar_color', p.avatar_color,
               'beers', (select count(*) from public.beers b
                          where b.session_id = s.id and b.profile_id = p.id
                            and b.voided_at is null)
             ) order by a.joined_at)
      from public.session_attendees a
      join public.profiles p on p.id = a.profile_id
      where a.session_id = s.id
    ), '[]'::jsonb)
  from public.sessions s
  where s.crew_id = p_crew
    and (p_before is null or s.started_at < p_before)
  order by s.started_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. The policies again, in the new words (D39)
-- ─────────────────────────────────────────────────────────────
-- Profiles: yourself, plus anyone who is or was in a crew you're in now.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_crew_with(id));

-- Crews: members see their crew; captains rename it (B4). Creating and joining go
-- through create_crew() / join_crew(), so a crew can't be found by browsing.
create policy crews_select on public.crews
  for select to authenticated
  using (public.is_crew_member(id));

create policy crews_update on public.crews
  for update to authenticated
  using (public.is_crew_captain(id))
  with check (public.is_crew_captain(id));

-- Members: everyone in your crew, past members included (history), plus your own
-- rows in crews you've left. All writes go through the functions above.
create policy crew_members_select on public.crew_members
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_crew_member(crew_id));

-- Sessions: the crew watches; any current member can start one.
create policy sessions_select on public.sessions
  for select to authenticated
  using (public.is_crew_member(crew_id) or public.is_session_attendee(id));

-- D16: a night can be logged for today or yesterday, never the future — measured in
-- the session's own timezone, which the BEFORE trigger has stamped by now.
create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_crew_member(crew_id)
    and started_at <= now() + interval '5 minutes'
    and started_at >= (date_trunc('day', now() at time zone timezone) - interval '1 day')
                        at time zone timezone
  );

-- Attendees: check yourself in, or add a crew-mate once you're there yourself or if
-- you started the night (Q17 / D22a — joining the crew is the consent). The
-- starter clause lets "start a night with these four" be one insert.
create policy session_attendees_select on public.session_attendees
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_crew_member(crew_id));

create policy session_attendees_insert on public.session_attendees
  for insert to authenticated
  with check (
    public.is_crew_member(crew_id)
    and (
      profile_id = (select auth.uid())
      or public.is_session_attendee(session_id)
      or exists (select 1 from public.sessions s
                  where s.id = session_id and s.created_by = (select auth.uid()))
    )
  );

-- Beers: the crew sees them; you always see your own, even after leaving.
create policy beers_select on public.beers
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_crew_member(crew_id));

create policy crew_stats_select on public.crew_stats
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy profile_stats_select on public.profile_stats
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.shares_crew_with(profile_id));

-- ─────────────────────────────────────────────────────────────
-- 9. Who may call what — new functions start open to everyone, as before
-- ─────────────────────────────────────────────────────────────
revoke execute on function
  public.is_crew_member(uuid), public.is_crew_captain(uuid), public.shares_crew_with(uuid),
  public.create_crew(text), public.join_crew(text), public.leave_crew(uuid),
  public.remove_member(uuid, uuid), public.promote_member(uuid, uuid),
  public.regenerate_invite_code(uuid),
  public.crew_summary(uuid), public.crew_leaderboard(uuid),
  public.crew_feed(uuid, int, timestamptz)
  from public, anon;

grant execute on function
  public.is_crew_member(uuid), public.is_crew_captain(uuid), public.shares_crew_with(uuid),
  public.create_crew(text), public.join_crew(text), public.leave_crew(uuid),
  public.remove_member(uuid, uuid), public.promote_member(uuid, uuid),
  public.regenerate_invite_code(uuid),
  public.crew_summary(uuid), public.crew_leaderboard(uuid),
  public.crew_feed(uuid, int, timestamptz)
  to authenticated;
