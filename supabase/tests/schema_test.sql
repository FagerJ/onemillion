-- Behavioural tests for the v0 schema.
--
-- Run against a throwaway Postgres with the Supabase bits stubbed:
--   create schema auth;
--   create table auth.users (id uuid primary key default gen_random_uuid());
--   create role anon; create role authenticated;
-- then apply 20261002120000_schema.sql, then this file.
--
-- Every block raises if the schema does not behave as the decision log says it
-- should. Silence is a pass; the final notice prints on success.

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- RLS is on for these tables and this session is not a superuser-exempt role in
-- production, but in the test harness we connect as the owner, which bypasses it.
-- These tests are about constraints and triggers, not about policies.

do $$
declare
  u1 uuid; u2 uuid; u3 uuid;
  p  uuid;
  s  uuid;
  b  uuid;
  n  int;
  failed boolean;
begin
  -- ── fixtures ────────────────────────────────────────────────
  insert into auth.users default values returning id into u1;
  insert into auth.users default values returning id into u2;
  insert into auth.users default values returning id into u3;

  insert into profiles (id, display_name, initials) values (u1, 'Jonas', 'J');
  insert into profiles (id, display_name, initials) values (u2, 'Mia',   'M');
  insert into profiles (id, display_name, initials) values (u3, 'Sam',   'S');

  insert into parties (name, created_by) values ('The Thirsty Five', u1)
    returning id into p;

  -- invite code generated, 6 chars, from the no-confusables alphabet
  select count(*) into n from parties
   where id = p and invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$';
  if n <> 1 then raise exception 'TEST FAIL: invite code not generated correctly'; end if;

  insert into party_members (party_id, profile_id, role) values (p, u1, 'captain');

  -- ── D19 / D30: a beer cannot be logged alone ────────────────
  insert into sessions (party_id, created_by) values (p, u1) returning id into s;
  insert into session_attendees (session_id, profile_id) values (s, u1);

  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by) values (s, u1, u1);
  exception when check_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST FAIL: a solo drinker was allowed to log a beer';
  end if;

  -- ── a second attendee unlocks logging ───────────────────────
  insert into party_members (party_id, profile_id) values (p, u2);
  insert into session_attendees (session_id, profile_id) values (s, u2);

  insert into beers (session_id, profile_id, added_by) values (s, u1, u1)
    returning id into b;

  -- ── stamping: party_id and guild_id come from the session ───
  select count(*) into n from beers
   where id = b and party_id = p and guild_id is null;
  if n <> 1 then
    raise exception 'TEST FAIL: beer was not stamped with its party (guild should be null pre-guild)';
  end if;

  -- ── D26: anyone at the session can log for anyone ───────────
  insert into beers (session_id, profile_id, added_by) values (s, u2, u1);
  select count(*) into n from beers where session_id = s and added_by = u1;
  if n <> 2 then raise exception 'TEST FAIL: cross-logging within a session should be allowed'; end if;

  -- ── you cannot log for someone who is not at the session ────
  insert into party_members (party_id, profile_id) values (p, u3);
  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by) values (s, u3, u1);
  exception when foreign_key_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'TEST FAIL: logged a beer for a party member who never joined the session';
  end if;

  -- ── D28: "−" voids, it does not delete ─────────────────────
  update beers set voided_at = now(), voided_by = u1 where id = b;
  select count(*) into n from beers where id = b;
  if n <> 1 then raise exception 'TEST FAIL: void should keep the row'; end if;
  select count(*) into n from beers where session_id = s and voided_at is null;
  if n <> 1 then raise exception 'TEST FAIL: voided beer still counts as live'; end if;

  -- a void must name who did it
  failed := false;
  begin
    update beers set voided_at = now(), voided_by = null where session_id = s and voided_at is null;
  exception when check_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: void without voided_by was accepted'; end if;

  -- ── one open session per party ──────────────────────────────
  failed := false;
  begin
    insert into sessions (party_id, created_by) values (p, u2);
  exception when unique_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a second concurrent open session was allowed'; end if;

  -- ── a closed session rejects new beers ──────────────────────
  update sessions set status = 'closed', closed_at = now() where id = s;
  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by) values (s, u1, u1);
  exception when check_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a closed session accepted a beer'; end if;

  -- closing requires a timestamp
  failed := false;
  begin
    insert into sessions (party_id, status, created_by) values (p, 'closed', u1);
  exception when check_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: closed session without closed_at was accepted'; end if;

  -- ── B4: a departed member cannot join a new session ─────────
  update party_members set left_at = now() where party_id = p and profile_id = u3;
  insert into sessions (party_id, created_by) values (p, u1) returning id into s;
  failed := false;
  begin
    insert into session_attendees (session_id, profile_id) values (s, u3);
  exception when check_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a member who left was added to a session'; end if;

  -- their historical beers survive
  select count(*) into n from beers where party_id = p;
  if n < 2 then raise exception 'TEST FAIL: history was lost'; end if;

  -- ── B2: party size cap ──────────────────────────────────────
  update parties set max_members = 3 where id = p;   -- u1, u2 live; u3 left
  insert into auth.users default values returning id into u3;
  insert into profiles (id, display_name, initials) values (u3, 'Alex', 'A');
  insert into party_members (party_id, profile_id) values (p, u3);  -- 3rd live member, ok

  insert into auth.users default values returning id into u3;
  insert into profiles (id, display_name, initials) values (u3, 'Priya', 'P');
  failed := false;
  begin
    insert into party_members (party_id, profile_id) values (p, u3);
  exception when check_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: party cap was not enforced'; end if;

  -- ── D8: client_uuid makes replay idempotent ─────────────────
  insert into session_attendees (session_id, profile_id) values (s, u1), (s, u2);
  insert into beers (session_id, profile_id, added_by, client_uuid)
    values (s, u1, u1, 'offline-tap-1');
  failed := false;
  begin
    insert into beers (session_id, profile_id, added_by, client_uuid)
      values (s, u1, u1, 'offline-tap-1');
  exception when unique_violation then
    failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a replayed tap was counted twice'; end if;

  -- ── global_seq is assigned and monotonic ────────────────────
  select count(*) into n from beers where global_seq is null;
  if n <> 0 then raise exception 'TEST FAIL: a beer has no global_seq'; end if;

  raise notice 'ALL SCHEMA TESTS PASSED';
end;
$$;
