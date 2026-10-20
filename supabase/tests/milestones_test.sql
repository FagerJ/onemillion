-- Milestone tests (C9, C12; D54–D61): the ladder, crossings recorded by
-- beers_20_milestones, the replay in backfill_milestones(), and who may read them.
--
-- Fixtures are written as the table owner; a beer that must go through the app's path is
-- logged signed in with test_helpers.sign_in(), the way PostgREST does it.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  anna    uuid := gen_random_uuid();
  bjorn   uuid := gen_random_uuid();
  cecilia uuid := gen_random_uuid();   -- in two crews: her count spans both
  dag     uuid := gen_random_uuid();
  nils    uuid := gen_random_uuid();
  olle    uuid := gen_random_uuid();   -- in no crew at all
  pia     uuid := gen_random_uuid();
  rolf    uuid := gen_random_uuid();
  a uuid;                              -- Tisdagar: anna, bjorn, cecilia, dag
  b uuid;                              -- Elsewhere: cecilia, nils
  c uuid;                              -- Replay: pia, rolf
  sa uuid;
  sb uuid;
  sc uuid;
  x uuid;
  v uuid;
  rid uuid;
  e record;
  n int;
  failed boolean;
  t0 constant timestamptz := now() - interval '3 days';
  snap_before text;
  snap_after text;
