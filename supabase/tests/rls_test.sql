-- Row level security tests — every assertion runs as a signed-in user.
--
-- schema_test.sql connects as the table owner, which RLS exempts, so it proves
-- nothing about access. Here each step switches to the `authenticated` role with a
-- JWT `sub` claim, which is exactly what PostgREST does for a request from the app.
--
-- Run by ./supabase/tests/run-supabase.sh inside begin … rollback, so the helper
-- schema below disappears with everything else.

\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema test_helpers;

create function test_helpers.sign_in(u uuid) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function test_helpers.sign_out() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant usage on schema test_helpers to authenticated, anon;
grant execute on all functions in schema test_helpers to authenticated, anon;

do $$
declare
  anna    uuid := gen_random_uuid();   -- founds Onsdagar
  bjorn   uuid := gen_random_uuid();
  cecilia uuid := gen_random_uuid();
  olle    uuid := gen_random_uuid();   -- outsider: founds another party
  nils    uuid := gen_random_uuid();   -- joins Olle's party
  dag     uuid := gen_random_uuid();   -- joins Onsdagar late, stays home
  onsdagar public.parties;
  other    public.parties;
  s uuid;
  b uuid;
  n int;
  t text;
  failed boolean;
begin
  insert into auth.users (id) values (anna), (bjorn), (cecilia), (olle), (nils), (dag);

  -- ── profiles: you create your own, and only your own ────────
  perform test_helpers.sign_in(anna);
  insert into public.profiles (id, display_name, initials) values (anna, 'Anna', 'A');

  failed := false;
  begin
    insert into public.profiles (id, display_name, initials) values (bjorn, 'Fake Björn', 'FB');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: created a profile for someone else'; end if;

  perform test_helpers.sign_in(bjorn);
  insert into public.profiles (id, display_name, initials) values (bjorn, 'Björn', 'B');
  perform test_helpers.sign_in(cecilia);
  insert into public.profiles (id, display_name, initials) values (cecilia, 'Cecilia', 'C');
  perform test_helpers.sign_in(olle);
  insert into public.profiles (id, display_name, initials) values (olle, 'Olle', 'O');
  perform test_helpers.sign_in(nils);
  insert into public.profiles (id, display_name, initials) values (nils, 'Nils', 'N');
  perform test_helpers.sign_in(dag);
  insert into public.profiles (id, display_name, initials) values (dag, 'Dag', 'D');

  -- ── parties are created and joined through functions ────────
  perform test_helpers.sign_in(anna);
  select * into onsdagar from public.create_party('Onsdagar');

  perform test_helpers.sign_in(bjorn);
  perform public.join_party(lower(onsdagar.invite_code));   -- codes are case-insensitive
  perform test_helpers.sign_in(cecilia);
  perform public.join_party(onsdagar.invite_code);

  perform test_helpers.sign_in(olle);
  select * into other from public.create_party('Somewhere Else');
  perform test_helpers.sign_in(nils);
  perform public.join_party(other.invite_code);

  failed := false;
  begin
    insert into public.party_members (party_id, profile_id, role)
      values (onsdagar.id, nils, 'captain');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a client wrote party_members directly'; end if;

  -- ── you see your own party, nobody else's ───────────────────
  perform test_helpers.sign_in(olle);
  select count(*) into n from public.parties where id = onsdagar.id;
  if n <> 0 then raise exception 'TEST FAIL: an outsider can see Onsdagar'; end if;
  select count(*) into n from public.party_members where party_id = onsdagar.id;
  if n <> 0 then raise exception 'TEST FAIL: an outsider can see who is in Onsdagar'; end if;
  select count(*) into n from public.profiles where id = anna;
  if n <> 0 then raise exception 'TEST FAIL: an outsider can see Anna''s profile'; end if;

  perform test_helpers.sign_in(bjorn);
  select count(*) into n from public.parties;
  if n <> 1 then raise exception 'TEST FAIL: Björn should see exactly one party, saw %', n; end if;
  select count(*) into n from public.party_members where party_id = onsdagar.id;
  if n <> 3 then raise exception 'TEST FAIL: a member should see all 3 members, saw %', n; end if;
  select count(*) into n from public.profiles where id in (anna, bjorn, cecilia);
  if n <> 3 then raise exception 'TEST FAIL: a member should see party-mates'' profiles, saw %', n; end if;

  -- ── a night out ─────────────────────────────────────────────
  perform test_helpers.sign_in(anna);
  insert into public.sessions (party_id, created_by) values (onsdagar.id, anna) returning id into s;
  insert into public.session_attendees (session_id, profile_id) values (s, anna);
  insert into public.session_attendees (session_id, profile_id) values (s, bjorn);
  insert into public.beers (session_id, profile_id, added_by) values (s, bjorn, anna)
    returning id into b;   -- D26: logging for a friend

  -- an outsider can't start a session in someone else's party...
  perform test_helpers.sign_in(olle);
  failed := false;
  begin
    insert into public.sessions (party_id, created_by) values (onsdagar.id, olle);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: an outsider started a session in Onsdagar'; end if;

  -- ...join it, log in it, or even see it
  failed := false;
  begin
    insert into public.session_attendees (session_id, profile_id) values (s, olle);
  exception when check_violation or insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: an outsider joined Onsdagar''s session'; end if;

  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by) values (s, olle, olle);
  exception when check_violation or insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: an outsider logged a beer in Onsdagar'; end if;

  select count(*) into n from public.sessions where id = s;
  if n <> 0 then raise exception 'TEST FAIL: an outsider can see Onsdagar''s session'; end if;
  select count(*) into n from public.beers where session_id = s;
  if n <> 0 then raise exception 'TEST FAIL: an outsider can see Onsdagar''s beers'; end if;

  perform test_helpers.sign_in(dag);
  perform public.join_party(onsdagar.invite_code);

  -- a party member who isn't at the table can watch the tally, but not log
  perform test_helpers.sign_in(cecilia);
  select count(*) into n from public.beers where session_id = s;
  if n <> 1 then raise exception 'TEST FAIL: a party member should see the live tally'; end if;

  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by) values (s, bjorn, cecilia);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: someone not at the session logged a beer'; end if;

  -- ...or void one
  update public.beers set voided_at = now(), voided_by = cecilia where id = b;
  select count(*) into n from public.beers where id = b and voided_at is null;
  if n <> 1 then raise exception 'TEST FAIL: someone not at the session voided a beer'; end if;

  -- ...or put other people at the table
  failed := false;
  begin
    insert into public.session_attendees (session_id, profile_id) values (s, dag);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: someone not at the session added a party-mate to it'; end if;

  -- ...until she checks herself in
  insert into public.session_attendees (session_id, profile_id) values (s, cecilia);
  insert into public.beers (session_id, profile_id, added_by) values (s, cecilia, cecilia);

  -- nobody logs in someone else's name
  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by) values (s, cecilia, anna);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: logged a beer with a forged added_by'; end if;

  -- or picks their own place in the global sequence
  failed := false;
  begin
    insert into public.beers (session_id, profile_id, added_by, global_seq)
      values (s, cecilia, cecilia, 1000000);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a client chose its own global_seq'; end if;

  -- ── "−" voids: by an attendee, in their own name, once ──────
  perform test_helpers.sign_in(bjorn);
  update public.beers set voided_at = now(), voided_by = bjorn where id = b;
  select count(*) into n from public.beers where id = b and voided_by = bjorn;
  if n <> 1 then raise exception 'TEST FAIL: an attendee could not void a beer'; end if;

  update public.beers set voided_at = null, voided_by = null where id = b;
  select count(*) into n from public.beers where id = b and voided_at is not null;
  if n <> 1 then raise exception 'TEST FAIL: a void was undone'; end if;

  select id into b from public.beers
   where session_id = s and profile_id = cecilia and voided_at is null;

  failed := false;
  begin
    update public.beers set voided_at = now(), voided_by = anna where id = b;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: voided a beer in someone else''s name'; end if;

  failed := false;
  begin
    update public.beers set profile_id = bjorn where id = b;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: reassigned a beer to someone else'; end if;

  -- an outsider's void silently matches nothing
  perform test_helpers.sign_in(olle);
  update public.beers set voided_at = now(), voided_by = olle where id = b;

  -- and after 24 hours a beer is settled (D16)
  perform test_helpers.sign_out();
  select count(*) into n from public.beers where id = b and voided_at is null;
  if n <> 1 then raise exception 'TEST FAIL: an outsider voided a beer'; end if;
  update public.beers set logged_at = now() - interval '25 hours' where id = b;

  perform test_helpers.sign_in(anna);
  update public.beers set voided_at = now(), voided_by = anna where id = b;

  perform test_helpers.sign_out();
  select count(*) into n from public.beers where id = b and voided_at is null;
  if n <> 1 then raise exception 'TEST FAIL: a beer older than 24 hours was voided'; end if;
  update public.beers set logged_at = now() where id = b;

  -- ── captains (B4) ───────────────────────────────────────────
  perform test_helpers.sign_in(bjorn);
  update public.parties set name = 'Björns gäng' where id = onsdagar.id;
  select name into t from public.parties where id = onsdagar.id;
  if t <> 'Onsdagar' then raise exception 'TEST FAIL: a member renamed the party'; end if;

  failed := false;
  begin
    perform public.promote_member(onsdagar.id, bjorn);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a member promoted themselves'; end if;

  failed := false;
  begin
    perform public.remove_member(onsdagar.id, cecilia);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a member removed someone'; end if;

  perform test_helpers.sign_in(anna);
  update public.parties set name = 'Onsdagar FC' where id = onsdagar.id;
  select name into t from public.parties where id = onsdagar.id;
  if t <> 'Onsdagar FC' then raise exception 'TEST FAIL: the captain could not rename the party'; end if;

  failed := false;
  begin
    update public.parties set max_members = 200 where id = onsdagar.id;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: the party cap was raised from the app'; end if;

  perform public.promote_member(onsdagar.id, bjorn);
  select count(*) into n from public.party_members
   where party_id = onsdagar.id and profile_id = bjorn and role = 'captain';
  if n <> 1 then raise exception 'TEST FAIL: the captain could not promote a member'; end if;

  perform public.remove_member(onsdagar.id, cecilia);

  -- removed: Cecilia loses the party but keeps her own history...
  perform test_helpers.sign_in(cecilia);
  select count(*) into n from public.parties where id = onsdagar.id;
  if n <> 0 then raise exception 'TEST FAIL: a removed member can still see the party'; end if;
  select count(*) into n from public.beers where profile_id = cecilia;
  if n <> 1 then raise exception 'TEST FAIL: a removed member lost sight of her own beers'; end if;
  select count(*) into n from public.party_members where profile_id = cecilia and left_at is not null;
  if n <> 1 then raise exception 'TEST FAIL: a removed member lost her membership history'; end if;

  -- ...and her name stays in the party's history
  perform test_helpers.sign_in(anna);
  select count(*) into n from public.profiles where id = cecilia;
  if n <> 1 then raise exception 'TEST FAIL: a departed member vanished from the party''s history'; end if;

  -- she can rejoin with the code; a new code shuts old invites out
  perform test_helpers.sign_in(cecilia);
  perform public.join_party(onsdagar.invite_code);
  select count(*) into n from public.parties where id = onsdagar.id;
  if n <> 1 then raise exception 'TEST FAIL: a departed member could not rejoin'; end if;

  perform test_helpers.sign_in(anna);
  t := public.regenerate_invite_code(onsdagar.id);
  if t = onsdagar.invite_code then raise exception 'TEST FAIL: the invite code did not change'; end if;

  perform test_helpers.sign_in(nils);
  failed := false;
  begin
    perform public.join_party(onsdagar.invite_code);
  exception when no_data_found then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: an old invite code still works'; end if;

  -- the last captain leaving hands over the armband
  perform test_helpers.sign_in(olle);
  perform public.leave_party(other.id);
  perform test_helpers.sign_in(nils);
  select count(*) into n from public.party_members
   where party_id = other.id and profile_id = nils and role = 'captain';
  if n <> 1 then raise exception 'TEST FAIL: nobody became captain when the last one left'; end if;

  -- ── closing a session ───────────────────────────────────────
  perform test_helpers.sign_in(olle);
  failed := false;
  begin
    perform public.close_session(s);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: an outsider closed the session'; end if;

  perform test_helpers.sign_in(bjorn);
  perform public.close_session(s);
  select count(*) into n from public.sessions where id = s and status = 'closed';
  if n <> 1 then raise exception 'TEST FAIL: an attendee could not close the session'; end if;

  failed := false;
  begin
    update public.sessions set status = 'open', closed_at = null where id = s;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a closed session was reopened from the app'; end if;

  -- ── signed out: nothing at all ──────────────────────────────
  perform test_helpers.sign_out();
  perform set_config('role', 'anon', true);
  failed := false;
  begin
    perform count(*) from public.beers;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a signed-out visitor could read beers'; end if;

  failed := false;
  begin
    perform public.join_party(onsdagar.invite_code);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a signed-out visitor could call join_party'; end if;
  reset role;

  raise notice 'ALL RLS TESTS PASSED';
end;
$$;
