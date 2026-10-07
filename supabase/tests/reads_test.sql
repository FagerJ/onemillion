-- Tests for the app's read functions (C6, C7): the leaderboard and the feed, and
-- that both read through the caller's RLS.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  anna    uuid := gen_random_uuid();
  bjorn   uuid := gen_random_uuid();
  cecilia uuid := gen_random_uuid();   -- drank a month ago, has since left
  olle    uuid := gen_random_uuid();   -- outsider
  p uuid;
  tonight uuid;
  old uuid;
  b uuid;
  r record;
  n int;
  first_started timestamptz;
begin
  insert into auth.users (id) values (anna), (bjorn), (cecilia), (olle);
  insert into profiles (id, display_name, initials) values
    (anna, 'Anna', 'A'), (bjorn, 'Björn', 'B'), (cecilia, 'Cecilia', 'C'), (olle, 'Olle', 'O');
  insert into parties (name, created_by) values ('Onsdagar', anna) returning id into p;
  insert into party_members (party_id, profile_id, role)
    values (p, anna, 'captain'), (p, bjorn, 'member'), (p, cecilia, 'member');

  -- three weeks ago: Anna 1, Cecilia 4
  insert into sessions (party_id, created_by) values (p, anna) returning id into old;
  insert into session_attendees (session_id, profile_id) values (old, anna), (old, cecilia);
  insert into beers (session_id, profile_id, added_by)
  select old, x, anna from unnest(array[anna, cecilia, cecilia, cecilia, cecilia]) x;
  update sessions set status = 'closed', closed_at = now(),
                      started_at = now() - interval '21 days' where id = old;

  update party_members set left_at = now() where party_id = p and profile_id = cecilia;

  -- tonight: Anna 3, Björn 2 — plus a third for Björn that gets voided
  insert into sessions (party_id, created_by) values (p, anna) returning id into tonight;
  insert into session_attendees (session_id, profile_id) values (tonight, anna), (tonight, bjorn);
  insert into beers (session_id, profile_id, added_by)
  select tonight, x, anna from unnest(array[anna, anna, anna, bjorn, bjorn]) x;
  insert into beers (session_id, profile_id, added_by) values (tonight, bjorn, bjorn) returning id into b;
  update beers set voided_at = now(), voided_by = bjorn where id = b;

  perform test_helpers.sign_in(anna);

  -- ── leaderboard (C6) ────────────────────────────────────────
  select count(*) into n from party_leaderboard(p);
  if n <> 3 then raise exception 'TEST FAIL: the leaderboard should list all 3 who have been in the party, got %', n; end if;

  select * into r from party_leaderboard(p) limit 1;
  if (r.display_name, r.total_beers, r.beers_this_week, r.is_current)
       is distinct from ('Anna'::text, 4::bigint, 3::bigint, true) then
    raise exception 'TEST FAIL: Anna should lead on 4 (3 this week; ties break by name) — got %', r;
  end if;

  select * into r from party_leaderboard(p) where profile_id = cecilia;
  if (r.total_beers, r.beers_this_week, r.is_current) is distinct from (4::bigint, 0::bigint, false) then
    raise exception 'TEST FAIL: Cecilia left but keeps her 4 beers, none this week — got %', r;
  end if;

  select * into r from party_leaderboard(p) where profile_id = bjorn;
  if (r.total_beers, r.beers_this_week) is distinct from (2::bigint, 2::bigint) then
    raise exception 'TEST FAIL: Björn''s voided beer should not count — got %', r;
  end if;

  -- ── feed (C7) ───────────────────────────────────────────────
  select * into r from party_feed(p) limit 1;
  if r.session_id <> tonight or r.status <> 'open' or r.total_beers <> 5 then
    raise exception 'TEST FAIL: the feed should open with tonight, live, 5 beers — got %', r;
  end if;
  if jsonb_array_length(r.attendees) <> 2
     or (select (e ->> 'beers')::int from jsonb_array_elements(r.attendees) e
          where e ->> 'display_name' = 'Björn') <> 2 then
    raise exception 'TEST FAIL: tonight should show 2 attendees, Björn on 2 — got %', r.attendees;
  end if;

  select count(*) into n from party_feed(p);
  if n <> 2 then raise exception 'TEST FAIL: the feed should hold both nights, got %', n; end if;

  -- paging: one at a time, then everything older than the first
  select started_at into first_started from party_feed(p, 1);
  select * into r from party_feed(p, 20, first_started);
  if r.session_id <> old or r.total_beers <> 5 then
    raise exception 'TEST FAIL: paging back should reach the old night with its 5 beers — got %', r;
  end if;

  -- ── outsiders get nothing, through plain RLS ────────────────
  perform test_helpers.sign_in(olle);
  if (select count(*) from party_leaderboard(p)) <> 0 or (select count(*) from party_feed(p)) <> 0 then
    raise exception 'TEST FAIL: an outsider read Onsdagar''s leaderboard or feed';
  end if;

  perform test_helpers.sign_out();

  -- ── Realtime carries the tables the app watches ─────────────
  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('beers', 'session_attendees', 'sessions', 'global_stats', 'party_stats');
  if n <> 5 then raise exception 'TEST FAIL: Realtime is missing tables the app subscribes to'; end if;

  raise notice 'ALL READS TESTS PASSED';
end;
$$;