begin
  insert into auth.users (id) values (anna), (bjorn), (cecilia), (dag), (nils), (olle), (pia), (rolf);
  insert into profiles (id, display_name, initials) values
    (anna, 'Anna', 'A'), (bjorn, 'Björn', 'B'), (cecilia, 'Cecilia', 'C'), (dag, 'Dag', 'D'),
    (nils, 'Nils', 'N'), (olle, 'Olle', 'O'), (pia, 'Pia', 'P'), (rolf, 'Rolf', 'R');

  insert into crews (name, created_by) values ('Tisdagar', anna) returning id into a;
  insert into crew_members (crew_id, profile_id, role) values
    (a, anna, 'captain'), (a, bjorn, 'member'), (a, cecilia, 'member'), (a, dag, 'member');
  insert into crews (name, created_by) values ('Elsewhere', nils) returning id into b;
  insert into crew_members (crew_id, profile_id, role) values (b, nils, 'captain'), (b, cecilia, 'member');
  insert into crews (name, created_by) values ('Replay', pia) returning id into c;
  insert into crew_members (crew_id, profile_id, role) values (c, pia, 'captain'), (c, rolf, 'member');

  insert into sessions (crew_id, created_by) values (a, anna) returning id into sa;
  insert into session_attendees (session_id, profile_id) values (sa, anna), (sa, bjorn), (sa, cecilia), (sa, dag);
  insert into sessions (crew_id, created_by) values (b, nils) returning id into sb;
  insert into session_attendees (session_id, profile_id) values (sb, nils), (sb, cecilia);

  -- ── 1. The ladder ───────────────────────────────────────────
  if (select array_agg(threshold order by threshold) from milestones
       where kind = 'rung' and 'crew' = any (scopes))
     is distinct from array[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]::bigint[] then
    raise exception 'TEST FAIL: the crew ladder is not 10 … 100.000';
  end if;
  if (select array_agg(threshold order by threshold) from milestones
       where kind = 'rung' and 'global' = any (scopes))
     is distinct from array[1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]::bigint[] then
    raise exception 'TEST FAIL: the global ladder is not 1.000 … 1.000.000';
  end if;
  if (select array_agg(threshold order by threshold) from milestones
       where kind = 'rung' and 'profile' = any (scopes))
     is distinct from array[50, 100, 250, 500, 1000]::bigint[] then
    raise exception 'TEST FAIL: the personal ladder is not 50 … 1.000';
  end if;
  if (select array_agg(threshold order by threshold) from milestones where kind = 'egg')
       is distinct from array[67, 69]::bigint[]
     or exists (select 1 from milestones where kind = 'egg' and scopes <> '{profile}') then
    raise exception 'TEST FAIL: the eggs are not 67 and 69, personal only';
  end if;

  -- ── 2. The 10th beer, logged from the app ───────────────────
  insert into beers (session_id, profile_id, added_by)
  select sa, bjorn, anna from generate_series(1, 9);
  if exists (select 1 from milestone_events where crew_id = a) then
    raise exception 'TEST FAIL: a rung was recorded before the 10th beer';
  end if;

  perform test_helpers.sign_in(anna);
  insert into beers (session_id, profile_id, added_by) values (sa, bjorn, anna) returning id into x;
  perform test_helpers.sign_out();

  select count(*) into n from milestone_events where scope = 'crew' and scope_id = a;
  if n <> 1 then raise exception 'TEST FAIL: the 10th beer recorded % crew rungs, not 1', n; end if;
  select * into e from milestone_events where scope = 'crew' and scope_id = a and threshold = 10;
  if e.beer_id is distinct from x then
    raise exception 'TEST FAIL: rung 10 is not credited to the 10th beer';
  end if;
  if e.profile_id <> bjorn or e.added_by <> anna then
    raise exception 'TEST FAIL: rung 10 mixed up the scorer (drinker) and the assist (tapper)';
  end if;
  if e.session_id <> sa or e.crew_id <> a or e.round_id is not null
     or e.backfilled or e.crossed_at <> now() then
    raise exception 'TEST FAIL: rung 10 has the wrong night, crew, round, flag or time';
  end if;

  -- ── 3. A round credits the row that hit the number ──────────
  insert into beers (session_id, profile_id, added_by)
  select sa, bjorn, anna from generate_series(1, 13);                    -- Tisdagar on 23
  rid := gen_random_uuid();
  insert into beers (session_id, profile_id, added_by, round_id)
  select sa, p, dag, rid from unnest(array[anna, bjorn, cecilia, dag]) with ordinality as r(p, o)
  order by o;                                                            -- 24, 25, 26, 27

  select * into e from milestone_events where scope = 'crew' and scope_id = a and threshold = 25;
  if e.beer_id is distinct from
       (select id from beers where round_id = rid order by global_seq offset 1 limit 1) then
    raise exception 'TEST FAIL: rung 25 is not credited to the round''s second row';
  end if;
  if e.profile_id <> bjorn or e.added_by <> dag or e.round_id is distinct from rid then
    raise exception 'TEST FAIL: rung 25 lost the round''s scorer, tapper or round';
  end if;

  -- ── 4. A void keeps it; landing on it again is silent ───────
  x := e.beer_id;
  update beers set voided_at = now(), voided_by = anna
   where round_id = rid and profile_id in (bjorn, cecilia, dag);         -- back to 24
  if (select total_beers from crew_stats where crew_id = a) <> 24 then
    raise exception 'TEST FAIL: fixture: Tisdagar should be back on 24';
  end if;
  insert into beers (session_id, profile_id, added_by) values (sa, anna, cecilia);   -- 25 again
  select count(*) into n from milestone_events where scope = 'crew' and scope_id = a and threshold = 25;
  if n <> 1 then raise exception 'TEST FAIL: landing on 25 again recorded it % times', n; end if;
  select * into e from milestone_events where scope = 'crew' and scope_id = a and threshold = 25;
  if e.beer_id is distinct from x or e.added_by <> dag then
    raise exception 'TEST FAIL: landing on 25 again re-attributed the Golden Goal';
  end if;

  -- ── 5. An un-void crosses too ───────────────────────────────
  insert into beers (session_id, profile_id, added_by)
  select sa, bjorn, anna from generate_series(1, 24);                    -- 49
  insert into beers (session_id, profile_id, added_by) values (sa, dag, anna) returning id into v;   -- 50
  delete from milestone_events where scope = 'crew' and scope_id = a and threshold = 50;  -- start clean
  update beers set voided_at = now(), voided_by = anna where id = v;     -- 49
  insert into beers (session_id, profile_id, added_by) values (sa, anna, anna);           -- 50 …
  delete from milestone_events where scope = 'crew' and scope_id = a and threshold = 50;  -- … forget it
  update beers set voided_at = now(), voided_by = anna
   where id = (select id from beers where session_id = sa and voided_at is null
                order by global_seq desc limit 1);                       -- 49
  update beers set voided_at = null, voided_by = null where id = v;      -- the owner un-voids: 50
  select * into e from milestone_events where scope = 'crew' and scope_id = a and threshold = 50;
  if e.beer_id is distinct from v then
    raise exception 'TEST FAIL: an un-voided beer landing on 50 was not credited';
  end if;

  -- ── 6. Eggs and scopes; 7. a person's count spans crews ────
  insert into beers (session_id, profile_id, added_by)
  select sa, cecilia, anna from generate_series(1, 30);                  -- Tisdagar 80, cecilia 30
  if exists (select 1 from milestone_events where scope = 'crew' and scope_id = a and threshold in (67, 69)) then
    raise exception 'TEST FAIL: an egg was recorded for a crew';
  end if;
  if exists (select 1 from milestone_events where scope = 'global') then
    raise exception 'TEST FAIL: a crew rung was recorded as a global one';
  end if;

  insert into beers (session_id, profile_id, added_by)
  select sb, cecilia, nils from generate_series(1, 20);                  -- Elsewhere 20, cecilia 50
  select * into e from milestone_events where scope = 'profile' and scope_id = cecilia and threshold = 50;
  if not found or e.crew_id <> b or e.session_id <> sb then
    raise exception 'TEST FAIL: cecilia''s 50th was not credited to Elsewhere, where she drank it';
  end if;

  insert into beers (session_id, profile_id, added_by)
  select sa, cecilia, anna from generate_series(1, 19);                  -- Tisdagar 99, cecilia 69
  if (select array_agg(threshold order by threshold) from milestone_events
       where scope = 'profile' and scope_id = cecilia) is distinct from array[50, 67, 69]::bigint[] then
    raise exception 'TEST FAIL: cecilia''s personal rungs are not 50, 67 and 69';
  end if;
  if exists (select 1 from milestone_events where scope = 'profile' and threshold in (10, 25)) then
    raise exception 'TEST FAIL: a crew-only rung was recorded for a person';
  end if;

  -- ── 8. The global count, up to the million ──────────────────
  update global_stats set total_beers = 998 where id = 1;
  rid := gen_random_uuid();
  insert into beers (session_id, profile_id, added_by, round_id)
  select sb, p, nils, rid from unnest(array[cecilia, nils]) with ordinality as r(p, o) order by o;
  select * into e from milestone_events where scope = 'global' and threshold = 1000;
  if not found or e.scope_id is not null
     or e.beer_id is distinct from (select id from beers where round_id = rid order by global_seq offset 1 limit 1) then
    raise exception 'TEST FAIL: global 1.000 is not the round''s second row';
  end if;

  update global_stats set total_beers = 999999 where id = 1;
  insert into beers (session_id, profile_id, added_by) values (sb, nils, cecilia) returning id into x;
  if (select beer_id from milestone_events where scope = 'global' and threshold = 1000000) is distinct from x then
    raise exception 'TEST FAIL: the millionth beer was not recorded';
  end if;
  if exists (select 1 from milestone_events where scope = 'global' and threshold between 2500 and 500000) then
    raise exception 'TEST FAIL: jumping to the million recorded the rungs it skipped';
  end if;
  perform recompute_stats();                                             -- the real totals back

  -- ── 9. A milestone never costs a beer ───────────────────────
  insert into beers (session_id, profile_id, added_by) values (sb, nils, cecilia);   -- Elsewhere 24
  if (select total_beers from crew_stats where crew_id = b) <> 24 then
    raise exception 'TEST FAIL: fixture: Elsewhere should be on 24';
  end if;
  alter table milestone_events add constraint refuse check (false) not valid;
  insert into beers (session_id, profile_id, added_by) values (sb, cecilia, nils) returning id into v;   -- 25
  alter table milestone_events drop constraint refuse;
  if (select total_beers from crew_stats where crew_id = b) <> 25 then
    raise exception 'TEST FAIL: a failing milestone cost a beer';
  end if;
  if exists (select 1 from milestone_events where scope = 'crew' and scope_id = b and threshold = 25) then
    raise exception 'TEST FAIL: fixture: the refused milestone was recorded anyway';
  end if;

  -- ── 10. Nothing born voided, nothing on the way down ────────
  insert into beers (session_id, profile_id, added_by, voided_at, voided_by)
    values (sb, nils, cecilia, now(), cecilia);                          -- still 25
  insert into beers (session_id, profile_id, added_by) values (sb, nils, cecilia) returning id into x;   -- 26
  update beers set voided_at = now(), voided_by = nils where id = x;     -- back to 25
  if exists (select 1 from milestone_events where scope = 'crew' and scope_id = b and threshold = 25) then
    raise exception 'TEST FAIL: a voided beer was credited with a rung';
  end if;

  -- ── 11. Who may read and write ──────────────────────────────
  perform test_helpers.sign_in(anna);
  if not exists (select 1 from milestone_events where scope = 'crew' and scope_id = a) then
    raise exception 'TEST FAIL: a member cannot see her crew''s rungs';
  end if;
  if exists (select 1 from milestone_events where scope = 'crew' and scope_id = b) then
    raise exception 'TEST FAIL: a member saw another crew''s rungs';
  end if;
  if (select count(*) from milestones) <> 18 then
    raise exception 'TEST FAIL: a member cannot read the ladder';
  end if;

  failed := false;
  begin insert into milestone_events (scope, threshold, profile_id, added_by, crew_id)
          values ('global', 2500, anna, anna, a);
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member wrote a milestone'; end if;
  failed := false;
  begin update milestone_events set backfilled = true where scope_id = a;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member changed a milestone'; end if;
  failed := false;
  begin delete from milestone_events where scope_id = a;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member deleted a milestone'; end if;
  failed := false;
  begin update milestones set tier = 'legendary';
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member changed the ladder'; end if;
  failed := false;
  begin perform backfill_milestones();
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member ran the backfill'; end if;

  perform test_helpers.sign_in(olle);
  if (select count(*) from milestone_events where scope = 'global') <> 2 then
    raise exception 'TEST FAIL: someone in no crew cannot see the global rungs';
  end if;
  if exists (select 1 from milestone_events where scope <> 'global') then
    raise exception 'TEST FAIL: someone in no crew saw a crew''s or a person''s rungs';
  end if;

  perform test_helpers.sign_in(nils);
  if (select count(*) from milestone_events where scope = 'profile' and scope_id = cecilia) <> 3 then
    raise exception 'TEST FAIL: a crew-mate cannot see cecilia''s personal rungs';
  end if;

  perform test_helpers.sign_out();
  perform set_config('role', 'anon', true);
  failed := false;
  begin perform 1 from milestone_events;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a signed-out visitor read milestone_events'; end if;
  failed := false;
  begin perform 1 from milestones;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a signed-out visitor read the ladder'; end if;
  perform test_helpers.sign_out();

  failed := false;
  begin delete from milestones where threshold = 10;
  exception when foreign_key_violation then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a rung with crossings could be deleted'; end if;

  -- ── 12. The replay tells the same story as the live trigger ─
  -- Replay: 120 beers a minute apart, pia drinking three in four; four of them voided ten
  -- seconds after they went in. The live trigger sees them in that order, so the replay
  -- of the same history must credit the same beers.
  insert into sessions (crew_id, created_by, started_at) values (c, pia, t0) returning id into sc;
  insert into session_attendees (session_id, profile_id) values (sc, pia), (sc, rolf);
  for n in 1 .. 120 loop
    insert into beers (session_id, profile_id, added_by, logged_at, created_at)
      values (sc, case when n % 4 = 0 then rolf else pia end, pia,
              t0 + make_interval(mins => n), t0 + make_interval(mins => n))
      returning id into x;
    if n in (9, 10, 24, 61) then
      update beers set voided_at = t0 + make_interval(mins => n, secs => 10), voided_by = rolf where id = x;
    end if;
  end loop;

  select string_agg(format('%s/%s/%s/%s', scope, scope_id, threshold, beer_id), ',' order by scope, threshold)
    into snap_before from milestone_events where crew_id = c;
  if snap_before is null
     or (select beer_id from milestone_events where scope = 'crew' and scope_id = c and threshold = 10)
        is distinct from (select id from beers where session_id = sc order by global_seq offset 11 limit 1) then
    raise exception 'TEST FAIL: fixture: Replay''s 10th live beer should be the 12th poured';
  end if;
  delete from milestone_events where crew_id = c;

  n := backfill_milestones();
  select string_agg(format('%s/%s/%s/%s', scope, scope_id, threshold, beer_id), ',' order by scope, threshold)
    into snap_after from milestone_events where crew_id = c;
  if snap_after is distinct from snap_before then
    raise exception 'TEST FAIL: the replay credited different beers than the live trigger: % vs %',
      snap_after, snap_before;
  end if;
  if exists (select 1 from milestone_events e2 join beers b2 on b2.id = e2.beer_id
              where e2.crew_id = c and (not e2.backfilled or e2.crossed_at <> b2.created_at)) then
    raise exception 'TEST FAIL: replayed rows are not flagged, or not dated by their beer';
  end if;
  select * into e from milestone_events where scope = 'crew' and scope_id = b and threshold = 25;
  if not found or not e.backfilled or e.beer_id is distinct from v then
    raise exception 'TEST FAIL: the replay did not recover the milestone a failure lost';
  end if;
  if backfill_milestones() <> 0 then
    raise exception 'TEST FAIL: a second replay found more to record';
  end if;
  -- Tisdagar's pours and voids share one timestamp, so the replay counts every pour before
  -- any void and runs past the live peak of 99: it must not invent a 100 the crew never hit
  if exists (select 1 from milestone_events me join crew_stats cs on cs.crew_id = me.scope_id
              where me.scope = 'crew' and me.backfilled and me.threshold > cs.total_beers) then
    raise exception 'TEST FAIL: the replay recorded a rung above where the count stands';
  end if;

  -- ── 13. Realtime carries crossings ──────────────────────────
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'milestone_events') then
    raise exception 'TEST FAIL: milestone_events is not in the Realtime publication';
  end if;

  raise notice 'ALL MILESTONE TESTS PASSED';
end;
$$;
