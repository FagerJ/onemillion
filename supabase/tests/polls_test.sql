-- Poll tests (D47): a signed-out visitor votes through cast_vote() and reads through
-- poll_results(), and can't reach the tables any other way.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  anna  constant uuid := gen_random_uuid();
  bjorn constant uuid := gen_random_uuid();
  n int;
  t text;
  failed boolean;
begin
  insert into polls (id, options) values ('test-poll', array['a', 'b']);
  insert into polls (id, options, is_open) values ('test-closed', array['a', 'b'], false);

  perform test_helpers.sign_out();
  perform set_config('role', 'anon', true);

  -- ── a signed-out visitor votes ──────────────────────────────
  perform cast_vote('test-poll', anna, 'a', '  Anna  ', 'Because.');
  perform cast_vote('test-poll', bjorn, 'b', 'Björn', '   ');

  select count(*) into n from poll_results('test-poll');
  if n <> 2 then raise exception 'TEST FAIL: expected 2 votes, got %', n; end if;

  select count(*) into n from poll_results('test-poll') where name = 'Anna' and comment = 'Because.';
  if n <> 1 then raise exception 'TEST FAIL: the name should be trimmed and the comment kept'; end if;

  select count(*) into n from poll_results('test-poll') where name = 'Björn' and comment is null;
  if n <> 1 then raise exception 'TEST FAIL: a blank comment should be dropped'; end if;

  -- ── changing your mind replaces your vote ───────────────────
  perform cast_vote('test-poll', anna, 'b', 'Anna');
  select count(*) into n from poll_results('test-poll');
  if n <> 2 then raise exception 'TEST FAIL: a changed vote added a row instead of replacing it'; end if;
  select count(*) into n from poll_results('test-poll') where choice = 'b';
  if n <> 2 then raise exception 'TEST FAIL: a changed vote did not take'; end if;

  -- ── what a vote may not be ──────────────────────────────────
  failed := false;
  begin
    perform cast_vote('test-poll', anna, 'z', 'Anna');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a vote for something that is not an option was accepted'; end if;

  failed := false;
  begin
    perform cast_vote('test-closed', anna, 'a', 'Anna');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a closed poll took a vote'; end if;

  failed := false;
  begin
    perform cast_vote('no-such-poll', anna, 'a', 'Anna');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a poll that does not exist took a vote'; end if;

  failed := false;
  begin
    perform cast_vote('test-poll', gen_random_uuid(), 'a', '   ');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a vote without a name was accepted'; end if;

  failed := false;
  begin
    perform cast_vote('test-poll', gen_random_uuid(), 'a', 'Cecilia', repeat('x', 281));
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a 281-character comment was accepted'; end if;

  -- ── the tables stay shut ────────────────────────────────────
  failed := false;
  begin
    perform count(*) from poll_votes;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a visitor read the votes table directly'; end if;

  failed := false;
  begin
    insert into poll_votes (poll_id, voter, choice, name) values ('test-poll', gen_random_uuid(), 'a', 'Sneaky');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a visitor wrote to the votes table directly'; end if;

  failed := false;
  begin
    update polls set is_open = true where id = 'test-closed';
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a visitor reopened a poll'; end if;

  reset role;

  -- ── voter ids never leave the database ──────────────────────
  t := pg_get_function_result('public.poll_results(text)'::regprocedure);
  if t ~ 'voter' then raise exception 'TEST FAIL: poll_results returns the voter id: %', t; end if;

  -- ── 500 votes and the poll is full, but you can still change yours ──
  insert into poll_votes (poll_id, voter, choice, name)
  select 'test-poll', gen_random_uuid(), 'a', 'Filler' from generate_series(1, 498);

  perform set_config('role', 'anon', true);

  failed := false;
  begin
    perform cast_vote('test-poll', gen_random_uuid(), 'a', 'Latecomer');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'TEST FAIL: a full poll took a new vote'; end if;

  perform cast_vote('test-poll', anna, 'a', 'Anna');
  select count(*) into n from poll_results('test-poll') where name = 'Anna' and choice = 'a';
  if n <> 1 then raise exception 'TEST FAIL: a voter could not change their vote in a full poll'; end if;

  reset role;

  raise notice 'ALL POLL TESTS PASSED';
end;
$$;
