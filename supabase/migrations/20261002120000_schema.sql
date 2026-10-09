-- ONE MILLION BEERS — v0 schema
--
-- Implements the owner's answers to section B of docs/QUESTIONS.md (D31–D34).
--
-- Row level security is enabled on every table at the bottom of this file with
-- NO policies attached, which denies all access. That is deliberate: if this
-- migration is ever applied before the policy migration exists, it fails closed
-- rather than exposing every table.
--
-- The five irreducible tables. Per ROADMAP "What is actually irreversible":
-- every aggregate (counters, badges, milestones, leaderboards, stats) is DERIVED
-- from `beers`, so this file is the only part that is expensive to get wrong.
--
-- Guild hooks: `parties.guild_id`, `sessions.guild_id` and `beers.guild_id` are
-- nullable uuid columns with no FK yet — the guilds table arrives in Phase 3 and
-- adds the constraint then. A beer logged before the party joined a guild keeps
-- guild_id = null forever, which is exactly what D6 wants.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- People
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null check (length(trim(display_name)) between 1 and 40),
  initials      text not null check (length(initials) between 1 and 3),
  avatar_color  text not null default '#F5B23A',
  home_city     text,
  timezone      text not null default 'Europe/Stockholm',
  created_at    timestamptz not null default now()
);

comment on table profiles is
  'One per auth user. On GDPR erasure (B3) the row is anonymised in place, never '
  'deleted, so the global counter can never decrease.';

-- ─────────────────────────────────────────────────────────────
-- Parties — the persistent group of friends (D25)
-- ─────────────────────────────────────────────────────────────
create table parties (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 1 and 60),
  invite_code   text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  accent_color  text not null default '#F5B23A',
  -- Phase 3 hook. No FK until the guilds table exists.
  guild_id      uuid,
  guild_joined_at timestamptz,
  max_members   int not null default 50 check (max_members between 2 and 200),
  created_by    uuid not null references profiles,
  created_at    timestamptz not null default now()
);

create index parties_guild_id_idx on parties (guild_id) where guild_id is not null;

comment on column parties.guild_id is 'Phase 3 guild hook; FK added with the guilds table.';
comment on column parties.max_members is 'B2 / D33 — caps combo farming. Default 50.';

-- Join table, never a column on profiles (D17): a person in two parties must
-- stay possible, and that is not retrofittable.
create table party_members (
  party_id      uuid not null references parties on delete cascade,
  profile_id    uuid not null references profiles,
  role          text not null default 'member' check (role in ('captain','member')),
  joined_at     timestamptz not null default now(),
  -- B4: leaving sets this. Never delete the row, or party history becomes rewritable.
  left_at       timestamptz,
  primary key (party_id, profile_id)
);

create index party_members_profile_idx on party_members (profile_id) where left_at is null;

-- ─────────────────────────────────────────────────────────────
-- Sessions — one night out, inside one party (D23a)
-- ─────────────────────────────────────────────────────────────
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  party_id      uuid not null references parties on delete cascade,
  guild_id      uuid,                       -- snapshot of parties.guild_id at start
  status        text not null default 'open' check (status in ('open','closed')),
  venue_name    text,
  note          text,
  started_at    timestamptz not null default now(),
  closed_at     timestamptz,
  -- B5 / D32: not derivable after the fact, so it is stored. Stamped from the
  -- creator's profile unless the client passes one.
  timezone      text not null,
  -- D32: 09:00 local the morning after. Stamped at insert; the close job reads it.
  closes_at     timestamptz not null,
  created_by    uuid not null references profiles,
  created_at    timestamptz not null default now(),
  constraint sessions_closed_has_timestamp
    check ((status = 'closed') = (closed_at is not null))
);

create index sessions_party_started_idx on sessions (party_id, started_at desc);
create unique index sessions_one_open_per_party on sessions (party_id) where status = 'open';

comment on index sessions_one_open_per_party is
  'A party can only have one night running at a time. Keeps "the current session" '
  'unambiguous in the UI and stops stray sessions collecting beers.';

