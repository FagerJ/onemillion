-- Offline replay tests (C8, D72, D74): a replayed tap or void changes nothing, a tap from
-- before the end of a night still lands for a day after it closed, and nothing tapped
-- after the end does. Signed in as real users, the way the queue's requests arrive:
-- `insert … on conflict (client_uuid) do nothing` is what PostgREST runs for supabase-js's
-- upsert(…, { onConflict: 'client_uuid', ignoreDuplicates: true }).
--
-- One transaction, so now() is the same instant throughout: "ten minutes before the
-- whistle" is now() - 10 minutes, and a beer stamped now() is at the whistle itself.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  anna    uuid := gen_random_uuid();
  bjorn   uuid := gen_random_uuid();
  cecilia uuid := gen_random_uuid();     -- in the crew, never at the table
  crew uuid;
  s    uuid;                             -- closed by the whistle partway through
  s2   uuid;                             -- past 09:00, not yet closed by the job
  tap  uuid := gen_random_uuid();
  kept uuid := gen_random_uuid();
  late uuid := gen_random_uuid();
  more uuid := gen_random_uuid();
  n int;
  g0 bigint;
  g1 bigint;
  v timestamptz;
  h text;
  failed boolean;
begin
  insert into auth.users (id) values (anna), (bjorn), (cecilia);
  insert into profiles (id, display_name, initials)
    values (anna, 'Anna', 'A'), (bjorn, 'Björn', 'B'), (cecilia, 'Cecilia', 'C');
  insert into crews (name, created_by) values ('Onsdagar', anna) returning id into crew;
  insert into crew_members (crew_id, profile_id, role)
    values (crew, anna, 'captain'), (crew, bjorn, 'member'), (crew, cecilia, 'member');

  perform test_helpers.sign_in(anna);
  insert into public.sessions (crew_id, started_at, created_by)
    values (crew, now() - interval '3 hours', anna) returning id into s;
  insert into public.session_attendees (session_id, profile_id) values (s, anna), (s, bjorn);

  -- ── a replayed tap is a no-op (D8, D72) ─────────────────────
  insert into public.beers (id, client_uuid, session_id, profile_id, added_by)
    values (tap, tap::text, s, bjorn, anna)
    on conflict (client_uuid) do nothing;
  select total_beers into g0 from public.global_stats where id = 1;

  -- the answer was lost, so the phone sends it again — now carrying the tap's own time
  insert into public.beers (id, client_uuid, session_id, profile_id, added_by, logged_at)
    values (tap, tap::text, s, bjorn, anna, now() - interval '20 seconds')
    on conflict (client_uuid) do nothing;
  select count(*) into n from public.beers where client_uuid = tap::text;
  if n <> 1 then raise exception 'TEST FAIL: a replayed tap was counted twice'; end if;
  select total_beers into g1 from public.global_stats where id = 1;
  if g1 <> g0 then raise exception 'TEST FAIL: a replayed tap moved the global counter'; end if;
  select count(*) into n from public.beers where id = tap and client_uuid = tap::text;
  if n <> 1 then raise exception 'TEST FAIL: the beer did not keep the id the phone gave it'; end if;

  -- a batch after a lost answer: the old row is skipped, the new one goes in
  insert into public.beers (id, client_uuid, session_id, profile_id, added_by)
    values (tap, tap::text, s, bjorn, anna), (more, more::text, s, anna, anna)
    on conflict (client_uuid) do nothing;
  select count(*) into n from public.beers where id in (tap, more);
  if n <> 2 then raise exception 'TEST FAIL: a batch with a replay in it lost its new tap'; end if;

  -- ── a replayed void is a no-op ──────────────────────────────
  update public.beers set voided_at = now() - interval '30 seconds', voided_by = anna
   where id = tap and voided_at is null;
  select voided_at into v from public.beers where id = tap;
  if v is distinct from now() - interval '30 seconds' then
    raise exception 'TEST FAIL: a void queued offline lost the time it was tapped';
  end if;
  select total_beers into g0 from public.global_stats where id = 1;
  -- sent again, without the voided_at filter the queue adds: the policy alone must hold
  update public.beers set voided_at = now(), voided_by = anna where id = tap;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAIL: a replayed void touched a voided beer'; end if;
  if (select voided_at from public.beers where id = tap) is distinct from v then
    raise exception 'TEST FAIL: a replayed void moved voided_at';
  end if;
  select total_beers into g1 from public.global_stats where id = 1;
  if g1 <> g0 then raise exception 'TEST FAIL: a replayed void moved the counter'; end if;

  -- ── the whistle, with taps still on a phone (D74) ───────────
  insert into public.beers (id, client_uuid, session_id, profile_id, added_by, logged_at)
    values (kept, kept::text, s, anna, anna, now() - interval '20 minutes');
  perform public.close_session(s);                          -- closed_at = now()

  select total_beers into g0 from public.global_stats where id = 1;
  insert into public.beers (id, client_uuid, session_id, profile_id, added_by, logged_at)
    values (late, late::text, s, bjorn, anna, now() - interval '10 minutes')
    on conflict (client_uuid) do nothing;
  select count(*) into n from public.beers where id = late and crew_id = crew;
  if n <> 1 then raise exception 'TEST FAIL: a tap from before full time was refused after it'; end if;
  select total_beers into g1 from public.global_stats where id = 1;
  if g1 <> g0 + 1 then raise exception 'TEST FAIL: a late tap did not count'; end if;

  -- a lost-answer replay from before the whistle, arriving after it: still a no-op
  insert into public.beers (id, client_uuid, session_id, profile_id, added_by, logged_at)
    values (kept, kept::text, s, anna, anna, now() - interval '20 minutes')
    on conflict (client_uuid) do nothing;
  select count(*) into n from public.beers where client_uuid = kept::text;
  if n <> 1 then raise exception 'TEST FAIL: a replay after full time was counted twice'; end if;

  -- a tap after the whistle is refused, and says why
  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by, client_uuid)
      values (s, bjorn, anna, gen_random_uuid()::text)
      on conflict (client_uuid) do nothing;
  exception when check_violation then
    failed := true;
    get stacked diagnostics h = pg_exception_hint;
  end;
  if not failed then raise exception 'TEST FAIL: a tap from after full time went in'; end if;
  if h is distinct from 'session_closed' then
    raise exception 'TEST FAIL: a closed night refused a tap without saying so (hint %)', h;
  end if;

  -- late, but still only for someone who was at the table
  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by, logged_at)
      values (s, cecilia, anna, now() - interval '5 minutes');
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a late tap went in for someone not at the table'; end if;

  -- and the night stays shut to newcomers
  failed := false;
  begin
    insert into public.session_attendees (session_id, profile_id) values (s, cecilia);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: someone joined a night after full time'; end if;

  -- ── a day after the end, the night is settled ───────────────
  perform test_helpers.sign_out();
  update sessions set started_at = now() - interval '30 hours',
                      closed_at  = now() - interval '25 hours' where id = s;
  perform test_helpers.sign_in(anna);
  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by, logged_at)
      values (s, bjorn, anna, now() - interval '26 hours');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a tap landed more than a day after its night ended'; end if;

  -- ── past 09:00 before the job: 09:00 is the end ─────────────
  insert into public.sessions (crew_id, started_at, created_by)
    values (crew, now() - interval '2 hours', anna) returning id into s2;
  insert into public.session_attendees (session_id, profile_id) values (s2, anna), (s2, bjorn);
  perform test_helpers.sign_out();
  update sessions set closes_at = now() - interval '1 minute' where id = s2;
  perform test_helpers.sign_in(anna);

  insert into public.beers (session_id, profile_id, added_by, logged_at)
    values (s2, bjorn, anna, now() - interval '5 minutes');           -- before 09:00: in

  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by, logged_at)
      values (s2, bjorn, anna, now() - interval '30 seconds');        -- after 09:00
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a tap from after 09:00 went into an unclosed night'; end if;

  -- ── a whistle after 09:00 doesn't stretch the night ─────────
  perform public.close_session(s2);                                  -- closed_at = now() > closes_at
  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by, logged_at)
      values (s2, anna, anna, now() - interval '30 seconds');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a tap between 09:00 and a late whistle went in'; end if;

  perform test_helpers.sign_out();
  raise notice 'ALL REPLAY TESTS PASSED';
end;
$$;
