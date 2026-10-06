-- Counter tests (C4, D40): running totals, weekly figures, and who may read them.
--
-- Fixtures are written as the table owner. The summaries need a signed-in caller,
-- so those checks use test_helpers.sign_in() from helpers.sql.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  anna  uuid := gen_random_uuid();
  bjorn uuid := gen_random_uuid();
  dag   uuid := gen_random_uuid();   -- the designated driver: there, drinks nothing
  erik  uuid := gen_random_uuid();
  olle  uuid := gen_random_uuid();
  nils  uuid := gen_random_uuid();
  p uuid;                            -- Onsdagar: the streak story
  q uuid;                            -- Elsewhere: the counter story
  s uuid;
  b uuid;
  rid uuid := gen_random_uuid();
  g0 bigint;
  k int;
  r record;
  failed boolean;
  snap_before text;
  snap_after text;
  monday constant timestamptz :=
    date_trunc('week', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
begin
  select total_beers into g0 from global_stats;

  insert into auth.users (id) values (anna), (bjorn), (dag), (erik), (olle), (nils);
  insert into profiles (id, display_name, initials) values
    (anna, 'Anna', 'A'), (bjorn, 'Björn', 'B'), (dag, 'Dag', 'D'),
    (erik, 'Erik', 'E'), (olle, 'Olle', 'O'), (nils, 'Nils', 'N');

  insert into parties (name, created_by) values ('Elsewhere', olle) returning id into q;
  insert into party_members (party_id, profile_id, role)
    values (q, olle, 'captain'), (q, nils, 'member');

  -- ── a beer moves every scope at once ────────────────────────
  insert into sessions (party_id, created_by) values (q, olle) returning id into s;
  insert into session_attendees (session_id, profile_id) values (s, olle), (s, nils);
  insert into beers (session_id, profile_id, added_by, logged_at)
    values (s, olle, olle, now() - interval '3 hours');

  if (select total_beers from global_stats) <> g0 + 1 then
    raise exception 'TEST FAIL: the global counter did not move';
  end if;
  if (select total_beers from party_stats where party_id = q) is distinct from 1::bigint then
    raise exception 'TEST FAIL: the party counter did not move';
  end if;
  if (select total_beers from profile_stats where profile_id = olle) is distinct from 1::bigint then
    raise exception 'TEST FAIL: the drinker''s counter did not move';
  end if;

  -- a round is one statement and one beer each
  insert into beers (session_id, profile_id, added_by, round_id, logged_at)
  select s, x, olle, rid, now() - interval '2 hours' from unnest(array[olle, nils]) x;

  insert into beers (session_id, profile_id, added_by, logged_at)
    values (s, nils, olle, now() - interval '1 hour') returning id into b;

  if (select total_beers from global_stats) <> g0 + 4
     or (select total_beers from party_stats where party_id = q) <> 4
     or (select total_beers from profile_stats where profile_id = olle) <> 2
     or (select total_beers from profile_stats where profile_id = nils) <> 2 then
    raise exception 'TEST FAIL: a round did not count one beer per person';
  end if;

  -- ── "−" takes a beer off every counter, and its timestamp ───
  update beers set voided_at = now(), voided_by = olle where id = b;

  if (select total_beers from global_stats) <> g0 + 3
     or (select total_beers from party_stats where party_id = q) <> 3
     or (select total_beers from profile_stats where profile_id = nils) <> 1 then
    raise exception 'TEST FAIL: a void did not come off the counters';
  end if;
  if (select last_logged_at from profile_stats where profile_id = nils)
       is distinct from now() - interval '2 hours'
     or (select last_logged_at from party_stats where party_id = q)
       is distinct from now() - interval '2 hours' then
    raise exception 'TEST FAIL: last_logged_at still points at a voided beer';
  end if;

  -- un-voiding (owner only) puts it back; deleting takes it away again
  update beers set voided_at = null, voided_by = null where id = b;
  if (select total_beers from party_stats where party_id = q) <> 4 then
    raise exception 'TEST FAIL: an un-void did not go back on the counters';
  end if;

  delete from beers where id = b;
  if (select total_beers from global_stats) <> g0 + 3
     or (select total_beers from party_stats where party_id = q) <> 3 then
    raise exception 'TEST FAIL: a deleted beer stayed on the counters';
  end if;

  -- a beer that arrives already voided never counts
  insert into beers (session_id, profile_id, added_by, voided_at, voided_by)
    values (s, olle, olle, now(), olle);
  if (select total_beers from party_stats where party_id = q) <> 3 then
    raise exception 'TEST FAIL: a beer born voided was counted';
  end if;

  update sessions set status = 'closed', closed_at = now() where id = s;

  -- ── the triggers and a fresh count agree ────────────────────
  select string_agg(format('%s:%s:%s', party_id, total_beers, last_logged_at), ',' order by party_id)
    || '|' || (select string_agg(format('%s:%s:%s', profile_id, total_beers, last_logged_at), ',' order by profile_id)
               from profile_stats where total_beers > 0)
    || '|' || (select total_beers from global_stats)
    into snap_before
  from party_stats where total_beers > 0;

  perform recompute_stats();

  select string_agg(format('%s:%s:%s', party_id, total_beers, last_logged_at), ',' order by party_id)
    || '|' || (select string_agg(format('%s:%s:%s', profile_id, total_beers, last_logged_at), ',' order by profile_id)
               from profile_stats where total_beers > 0)
    || '|' || (select total_beers from global_stats)
    into snap_after
  from party_stats where total_beers > 0;

  if snap_before is distinct from snap_after then
    raise exception 'TEST FAIL: the triggers drifted from a fresh count — before: % after: %',
      snap_before, snap_after;
  end if;

  -- and a corrupted counter is repaired by recomputing
  update party_stats set total_beers = 999 where party_id = q;
  perform recompute_stats();
  if (select total_beers from party_stats where party_id = q) <> 3 then
    raise exception 'TEST FAIL: recompute_stats did not repair a corrupted counter';
  end if;

  -- ── weekly streaks (B1, B5) ─────────────────────────────────
  insert into parties (name, created_by) values ('Onsdagar', anna) returning id into p;
  insert into party_members (party_id, profile_id, role)
    values (p, anna, 'captain'), (p, bjorn, 'member'), (p, dag, 'member'), (p, erik, 'member');

  -- One night a week, Tuesdays at 19:00 Stockholm time. Who was there:
  --   week  0      Anna, Dag          Dag drives: at the table, drinks nothing
  --   week −1      Anna, Björn, Dag
  --   week −2      Anna, Björn
  --   week −3      Anna, Björn        every beer voided — the week doesn't count
  --   week −4      Anna, Björn
  --   week −5…−7   Anna, Erik
  foreach k in array array[0, -1, -2, -3, -4, -5, -6, -7] loop
    insert into sessions (party_id, started_at, timezone, created_by)
      values (p, monday + make_interval(days => 7 * k + 1, hours => 19), 'Europe/Stockholm', anna)
      returning id into s;

    insert into session_attendees (session_id, profile_id) values (s, anna);
    if k = 0 then
      insert into session_attendees (session_id, profile_id) values (s, dag);
    elsif k = -1 then
      insert into session_attendees (session_id, profile_id) values (s, bjorn), (s, dag);
    elsif k >= -4 then
      insert into session_attendees (session_id, profile_id) values (s, bjorn);
    else
      insert into session_attendees (session_id, profile_id) values (s, erik);
    end if;

    insert into beers (session_id, profile_id, added_by) values (s, anna, anna), (s, anna, anna);
    if k between -4 and -1 then
      insert into beers (session_id, profile_id, added_by) values (s, bjorn, anna);
    elsif k <= -5 then
      insert into beers (session_id, profile_id, added_by) values (s, erik, anna);
    end if;
    if k = -3 then
      update beers set voided_at = now(), voided_by = anna where session_id = s;
    end if;

    update sessions set status = 'closed', closed_at = now() where id = s;
  end loop;

  perform test_helpers.sign_in(anna);

  select * into r from profile_summary(anna);
  if (r.current_streak_weeks, r.best_streak_weeks, r.beers_this_week, r.total_beers)
       is distinct from (3, 4, 2::bigint, 14::bigint) then
    raise exception 'TEST FAIL: Anna should be on 3 weeks (best 4), 2 this week, 14 total — got %', r;
  end if;

  -- Björn's week −3 had only voided beers, so last week ends a 2-week run
  select * into r from profile_summary(bjorn);
  if (r.current_streak_weeks, r.best_streak_weeks, r.beers_this_week, r.total_beers)
       is distinct from (2, 2, 0::bigint, 3::bigint) then
    raise exception 'TEST FAIL: Björn should be on 2 weeks (best 2), 3 total — got %', r;
  end if;

  -- the designated driver keeps a streak without a single beer
  select * into r from profile_summary(dag);
  if (r.current_streak_weeks, r.best_streak_weeks, r.total_beers)
       is distinct from (2, 2, 0::bigint) then
    raise exception 'TEST FAIL: Dag drove twice running and should be on 2 weeks — got %', r;
  end if;

  -- three weeks running, but a month ago: best 3, current 0
  select * into r from profile_summary(erik);
  if (r.current_streak_weeks, r.best_streak_weeks)
       is distinct from (0, 3) then
    raise exception 'TEST FAIL: Erik''s streak ended a month ago — got %', r;
  end if;

  select * into r from party_summary(p);
  if (r.current_streak_weeks, r.best_streak_weeks, r.beers_this_week, r.total_beers)
       is distinct from (3, 4, 2::bigint, 20::bigint) then
    raise exception 'TEST FAIL: Onsdagar should be on 3 weeks (best 4), 2 this week, 20 total — got %', r;
  end if;

  -- ── who may read the numbers ────────────────────────────────
  perform test_helpers.sign_in(olle);
  if (select count(*) from profile_summary(anna)) <> 0
     or (select count(*) from party_summary(p)) <> 0 then
    raise exception 'TEST FAIL: an outsider read Onsdagar''s summaries';
  end if;
  if (select count(*) from party_stats where party_id = p) <> 0
     or (select count(*) from profile_stats where profile_id = anna) <> 0 then
    raise exception 'TEST FAIL: an outsider read Onsdagar''s counters';
  end if;
  if (select count(*) from global_stats) <> 1 then
    raise exception 'TEST FAIL: a signed-in user should see the global counter';
  end if;

  failed := false;
  begin
    perform recompute_stats();
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a client could run recompute_stats'; end if;

  failed := false;
  begin
    update party_stats set total_beers = 1000000 where party_id = q;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a client wrote to a counter'; end if;

  perform test_helpers.sign_out();
  perform set_config('role', 'anon', true);
  failed := false;
  begin
    perform count(*) from global_stats;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a signed-out visitor read the global counter'; end if;
  reset role;

  raise notice 'ALL STATS TESTS PASSED';
end;
$$;
