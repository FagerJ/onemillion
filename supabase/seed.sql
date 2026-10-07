-- ONE MILLION BEERS — local demo data
--
-- Loaded by `supabase db reset` after the migrations. Local development only:
-- `supabase db push` never seeds a hosted project.
--
-- Eight demo accounts, all in the party "Onsdagar" (invite code SKAL42), with ten
-- Wednesdays of history so the dashboard, streaks, leaderboard and feed have
-- something to show. Every demo account signs in with the password  onemillion
--
--   demo@onemillion.test      ← sign in as this one; captain of Onsdagar
--   johan@  linnea@  marcus@  sara@  viktor@  elin@  oskar@   (all @onemillion.test)
--
-- Demo skipped week −7, so their streak is 6 weeks running. Some weeks somebody
-- drove (in_rounds = false, zero beers) — they keep their streak too.

select setseed(0.1966);   -- the same history on every reset

create temp table demo_people (
  id uuid, email text, display_name text, initials text, color text, ord int
);

insert into demo_people values
  ('d0000000-0000-4000-8000-000000000001', 'demo@onemillion.test',   'Demo',   'DE', '#F5B23A', 1),
  ('d0000000-0000-4000-8000-000000000002', 'johan@onemillion.test',  'Johan',  'JO', '#FF5B35', 2),
  ('d0000000-0000-4000-8000-000000000003', 'linnea@onemillion.test', 'Linnea', 'LI', '#8BD450', 3),
  ('d0000000-0000-4000-8000-000000000004', 'marcus@onemillion.test', 'Marcus', 'MA', '#E08D2C', 4),
  ('d0000000-0000-4000-8000-000000000005', 'sara@onemillion.test',   'Sara',   'SA', '#F28FAD', 5),
  ('d0000000-0000-4000-8000-000000000006', 'viktor@onemillion.test', 'Viktor', 'VI', '#5BC0EB', 6),
  ('d0000000-0000-4000-8000-000000000007', 'elin@onemillion.test',   'Elin',   'EL', '#D9A05B', 7),
  ('d0000000-0000-4000-8000-000000000008', 'oskar@onemillion.test',  'Oskar',  'OS', '#B9A7FF', 8);

-- Real sign-in accounts. GoTrue reads the token columns as strings, so they must
-- be '' rather than NULL, and email sign-in needs a matching identity row.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('onemillion', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now() - interval '80 days', now(),
  '', '', '', ''
from demo_people;

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now() - interval '80 days', now()
from demo_people;

insert into public.profiles (id, display_name, initials, avatar_color, timezone, created_at)
select id, display_name, initials, color, 'Europe/Stockholm', now() - interval '80 days'
from demo_people;

insert into public.parties (id, name, invite_code, created_by, created_at)
values ('d0000000-0000-4000-8000-0000000000a1', 'Onsdagar', 'SKAL42',
        'd0000000-0000-4000-8000-000000000001', now() - interval '80 days');

insert into public.party_members (party_id, profile_id, role, joined_at)
select 'd0000000-0000-4000-8000-0000000000a1', id,
       case when ord = 1 then 'captain' else 'member' end,
       now() - interval '80 days'
from demo_people;

-- Ten Wednesdays, oldest first, 19:00 Stockholm time. Each night: who came, a few
-- rounds for everyone not driving, then some individual extras.
do $$
declare
  tz constant text := 'Europe/Stockholm';
  onsdagar constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  demo constant uuid := 'd0000000-0000-4000-8000-000000000001';
  johan constant uuid := 'd0000000-0000-4000-8000-000000000002';
  this_monday constant date := date_trunc('week', now() at time zone tz)::date;
  w int;
  r int;
  s uuid;
  started timestamptz;
  rid uuid;
  tapped_at timestamptz;
  tapper uuid;
begin
  for w in reverse 10..1 loop
    started := ((this_monday - 7 * w + 2) + time '19:00') at time zone tz;

    insert into public.sessions (party_id, started_at, timezone, created_by)
    values (onsdagar, started, tz, demo)
    returning id into s;

    insert into public.session_attendees (session_id, profile_id, joined_at)
    select s, id, started
    from demo_people
    where (ord = 1 and w <> 7) or (ord > 1 and random() < 0.65);

    if (select count(*) from public.session_attendees where session_id = s) < 2 then
      insert into public.session_attendees (session_id, profile_id, joined_at)
      values (s, johan, started)
      on conflict do nothing;
    end if;

    -- some weeks somebody drives
    if random() < 0.35 then
      update public.session_attendees set in_rounds = false
      where session_id = s and profile_id = (
        select profile_id from public.session_attendees
        where session_id = s and profile_id <> demo
        order by random() limit 1);
    end if;

    -- a round is one tap: one tapper, one moment, one round_id for everyone in it
    for r in 1 .. 2 + floor(random() * 3)::int loop
      rid := gen_random_uuid();
      tapped_at := started + make_interval(mins => r * 55 + floor(random() * 10)::int);
      select profile_id into tapper from public.session_attendees
       where session_id = s and in_rounds order by random() limit 1;

      insert into public.beers (session_id, profile_id, added_by, round_id, logged_at)
      select s, a.profile_id, tapper, rid, tapped_at
      from public.session_attendees a
      where a.session_id = s and a.in_rounds;
    end loop;

    insert into public.beers (session_id, profile_id, added_by, logged_at)
    select s, a.profile_id, a.profile_id,
           started + make_interval(mins => 30 + floor(random() * 240)::int)
    from public.session_attendees a, generate_series(1, 3)
    where a.session_id = s and a.in_rounds and random() < 0.3;

    update public.sessions
       set status = 'closed',
           closed_at = started + interval '5 hours',
           closes_at = (((started at time zone tz)::date + 1) + time '09:00') at time zone tz
     where id = s;
  end loop;
end;
$$;

drop table demo_people;
