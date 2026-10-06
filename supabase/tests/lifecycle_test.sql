-- Session lifecycle tests (C10, D41): closing on time, the purge (D36), and the
-- D16 logging window for the app.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  anna    uuid := gen_random_uuid();
  bjorn   uuid := gen_random_uuid();
  cecilia uuid := gen_random_uuid();
  p uuid;                  -- Onsdagar
  q uuid;                  -- a second party, with a night that isn't due yet
  s uuid;
  s2 uuid;
  qs uuid;
  lonely uuid;
  quiet uuid;
  busy uuid;
  recent uuid;
  n int;
  t timestamptz;
  failed boolean;
  yesterday_8pm timestamptz :=
    (date_trunc('day', now() at time zone 'Europe/Stockholm') - interval '4 hours')
      at time zone 'Europe/Stockholm';
begin
  insert into auth.users (id) values (anna), (bjorn), (cecilia);
  insert into profiles (id, display_name, initials)
    values (anna, 'Anna', 'A'), (bjorn, 'Björn', 'B'), (cecilia, 'Cecilia', 'C');
  insert into parties (name, created_by) values ('Onsdagar', anna) returning id into p;
  insert into party_members (party_id, profile_id, role)
    values (p, anna, 'captain'), (p, bjorn, 'member'), (p, cecilia, 'member');

  -- ── past closing time is closed, job or no job ──────────────
  insert into sessions (party_id, created_by) values (p, anna) returning id into s;
  insert into session_attendees (session_id, profile_id) values (s, anna), (s, bjorn);
  insert into beers (session_id, profile_id, added_by) values (s, anna, anna);
  update sessions set closes_at = now() - interval '1 minute' where id = s;   -- 09:00 has been

  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by) values (s, bjorn, anna);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a beer landed after closing time'; end if;

  failed := false;
  begin
    insert into session_attendees (session_id, profile_id) values (s, cecilia);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: someone joined after closing time'; end if;

  -- ── a new night closes the stale one first ──────────────────
  -- Without this the one-open-session index would refuse the new night until
  -- the job came round.
  insert into sessions (party_id, created_by) values (p, bjorn) returning id into s2;
  select count(*) into n from sessions where id = s and status = 'closed' and closed_at = closes_at;
  if n <> 1 then raise exception 'TEST FAIL: opening a new night did not close the stale one'; end if;

  -- ── the job closes what's due, at the time it was due ───────
  insert into parties (name, created_by) values ('Elsewhere', anna) returning id into q;
  insert into party_members (party_id, profile_id, role) values (q, anna, 'captain');
  insert into sessions (party_id, created_by) values (q, anna) returning id into qs;

  update sessions set closes_at = now() - interval '3 minutes' where id = s2;
  perform close_stale_sessions();

  select count(*) into n from sessions where id = s2 and status = 'closed' and closed_at = closes_at;
  if n <> 1 then raise exception 'TEST FAIL: the job did not close an overdue night at its closing time'; end if;
  select count(*) into n from sessions where id = qs and status = 'open';
  if n <> 1 then raise exception 'TEST FAIL: the job closed a night that wasn''t due'; end if;

  -- free Elsewhere up, so the D16 checks below can only be refused by D16
  update sessions set status = 'closed', closed_at = now() where id = qs;

  -- ── the purge (D36) ─────────────────────────────────────────
  -- Closed eight days ago:  lonely  one attendee                → purged
  --                         quiet   two attendees, no beers     → kept: who showed up
  --                         busy    two attendees and a beer    → kept
  -- Closed yesterday:       recent  one attendee                → kept until a week old
  insert into sessions (party_id, created_by) values (p, anna) returning id into lonely;
  insert into session_attendees (session_id, profile_id) values (lonely, anna);
  update sessions set status = 'closed', closed_at = now() - interval '8 days' where id = lonely;

  insert into sessions (party_id, created_by) values (p, anna) returning id into quiet;
  insert into session_attendees (session_id, profile_id) values (quiet, anna), (quiet, bjorn);
  update sessions set status = 'closed', closed_at = now() - interval '8 days' where id = quiet;

  insert into sessions (party_id, created_by) values (p, anna) returning id into busy;
  insert into session_attendees (session_id, profile_id) values (busy, anna), (busy, bjorn);
  insert into beers (session_id, profile_id, added_by) values (busy, bjorn, anna);
  update sessions set status = 'closed', closed_at = now() - interval '8 days' where id = busy;

  insert into sessions (party_id, created_by) values (p, anna) returning id into recent;
  insert into session_attendees (session_id, profile_id) values (recent, anna);
  update sessions set status = 'closed', closed_at = now() - interval '1 day' where id = recent;

  if purge_lonely_sessions() <> 1 then
    raise exception 'TEST FAIL: the purge should remove exactly one session';
  end if;
  if exists (select 1 from sessions where id = lonely) then
    raise exception 'TEST FAIL: a week-old one-person session survived the purge';
  end if;
  if (select count(*) from sessions where id in (quiet, busy, recent)) <> 3 then
    raise exception 'TEST FAIL: the purge took a session it should have kept';
  end if;

  -- ── D16: the app logs today or yesterday, never the future ──
  perform test_helpers.sign_in(anna);

  -- last night, opened this morning: accepted, and still open to log into
  insert into sessions (party_id, started_at, created_by)
    values (p, yesterday_8pm, anna) returning id into s;
  select closes_at into t from sessions where id = s;
  if t <= now() then
    raise exception 'TEST FAIL: last night''s session closed on arrival, so D16 can''t work';
  end if;

  insert into session_attendees (session_id, profile_id) values (s, anna), (s, bjorn);
  insert into beers (session_id, profile_id, added_by, logged_at)
    values (s, bjorn, anna, yesterday_8pm + interval '1 hour');

  failed := false;
  begin
    insert into sessions (party_id, started_at, created_by)
      values (q, now() - interval '3 days', anna);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a session was backdated three days'; end if;

  failed := false;
  begin
    insert into sessions (party_id, started_at, created_by)
      values (q, now() + interval '1 day', anna);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a session was started tomorrow'; end if;

  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by, logged_at)
      values (s, anna, anna, yesterday_8pm - interval '1 hour');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a beer was logged before its session started'; end if;

  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by, logged_at)
      values (s, anna, anna, now() + interval '1 hour');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a beer was logged in the future'; end if;

  -- ── the jobs are scheduled, and only the database runs them ─
  failed := false;
  begin
    perform close_stale_sessions();
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a client could run the close job'; end if;

  perform test_helpers.sign_out();
  select count(*) into n from cron.job
   where jobname in ('close-stale-sessions', 'purge-lonely-sessions') and active;
  if n <> 2 then raise exception 'TEST FAIL: the lifecycle jobs are not scheduled'; end if;

  raise notice 'ALL LIFECYCLE TESTS PASSED';
end;
$$;
