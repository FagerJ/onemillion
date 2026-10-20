-- Achievement tests (G1–G4; D62–D69): combos, the starter catalogue's rules, the live
-- path against the sweep, and who may see what.
--
-- Fixtures are written as the table owner, so the triggers fire but RLS doesn't apply.
-- Access checks sign in with test_helpers.sign_in(). Each case names, in a comment, the
-- break it is there to catch.

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- One statement, like the app: a + for each of p_people, or one + ROUND for all of them.
create function test_helpers.pour(p_session uuid, p_people uuid[], p_by uuid,
                                  p_round boolean default false, p_af boolean default false)
returns void language plpgsql as $$
declare rid uuid := case when p_round then gen_random_uuid() end;
begin
  insert into public.beers (session_id, profile_id, added_by, round_id, is_alcohol_free)
  select p_session, x, p_by, rid, p_af from unnest(p_people) with ordinality as u(x, o) order by o;
end; $$;

-- A night for p_crew, opened by p_by at p_at, with p_people at the table and p_driving
-- sitting out of the rounds.
create function test_helpers.night(p_crew uuid, p_by uuid, p_people uuid[],
                                   p_driving uuid[] default '{}', p_at timestamptz default now())
returns uuid language plpgsql as $$
declare s uuid;
begin
  insert into public.sessions (crew_id, created_by, started_at) values (p_crew, p_by, p_at) returning id into s;
  insert into public.session_attendees (session_id, profile_id, in_rounds)
  select s, x, not (x = any (p_driving)) from unnest(p_people) x;
  return s;
end; $$;

create function test_helpers.full_time(p_session uuid) returns void language sql as $$
  update public.sessions set status = 'closed', closed_at = now() where id = p_session;
$$;

create function test_helpers.has(p_code text, p_profile uuid) returns boolean language sql as $$
  select exists (select 1 from public.achievement_unlocks
                  where tier = 'person' and achievement_code = p_code and profile_id = p_profile) $$;
create function test_helpers.crew_has(p_code text, p_crew uuid) returns boolean language sql as $$
  select exists (select 1 from public.achievement_unlocks
                  where tier = 'crew' and achievement_code = p_code and crew_id = p_crew) $$;
create function test_helpers.unlock_of(p_code text, p_holder uuid) returns public.achievement_unlocks
language sql as $$
  select * from public.achievement_unlocks
   where achievement_code = p_code and (profile_id = p_holder or (profile_id is null and crew_id = p_holder))
$$;

