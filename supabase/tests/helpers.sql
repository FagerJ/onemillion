-- Shared by every *_test.sql. The runners prepend this file inside the same
-- begin … rollback, so the schema disappears with everything else.
--
-- sign_in() switches to the `authenticated` role with a JWT `sub` claim — exactly
-- what PostgREST does for a request from the app — so RLS applies for real.
-- sign_out() returns to the table owner, which RLS exempts.

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