-- Who was there, including people who drank nothing. The only record of the
-- designated driver, and not derivable from beers.
create table session_attendees (
  session_id    uuid not null references sessions on delete cascade,
  profile_id    uuid not null references profiles,
  party_id      uuid not null,
  in_rounds     boolean not null default true,   -- false = skip me on "+ ROUND"
  joined_at     timestamptz not null default now(),
  primary key (session_id, profile_id),
  -- An attendee must be a member of the session's party.
  foreign key (party_id, profile_id) references party_members (party_id, profile_id)
);

-- ─────────────────────────────────────────────────────────────
-- Beer types — a curated list, no free text (B5 / D34)
-- ─────────────────────────────────────────────────────────────
-- A lookup table rather than an enum: adding a type is an insert, not a
-- migration, and a type can be retired without rewriting history.
create table beer_types (
  code          text primary key check (code ~ '^[a-z_]{2,20}$'),
  label         text not null,
  sort_order    int  not null
);

insert into beer_types (code, label, sort_order) values
  ('lager',    'Lager',    10),
  ('pilsner',  'Pilsner',  20),
  ('pale_ale', 'Pale Ale', 30),
  ('ipa',      'IPA',      40),
  ('wheat',    'Wheat',    50),
  ('stout',    'Stout',    60),
  ('porter',   'Porter',   70),
  ('sour',     'Sour',     80),
  ('other',    'Other',    90);

comment on table beer_types is
  'D34 — the only values beers.beer_type accepts. "other" exists so nobody has to '
  'mislabel a tripel; achievements that count distinct types ignore it.';

-- ─────────────────────────────────────────────────────────────
-- Beers — one row per beer, never a tally (D5)
-- ─────────────────────────────────────────────────────────────
create sequence beers_global_seq as bigint;

create table beers (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions on delete cascade,
  party_id      uuid not null,              -- denormalised for roll-up speed
  guild_id      uuid,                       -- denormalised snapshot
  profile_id    uuid not null references profiles,   -- the drinker
  added_by      uuid not null references profiles,   -- who tapped + (D26)
  round_id      uuid,                       -- shared by one "+ ROUND" tap
  -- Optional metadata (D12). The counter counts taps; none of this is required.
  beer_type     text references beer_types,
  volume_ml     int check (volume_ml between 50 and 2000),
  abv           numeric(4,2) check (abv >= 0 and abv <= 70),
  is_alcohol_free boolean not null default false,
  logged_at     timestamptz not null default now(),
  -- D28: "−" voids, never deletes. Counters exclude voided rows; badges survive.
  voided_at     timestamptz,
  voided_by     uuid references profiles,
  global_seq    bigint not null default nextval('beers_global_seq'),
  client_uuid   text unique,                -- offline replay idempotency key (D8)
  created_at    timestamptz not null default now(),
  -- You can only log a beer for someone who is actually at the session.
  foreign key (session_id, profile_id) references session_attendees (session_id, profile_id),
  constraint beers_void_is_consistent
    check ((voided_at is null) = (voided_by is null))
);

create index beers_session_idx    on beers (session_id) where voided_at is null;
create index beers_party_idx      on beers (party_id, logged_at desc) where voided_at is null;
create index beers_profile_idx    on beers (profile_id, logged_at desc) where voided_at is null;
create index beers_round_idx      on beers (round_id) where round_id is not null;
create index beers_guild_idx      on beers (guild_id) where guild_id is not null;

comment on column beers.global_seq is
  'Flavour only — "you drank beer #428.391". Voided beers leave holes, so milestone '
  'attribution comes from milestone_events, not from this column (D28).';

-- ─────────────────────────────────────────────────────────────
-- The Party Rule (D19) — no beer may be drunk alone
-- ─────────────────────────────────────────────────────────────
-- Enforced on `beers`, not on `sessions`. The rule we care about is "no solo
-- LOGGING"; a session that momentarily holds one attendee while friends are still
-- arriving is fine, and a deferred check on sessions would make that flow
-- impossible to commit. See D30.
create or replace function assert_not_drinking_alone()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n int;
begin
  select count(*) into n
  from session_attendees
  where session_id = new.session_id;

  if n < 2 then
    raise exception
      'A beer cannot be logged alone: session % has % attendee(s), needs at least 2',
      new.session_id, n
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Trigger names are numbered because Postgres fires BEFORE triggers in
-- alphabetical order, and the stamping trigger below must run first.
create trigger beers_02_require_company
  before insert on beers
  for each row execute function assert_not_drinking_alone();