do $$
declare
  anna uuid := gen_random_uuid(); bjorn uuid := gen_random_uuid(); cilla uuid := gen_random_uuid();
  dag  uuid := gen_random_uuid(); erik  uuid := gen_random_uuid();
  olle uuid := gen_random_uuid(); nils  uuid := gen_random_uuid();
  hanna uuid := gen_random_uuid(); hugo uuid := gen_random_uuid();
  hedda uuid := gen_random_uuid();   -- only at last week's night: her week off isn't over yet
  outsider uuid := gen_random_uuid();
  big uuid[] := array(select gen_random_uuid() from generate_series(1, 9));
  p uuid;   -- Onsdagar: anna, bjorn, cilla, dag, erik
  q uuid;   -- Elsewhere: olle, nils
  h uuid;   -- History: hanna, hugo, a night a week for eleven weeks
  r uuid;   -- Big table: nine members
  s uuid; s1 uuid; s3 uuid; q4 uuid;
  nights uuid[] := '{}';
  b uuid;
  u public.achievement_unlocks;
  n int;
  k int;
  failed boolean;
  def text;
  monday constant timestamptz :=
    date_trunc('week', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
begin
  insert into auth.users (id)
  select x from unnest(array[anna, bjorn, cilla, dag, erik, olle, nils, hanna, hugo, hedda, outsider] || big) x;
  insert into profiles (id, display_name, initials) values
    (anna, 'Anna', 'A'), (bjorn, 'Björn', 'B'), (cilla, 'Cilla', 'C'), (dag, 'Dag', 'D'),
    (erik, 'Erik', 'E'), (olle, 'Olle', 'O'), (nils, 'Nils', 'N'), (hanna, 'Hanna', 'H'),
    (hugo, 'Hugo', 'HU'), (hedda, 'Hedda', 'HE'), (outsider, 'Ute', 'U');
  insert into profiles (id, display_name, initials)
  select x, 'Big ' || o, 'B' || o from unnest(big) with ordinality as t(x, o);

  -- ── 16. Crew size: the invite at two, five-a-side at five ───
  insert into crews (name, created_by) values ('Onsdagar', anna) returning id into p;
  insert into crew_members (crew_id, profile_id, role) values (p, anna, 'captain');
  if test_helpers.crew_has('THE_INVITE', p) then
    raise exception 'TEST FAIL: a crew of one has the invite';
  end if;
  insert into crew_members (crew_id, profile_id) values (p, bjorn);
  if not test_helpers.crew_has('THE_INVITE', p) then   -- break: drop crew_members_30_achievements
    raise exception 'TEST FAIL: the first friend joining did not unlock the invite';
  end if;
  insert into crew_members (crew_id, profile_id) values (p, cilla), (p, dag);
  if test_helpers.crew_has('FIVE_A_SIDE', p) then
    raise exception 'TEST FAIL: four members made five-a-side';
  end if;
  insert into crew_members (crew_id, profile_id) values (p, erik);
  if not test_helpers.crew_has('FIVE_A_SIDE', p) then
    raise exception 'TEST FAIL: the fifth member did not unlock five-a-side';
  end if;
  update crew_members set left_at = now() where crew_id = p and profile_id = erik;
  update crew_members set left_at = null where crew_id = p and profile_id = erik;
  if (select count(*) from achievement_unlocks where crew_id = p and tier = 'crew'
        and achievement_code in ('THE_INVITE', 'FIVE_A_SIDE')) <> 2 then  -- break: drop the unique index
    raise exception 'TEST FAIL: leaving and rejoining unlocked the crew badges again';
  end if;

  insert into crews (name, created_by) values ('Elsewhere', olle) returning id into q;
  insert into crew_members (crew_id, profile_id, role) values (q, olle, 'captain'), (q, nils, 'member');
  insert into crews (name, created_by) values ('History', hanna) returning id into h;
  insert into crew_members (crew_id, profile_id, role) values (h, hanna, 'captain'), (h, hugo, 'member'), (h, hedda, 'member');
  insert into crews (name, created_by) values ('Big table', big[1]) returning id into r;
  insert into crew_members (crew_id, profile_id) select r, x from unnest(big) x;

  -- ── 8. A night with nobody's beer counts for nobody ─────────
  s := test_helpers.night(p, anna, array[anna, erik]);
  perform test_helpers.full_time(s);
  if test_helpers.has('DEBUT', erik) then   -- break: drop counted_nights' live-beer requirement
    raise exception 'TEST FAIL: a night without a beer gave a debut';
  end if;

  -- ── 1. Combos are the night's total across the table ────────
  s1 := test_helpers.night(p, anna, array[anna, bjorn, cilla]);
  perform test_helpers.pour(s1, array_fill(anna, array[9]), anna);
  if exists (select 1 from session_combos where session_id = s1) then
    raise exception 'TEST FAIL: nine beers made a combo';
  end if;
  perform test_helpers.pour(s1, array[anna, bjorn, cilla], cilla, true);     -- 9 → 12 in one round
  if (select count(*) from session_combos where session_id = s1) <> 1 then
    raise exception 'TEST FAIL: a round crossing 10 should write ON FIRE once';
  end if;
  if (select beer_id from session_combos where session_id = s1 and achievement_code = 'ON_FIRE')
     is distinct from (select id from beers where session_id = s1 order by global_seq offset 9 limit 1) then
    raise exception 'TEST FAIL: ON FIRE was not credited to the tenth beer';     -- break: x.n = min + 1
  end if;
  -- 5. Björn and Cilla had one beer each: the rung is the table's, not the drinker's
  if not (test_helpers.has('ON_FIRE', anna) and test_helpers.has('ON_FIRE', bjorn)
          and test_helpers.has('ON_FIRE', cilla)) then
    raise exception 'TEST FAIL: ON FIRE did not go to everyone at the table';
  end if;
  if (test_helpers.unlock_of('ON_FIRE', bjorn)).source <> 'live' then
    raise exception 'TEST FAIL: a live unlock was not marked live';
  end if;
  -- 8. a debut for everyone at a night once it holds a beer
  if not (test_helpers.has('DEBUT', anna) and test_helpers.has('DEBUT', bjorn) and test_helpers.has('DEBUT', cilla)) then
    raise exception 'TEST FAIL: the night''s first beer gave no debuts';      -- break: invert the first_beers gate
  end if;

  -- ── 2. A late arrival to an open night gets its rungs ───────
  insert into session_attendees (session_id, profile_id) values (s1, dag);
  if not test_helpers.has('ON_FIRE', dag) then    -- break: drop session_attendees_30_achievements
    raise exception 'TEST FAIL: a late arrival missed the night''s ON FIRE';
  end if;
  if not test_helpers.has('DEBUT', dag) then
    raise exception 'TEST FAIL: a late arrival missed his debut';
  end if;

  -- ── 3. A void never revokes; crossing again doesn't fire twice
  update beers set voided_at = now(), voided_by = anna
   where id in (select id from beers where session_id = s1 order by global_seq desc limit 4);   -- 8 live
  perform test_helpers.pour(s1, array[anna, bjorn, cilla], anna, true);      -- 11 again
  if not test_helpers.has('ON_FIRE', anna)
     or (select count(*) from session_combos where session_id = s1) <> 1 then
    raise exception 'TEST FAIL: a void took ON FIRE away, or crossing 10 again fired it twice';
  end if;
  perform test_helpers.full_time(s1);

  -- ── 4. A badge already held keeps the night it came from ────
  s := test_helpers.night(p, anna, array[anna, bjorn]);
  perform test_helpers.pour(s, array_fill(bjorn, array[10]), anna);
  if (select count(*) from session_combos where session_id = s) <> 1 then
    raise exception 'TEST FAIL: the second night''s ON FIRE was not recorded';
  end if;
  if (select count(*) from achievement_unlocks where achievement_code = 'ON_FIRE' and profile_id = anna) <> 1
     or (test_helpers.unlock_of('ON_FIRE', anna)).session_id <> s1 then   -- break: drop achievement_unlocks_once_person
    raise exception 'TEST FAIL: a second ON FIRE night moved or doubled Anna''s badge';
  end if;
  perform test_helpers.full_time(s);

  -- The evaluators skip what's held; the indexes are what stop two at once (D62)
  failed := false;
  begin insert into achievement_unlocks (achievement_code, tier, profile_id, unlocked_at)
          values ('ON_FIRE', 'person', anna, now());
  exception when unique_violation then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a second ON FIRE for Anna was accepted'; end if;
  failed := false;
  begin insert into achievement_unlocks (achievement_code, tier, crew_id, unlocked_at)
          values ('THE_INVITE', 'crew', p, now());
  exception when unique_violation then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a second invite for Onsdagar was accepted'; end if;
  failed := false;
  begin insert into session_combos (session_id, achievement_code, crew_id, reached_at)
          values (s1, 'ON_FIRE', p, now());
  exception when unique_violation then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a night reached ON FIRE twice'; end if;

  -- ── 11, 13. The designated driver, and the alcohol-free one ─
  s3 := test_helpers.night(p, anna, array[anna, bjorn, cilla, dag, erik], array[dag, erik]);
  perform test_helpers.pour(s3, array[anna, anna, bjorn], anna);
  perform test_helpers.pour(s3, array[dag], dag, false, true);               -- a 0,0
  perform test_helpers.pour(s3, array[erik], erik);                          -- driving, but a lager
  if not test_helpers.has('CLEAR_HEAD', dag) then     -- break: drop the alcohol-free call in the beers trigger
    raise exception 'TEST FAIL: an alcohol-free beer did not unlock Clear Head';
  end if;
  if test_helpers.has('DESIGNATED_DRIVER', dag) then
    raise exception 'TEST FAIL: the driver was decided before full time';
  end if;
  perform test_helpers.full_time(s3);
  if not test_helpers.has('DESIGNATED_DRIVER', dag) then   -- break: drop sessions_30_achievements
    raise exception 'TEST FAIL: Dag drove the night and got nothing';
  end if;
  if test_helpers.has('DESIGNATED_DRIVER', erik) then      -- break: drop "not b.is_alcohol_free"
    raise exception 'TEST FAIL: Erik had a lager and still counted as the driver';
  end if;
  if test_helpers.has('DESIGNATED_DRIVER', cilla) then     -- break: drop "not sa.in_rounds"
    raise exception 'TEST FAIL: Cilla was in the rounds and counted as the driver';
  end if;

  -- ── 12. A closed night's table is frozen (D69) ──────────────
  perform test_helpers.sign_in(bjorn);
  with changed as (
    update session_attendees set in_rounds = false
     where session_id = s3 and profile_id = bjorn returning 1)
  select count(*) into n from changed;
  perform test_helpers.sign_out();
  if n <> 0 then raise exception 'TEST FAIL: the driver could still be changed after full time'; end if;

  -- ── 14. Rounds poured: ten rounds of two or more ────────────
  s := test_helpers.night(p, anna, array[anna, bjorn]);
  for k in 1 .. 9 loop
    perform test_helpers.pour(s, array[anna, bjorn], bjorn, true);
  end loop;
  perform test_helpers.pour(s, array[anna], bjorn, true);                    -- a round of one is a +
  if test_helpers.has('GET_THE_DRINKS_IN', bjorn) then   -- break: drop "having count(*) >= 2"
    raise exception 'TEST FAIL: nine rounds and a single counted as ten';
  end if;
  perform test_helpers.pour(s, array[anna, bjorn], bjorn, true);
  if (test_helpers.unlock_of('GET_THE_DRINKS_IN', bjorn)).beer_id is distinct from
       (select id from beers where session_id = s and added_by = bjorn order by global_seq desc offset 1 limit 1) then
    raise exception 'TEST FAIL: the tenth round was not credited to its first beer';
  end if;
  perform test_helpers.full_time(s);

  -- ── 6. 25, 50 and 100 in one night; the whole ladder ───────
  s := test_helpers.night(q, olle, array[olle, nils]);
  perform test_helpers.pour(s, array_fill(olle, array[100]), olle);
  if (select count(*) from session_combos where session_id = s) <> 4 then
    raise exception 'TEST FAIL: a hundred in one statement should reach all four rungs';
  end if;
  if (select beer_id from session_combos where session_id = s and achievement_code = 'WORLDIE')
     is distinct from (select id from beers where session_id = s order by global_seq offset 49 limit 1) then
    raise exception 'TEST FAIL: WORLDIE was not credited to the fiftieth beer';
  end if;
  if not (test_helpers.has('RAMPAGE', nils) and test_helpers.has('BOOMSHAKALAKA', nils)) then
    raise exception 'TEST FAIL: Nils had nothing and still should hold the night''s rungs';
  end if;
  if not test_helpers.crew_has('ALL_FOUR_RUNGS', q) then   -- break: drop the award_combo_rungs call
    raise exception 'TEST FAIL: a crew that reached every rung did not get the full set';
  end if;
  if test_helpers.crew_has('ALL_FOUR_RUNGS', p) then
    raise exception 'TEST FAIL: a crew with only ON FIRE got the full set';
  end if;
  perform test_helpers.full_time(s);

  -- ── 7. 67 and 69 by counter-crossing, counting live beers ───
  s := test_helpers.night(q, olle, array[olle, nils]);
  perform test_helpers.pour(s, array_fill(nils, array[65]), nils);
  update beers set voided_at = now(), voided_by = nils
   where id = (select id from beers where session_id = s order by global_seq limit 1);   -- 64 live
  perform test_helpers.pour(s, array[nils], nils);
  perform test_helpers.pour(s, array[nils], nils);
  if test_helpers.has('SIX_SEVEN', nils) then              -- break: drop "voided_at is null" in the ranking
    raise exception 'TEST FAIL: 66 live beers made 67';
  end if;
  perform test_helpers.pour(s, array[nils], nils) ;
  if (test_helpers.unlock_of('SIX_SEVEN', nils)).beer_id
       is distinct from (select id from beers where session_id = s order by global_seq desc limit 1) then
    raise exception 'TEST FAIL: SIX_SEVEN was not credited to the beer that made 67 live';
  end if;
  perform test_helpers.pour(s, array[nils, nils], nils);
  if (test_helpers.unlock_of('NICE', nils)).beer_id
       is distinct from (select id from beers where session_id = s order by global_seq desc limit 1) then
    raise exception 'TEST FAIL: NICE was not credited to the 69th';
  end if;
  perform test_helpers.full_time(s);

  -- ── 11. A night where only the driver had a beer counts for nobody
  s := test_helpers.night(q, olle, array[olle, nils], array[nils]);
  perform test_helpers.pour(s, array[nils], nils, false, true);
  perform test_helpers.full_time(s);
  if (select count(*) from achievement_unlocks where achievement_code = 'DESIGNATED_DRIVER' and profile_id = nils) <> 0 then
    raise exception 'TEST FAIL: driving a night where nobody else drank counted';   -- break: drop the other-beer check
  end if;

  -- ── 17. Eight at a table; the full house ────────────────────
  s := test_helpers.night(r, big[1], big[1:8]);
  perform test_helpers.pour(s, array[big[1]], big[1]);
  if not test_helpers.crew_has('TABLE_FOR_EIGHT', r) then
    raise exception 'TEST FAIL: eight at a night with a beer is not a table for eight';
  end if;
  if test_helpers.crew_has('FULL_HOUSE', r) then             -- break: present >= squad - 1
    raise exception 'TEST FAIL: eight of nine is not a full house';
  end if;
  insert into session_attendees (session_id, profile_id) values (s, big[9]);
  if not test_helpers.crew_has('FULL_HOUSE', r) then
    raise exception 'TEST FAIL: the ninth sitting down did not make a full house';
  end if;
  perform test_helpers.full_time(s);
  if test_helpers.crew_has('FULL_HOUSE', q) then             -- break: drop "squad >= min_members"
    raise exception 'TEST FAIL: a crew of two all present counted as a full house';
  end if;

  -- ── 9, 10. A night a week for eleven weeks; week −6's beers voided
  foreach k in array array[-11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1] loop
    s := test_helpers.night(h, hanna, case when k = -1 then array[hanna, hugo, hedda] else array[hanna, hugo] end,
                            '{}', monday + make_interval(days => 7 * k + 1, hours => 19));
    nights := nights || s;
    perform test_helpers.pour(s, array[hanna, hugo], hanna);
    if k = -6 then
      update beers set voided_at = now(), voided_by = hanna where session_id = s;
    end if;
    perform test_helpers.full_time(s);
  end loop;
  -- nights[1] is week −11 … nights[11] is week −1
  if (test_helpers.unlock_of('REGULAR', hanna)).session_id is distinct from nights[11] then
    raise exception 'TEST FAIL: Regular should land on the tenth counted night (week −1)';   -- break: count every attended night
  end if;
  if (test_helpers.unlock_of('ON_A_RUN', hugo)).session_id is distinct from nights[3] then
    raise exception 'TEST FAIL: On a Run should land on the third week running (week −9)';   -- break: * 7 → * 1
  end if;
  if test_helpers.has('FORM_OF_YOUR_LIFE', hanna) then
    raise exception 'TEST FAIL: a voided week did not break the run';
  end if;
  if (test_helpers.unlock_of('BACK_TO_BACK', h)).session_id is distinct from nights[2]
     or (test_helpers.unlock_of('MONTH_OF_FIXTURES', h)).session_id is distinct from nights[4] then
    raise exception 'TEST FAIL: the crew''s streak badges landed on the wrong weeks';      -- break: k >= min
  end if;

  -- ── 15. A week off is only noticed by the sweep ─────────────
  if test_helpers.has('CLEAN_SHEET', hanna) then
    raise exception 'TEST FAIL: a week off was decided live';
  end if;

  -- ── 18. The live path and the sweep agree ───────────────────
  n := sweep_achievements();
  if exists (select 1 from achievement_unlocks where source = 'sweep' and achievement_code <> 'CLEAN_SHEET') then
    raise exception 'TEST FAIL: the sweep found unlocks the live path missed: %',
      (select string_agg(distinct achievement_code, ', ') from achievement_unlocks
        where source = 'sweep' and achievement_code <> 'CLEAN_SHEET');
  end if;
  if n <> (select count(*) from achievement_unlocks where source = 'sweep') then
    raise exception 'TEST FAIL: the sweep miscounted what it wrote';
  end if;
  u := test_helpers.unlock_of('CLEAN_SHEET', hanna);
  if u.id is null or u.source <> 'sweep'
     or u.unlocked_at <> monday - interval '5 weeks' then   -- break: w.week + 14 → + 7
    raise exception 'TEST FAIL: Hanna''s week off should be credited on the Monday of week −5, got %', u.unlocked_at;
  end if;
  if test_helpers.has('CLEAN_SHEET', cilla) then          -- break: drop the empty-week "not exists"
    raise exception 'TEST FAIL: someone out this week got a week off';
  end if;
  if test_helpers.has('CLEAN_SHEET', hedda) then          -- break: w.week + 14 → + 7
    raise exception 'TEST FAIL: a week that isn''t over yet counted as a week off';
  end if;
  if sweep_achievements() <> 0 then raise exception 'TEST FAIL: the sweep is not idempotent'; end if;

  create temp table live_set on commit drop as
    select achievement_code, tier, coalesce(profile_id, crew_id) as holder, session_id
    from achievement_unlocks;
  delete from achievement_unlocks;
  delete from session_combos;
  perform sweep_achievements('backfill');
  if exists (select achievement_code, tier, coalesce(profile_id, crew_id), session_id from achievement_unlocks
             except select * from live_set)
     or exists (select * from live_set
                except select achievement_code, tier, coalesce(profile_id, crew_id), session_id
                from achievement_unlocks) then
    raise exception 'TEST FAIL: the backfill and the live path disagree. Backfill only: %. Live only: %',
      (select string_agg(format('%s/%s/%s', achievement_code, holder, session_id), ', ')
         from (select achievement_code, tier, coalesce(profile_id, crew_id) as holder, session_id from achievement_unlocks
               except select * from live_set) x),
      (select string_agg(format('%s/%s/%s', achievement_code, holder, session_id), ', ')
         from (select * from live_set
               except select achievement_code, tier, coalesce(profile_id, crew_id), session_id from achievement_unlocks) y);
  end if;

  -- ── 19. A beer born voided evaluates nobody, not everyone ───
  delete from achievement_unlocks where achievement_code = 'SIX_SEVEN' and profile_id = nils;
  q4 := test_helpers.night(q, olle, array[olle, nils]);
  insert into beers (session_id, profile_id, added_by, voided_at, voided_by)
    values (q4, olle, olle, now(), olle);
  if test_helpers.has('SIX_SEVEN', nils) then              -- break: drop coalesce(…, '{}') in the trigger
    raise exception 'TEST FAIL: a born-voided beer re-evaluated everyone';
  end if;

  -- ── 20. The rule vocabulary is closed ───────────────────────
  failed := false;
  begin
    insert into achievements (code, tier, category, title, description, points, sort, rule)
      values ('BAD_ONE', 'person', 'combo', 'Bad', 'Bad', 1, 9999, '{"type":"person_session_total","min":10}');
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'TEST FAIL: an unknown rule type was accepted'; end if;
  failed := false;
  begin
    insert into achievements (code, tier, category, title, description, points, sort, rule)
      values ('BAD_TWO', 'person', 'showing_up', 'Bad', 'Bad', 1, 9999, '{"type":"nights"}');
  exception when check_violation then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a rule without its threshold was accepted'; end if;

  -- ── 21. A badge never costs a beer ──────────────────────────
  def := pg_get_functiondef('public.award_session_total(uuid[], text)'::regprocedure);
  execute $f$create or replace function public.award_session_total(p_sessions uuid[], p_source text)
    returns void language plpgsql security definer set search_path = '' as
    $b$begin raise exception 'boom'; end;$b$ $f$;
  select total_beers into n from crew_stats where crew_id = q;
  perform test_helpers.pour(q4, array[nils], olle);                         -- break: drop the exception block
  if (select total_beers from crew_stats where crew_id = q) <> n + 1 then
    raise exception 'TEST FAIL: a failing evaluator cost a beer';
  end if;
  execute def;

  -- ── 22. Who sees what ───────────────────────────────────────
  perform test_helpers.sign_in(outsider);
  if exists (select 1 from achievement_unlocks) or exists (select 1 from session_combos) then
    raise exception 'TEST FAIL: someone in no crew saw unlocks or combos';  -- break: policy using (true)
  end if;
  if (select title from achievement_catalogue() where code = 'NICE') is not null then
    raise exception 'TEST FAIL: a secret''s title showed to someone who can''t see it held';
  end if;
  if exists (select 1 from profile_achievement_progress(anna)) then
    raise exception 'TEST FAIL: an outsider read Anna''s progress';
  end if;
  perform test_helpers.sign_in(anna);
  if (select title from achievement_catalogue() where code = 'NICE') is not null then
    raise exception 'TEST FAIL: NICE showed to Anna, whose crew-mates don''t hold it';
  end if;
  if not exists (select 1 from profile_achievement_progress(anna)) then
    raise exception 'TEST FAIL: Anna cannot read her own progress';
  end if;
  if exists (select 1 from achievement_unlocks where profile_id = olle) then
    raise exception 'TEST FAIL: Anna saw the unlocks of someone outside her crews';
  end if;
  perform test_helpers.sign_in(nils);
  if (select title from achievement_catalogue() where code = 'NICE') is distinct from 'hehehe' then
    raise exception 'TEST FAIL: a crew-mate holding NICE did not reveal it';  -- break: always mask
  end if;
  if not exists (select 1 from achievement_unlocks where profile_id = olle) then
    raise exception 'TEST FAIL: Nils cannot see his crew-mate''s unlocks';
  end if;

  failed := false;
  begin insert into achievement_unlocks (achievement_code, tier, profile_id, unlocked_at)
          values ('DEBUT', 'person', nils, now());
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member wrote an unlock'; end if;
  failed := false;
  begin update achievement_unlocks set unlocked_at = now() where profile_id = nils;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member changed an unlock'; end if;
  failed := false;
  begin delete from achievement_unlocks where profile_id = nils;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member deleted an unlock'; end if;
  failed := false;
  begin perform 1 from achievements;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member read the catalogue table directly'; end if;
  failed := false;
  begin perform 1 from counted_nights;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member read counted_nights'; end if;
  failed := false;
  begin perform sweep_achievements();
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member ran the sweep'; end if;   -- break: skip a revoke
  failed := false;
  begin perform award_nights(array[nils], 'live');
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a member called an evaluator'; end if;

  perform test_helpers.sign_out();
  perform set_config('role', 'anon', true);
  failed := false;
  begin perform 1 from achievement_catalogue();
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'TEST FAIL: a signed-out visitor read the catalogue'; end if;
  perform test_helpers.sign_out();

  -- ── Realtime carries combos and unlocks ─────────────────────
  if (select count(*) from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename in ('session_combos', 'achievement_unlocks')) <> 2 then
    raise exception 'TEST FAIL: combos or unlocks are not in the Realtime publication';
  end if;

  raise notice 'ALL ACHIEVEMENT TESTS PASSED';
end;
$$;