-- Party size cap (B2 / D33). Checked on joining and on rejoining (left_at cleared).
create or replace function assert_party_not_full()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n int;
  cap int;
begin
  if tg_op = 'UPDATE' and not (old.left_at is not null and new.left_at is null) then
    return new;
  end if;

  -- Lock the party row so two people joining at once can't both take the last seat.
  select max_members into cap from parties where id = new.party_id for update;
  select count(*) into n
  from party_members
  where party_id = new.party_id and left_at is null;

  if n >= cap then
    raise exception 'Party % is full (% of % members)', new.party_id, n, cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger party_members_respect_cap
  before insert or update of left_at on party_members
  for each row execute function assert_party_not_full();

-- ─────────────────────────────────────────────────────────────
-- Denormalisation guards — keep the snapshots honest on write
-- ─────────────────────────────────────────────────────────────
create or replace function stamp_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select p.guild_id into new.guild_id from parties p where p.id = new.party_id;

  -- B5: the session creator's timezone, unless the client passed one.
  if new.timezone is null then
    select timezone into new.timezone from profiles where id = new.created_by;
  end if;

  -- D32: 09:00 local the morning after. A session started before 06:00 belongs
  -- to the night before, so a 01:00 start still closes at 09:00 that morning
  -- and a breakfast start doesn't close within minutes. Range: 3h to 27h.
  --
  -- D41: measured from the later of the start and the moment it was opened, so
  -- last night can still be logged today (D16) instead of closing on arrival.
  new.closes_at :=
    ((((greatest(new.started_at, new.created_at) at time zone new.timezone)
        - interval '6 hours')::date + 1)
      + time '09:00') at time zone new.timezone;

  return new;
end;
$$;

create trigger sessions_stamp
  before insert on sessions
  for each row execute function stamp_session();

create or replace function stamp_beer_from_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  select party_id, guild_id, status, closes_at into s from sessions where id = new.session_id;

  -- `not found` also covers a session the caller can't see under RLS. Past its
  -- closing time counts as closed even before the job gets to it (D41).
  if not found or s.status <> 'open' or now() >= s.closes_at then
    raise exception 'Session % is not open', new.session_id
      using errcode = 'check_violation';
  end if;

  new.party_id := s.party_id;
  new.guild_id := s.guild_id;
  return new;
end;
$$;

create trigger beers_01_stamp_parents
  before insert on beers
  for each row execute function stamp_beer_from_session();

create or replace function stamp_attendee_party()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  select party_id, status, closes_at into s from sessions where id = new.session_id;

  -- Joining a closed night would hand out its combos after the fact.
  if not found or s.status <> 'open' or now() >= s.closes_at then
    raise exception 'Session % is not open', new.session_id
      using errcode = 'check_violation';
  end if;

  new.party_id := s.party_id;

  -- The FK below only proves the membership row exists; someone who has left the
  -- party still has one (B4 keeps it for history). Check they are current.
  if not exists (
    select 1 from party_members
    where party_id = new.party_id
      and profile_id = new.profile_id
      and left_at is null
  ) then
    raise exception 'Profile % is not a current member of party %',
      new.profile_id, new.party_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger session_attendees_stamp_party
  before insert on session_attendees
  for each row execute function stamp_attendee_party();

-- ─────────────────────────────────────────────────────────────
-- Invite codes
-- ─────────────────────────────────────────────────────────────
-- Crockford-ish alphabet: no I, O, 1 or 0, because these get read aloud in pubs.
create or replace function generate_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for attempt in 1..20 loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from parties where invite_code = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Could not generate a free invite code';
end;
$$;

alter table parties alter column invite_code set default generate_invite_code();

-- ─────────────────────────────────────────────────────────────
-- Fail closed
-- ─────────────────────────────────────────────────────────────
-- RLS on, no policies = nobody can read or write anything through the anon or
-- authenticated roles. The policy migration grants party-scoped access. Until it
-- exists, applying this file leaves a locked database rather than an open one.
alter table profiles          enable row level security;
alter table beer_types        enable row level security;
alter table parties           enable row level security;
alter table party_members     enable row level security;
alter table sessions          enable row level security;
alter table session_attendees enable row level security;
alter table beers             enable row level security;
