# Architecture

Status: **draft.** This describes the full design. v0 builds a subset — see
[ROADMAP](ROADMAP.md#phase-v0--the-lads-build). Five questions in [QUESTIONS.md](QUESTIONS.md)
section B still touch the schema.

---

## 0. Vocabulary

Fixed in [D25](DECISIONS.md#d25--vocabulary-party-is-the-group-session-is-the-night).
Used consistently everywhere; earlier drafts called a Party a "Crew".

| Term | Means |
|---|---|
| **Profile** | A person with an account |
| **Party** | A persistent group of friends. Joined with an invite code. This is your team. |
| **Session** | One night out. Lives inside a Party. Has attendees and beers. |
| **Guild** | Many Parties under one banner — supporter-club flavoured |
| **Round** | One tap that adds a beer to every attendee of a session at once |
| **Ladder** | The shared milestone sequence, 10 → 1.000.000 |

---

## 1. Shape of the system

```
┌─────────────────────────────────────────────────────┐
│  Client  (Expo / React Native — iOS, Android, web)  │
│  ┌───────────────┐  ┌──────────────────────────┐    │
│  │ Offline write │  │ Realtime subscriptions   │    │
│  │ queue         │  │ (global + party counters)│    │
│  └───────┬───────┘  └────────────▲─────────────┘    │
└──────────┼───────────────────────┼──────────────────┘
           │ writes                │ pushes
┌──────────▼───────────────────────┴──────────────────┐
│  Supabase                                           │
│  ┌────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐  │
│  │ Auth   │ │ Postgres │ │ Storage │ │ Realtime  │  │
│  │        │ │  + RLS   │ │ (photos)│ │           │  │
│  └────────┘ └────┬─────┘ └─────────┘ └───────────┘  │
│                  │                                  │
│         ┌────────▼─────────┐                        │
│         │ Triggers:        │                        │
│         │  · counter roll-up                        │
│         │  · milestone detect                       │
│         │  · achievement eval                       │
│         └──────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

Everything that determines a score is computed **server-side in Postgres**. The client
never tells the server "I earned ON FIRE" — it says "I logged a beer", and the database
decides what that means. This matters because the global counter is public and
competitive.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Database | Supabase Postgres | Aggregations, triggers, RLS, one row per beer scales fine |
| Auth | Supabase Auth — Apple + Google + magic link | Nobody types a password in a pub |
| Realtime | Supabase Realtime | Live session tally + the global counter ticking |
| Storage | Supabase Storage | Beer photos |
| Server logic | Postgres functions + a few Edge Functions | Achievement eval belongs next to the data |
| Client | Expo (React Native) + web export | One codebase to iOS, Android and web; push + widgets |
| Hosting (web) | Vercel or Cloudflare Pages | Serves the Expo web export |

Region: `eu-north-1` (Stockholm) to match the existing Supabase org.

---

## 3. Data model

### 3.1 Hierarchy

```
profile ──< party_members >── party ──> guild
                                │
                                └──< session ──< beer
                                        │
                                        └──< session_attendees
```

A **beer** belongs to exactly one **session**, which belongs to exactly one **party**,
which belongs to at most one **guild**. Every beer has an unambiguous path up the
hierarchy — no double counting, ever, even when a person belongs to several parties.

To drink with someone outside your party, **they join your party** with the invite code.
Multi-party membership ([D17](DECISIONS.md#d17--a-person-may-belong-to-several-parties-v1-ships-one))
makes that cheap, and it keeps attribution trivially simple.

### 3.2 Tables

```sql
-- People ------------------------------------------------------------------
profiles (
  id            uuid pk references auth.users,
  display_name  text not null,
  initials      text not null,           -- for the avatar circles
  avatar_color  text not null,           -- from the palette
  avatar_url    text,
  home_city     text,
  created_at    timestamptz
)

-- Parties (your group of friends) ------------------------------------------
parties (
  id            uuid pk,
  name          text not null,           -- "The Thirsty Five"
  slug          text unique,
  invite_code   text unique not null,    -- how you join a party
  accent_color  text,
  guild_id      uuid references guilds,  -- nullable; at most one
  guild_joined_at timestamptz,
  created_by    uuid references profiles,
  created_at    timestamptz
)

party_members (
  party_id      uuid references parties,
  profile_id    uuid references profiles,
  role          text not null,           -- 'captain' | 'member'
  joined_at     timestamptz,
  primary key (party_id, profile_id)
)

-- Guilds (supporter clubs) -------------------------------------------------
guilds (
  id            uuid pk,
  name          text not null,           -- "Blåvitt Supporter Guild"
  slug          text unique,
  crest_url     text,
  colors        jsonb,                   -- {primary, secondary}
  kind          text not null,           -- 'club' | 'community'
  club_ref      text,                    -- canonical club id if kind='club'
  join_policy   text not null,           -- 'open' | 'approval' | 'invite'
  founded_by    uuid references profiles,
  created_at    timestamptz
)

-- Sessions (a night out) ---------------------------------------------------
sessions (
  id            uuid pk,
  party_id      uuid references parties not null,
  guild_id      uuid,                    -- SNAPSHOT of party.guild_id at start
  status        text not null,           -- 'open' | 'closed'
  venue_name    text,
  venue_id      uuid references venues,
  note          text,
  photo_url     text,
  started_at    timestamptz not null,
  closed_at     timestamptz,
  created_by    uuid references profiles,
  created_at    timestamptz
)

session_attendees (                       -- includes people who drank zero
  session_id    uuid references sessions,
  profile_id    uuid references profiles not null,
  party_id      uuid not null,            -- denormalised, for the FK below
  in_rounds     boolean default true,     -- false = skip me on "+ ROUND"
  joined_at     timestamptz,
  primary key (session_id, profile_id),
  -- an attendee must be a member of the session's party
  foreign key (party_id, profile_id) references party_members (party_id, profile_id)
)

beers (
  id            uuid pk,
  session_id    uuid references sessions not null,
  party_id      uuid not null,           -- denormalised for fast roll-up
  guild_id      uuid,                    -- denormalised snapshot
  profile_id    uuid references profiles not null,
  added_by      uuid references profiles not null,  -- who tapped +
  round_id      uuid,                    -- set when added via "+ ROUND"
  beer_type     text,
  volume_ml     int,                     -- 330 | 500 | 568 | custom
  abv           numeric(4,2),
  is_alcohol_free boolean default false,
  photo_url     text,
  logged_at     timestamptz not null,
  voided_at     timestamptz,             -- soft delete; see §3.6
  voided_by     uuid references profiles,
  global_seq    bigint,                  -- "you drank beer #428.391"
  client_uuid   text unique,             -- idempotency key for offline replay
  -- you can only log a beer for someone actually at the session
  foreign key (session_id, profile_id) references session_attendees (session_id, profile_id)
)
```

### 3.3 Modelling decisions worth defending

**One row per beer, not a tally column.** The UI stays the `+`/`−` stepper from the
mockup; a tally of 3 writes 3 rows. A million rows is nothing for Postgres, and it buys
the thing the whole meme is about: knowing exactly who drank beer number 1.000.000, where,
and when. A tally column can never answer it, and retrofitting is a painful migration.

**`party_id` and `guild_id` are snapshotted onto sessions and beers, not joined through.**
When a party transfers to a new guild, history stays where it was earned. Without this, a
party switching guilds would silently rewrite two guilds' totals — and every achievement
derived from them.

**Attendees are separate from beers.** The designated driver still appears in the feed,
still counts toward session size for social achievements, and contributes zero to the
counter. `in_rounds = false` also excludes them from the round button.

**`added_by` is recorded on every beer.** Anyone in a session can log for anyone
([D26](DECISIONS.md#d26--anyone-in-a-session-can-log-for-anyone)), so the audit trail is
what keeps that civil — every correction is attributable and visible in the session log.

### 3.4 The Party Rule — enforced in the database

Per [D19](DECISIONS.md#d19--no-solo-logging), **a session needs at least two attendees**,
and every attendee is a real app user who joined the party with a code. Not a UI
convention a rogue client can skip:

```sql
-- Enforced on beers, not on sessions. A session may briefly hold one attendee
-- while people arrive; the first BEER is what requires company.
create trigger beers_02_require_company
  before insert on beers
  for each row execute function assert_not_drinking_alone();
```

> **Revised by [D30](DECISIONS.md#d30--the-party-rule-is-enforced-on-beers-not-on-sessions).**
> This originally specified a deferred constraint trigger on `sessions`. That cannot work:
> a deferred check runs at COMMIT, so a session created with only its host could never be
> committed, and "start a session, friends join" would be impossible. The check belongs on
> `beers`, which is truer to the intent — the rule is *no solo logging*, not *no briefly
> empty session*.

Two foreign keys do the real work, and they chain:

```
beers ──> session_attendees ──> party_members
  "you can only log a beer     "you can only attend a session
   for someone at the session"   if you're in the party"
```

You cannot log a beer for a person who did not join the party with its invite code. The
second person in every session is a genuine, consenting account — not a name typed into a
box.

Consequences worth being explicit about:

- There is no representation in this system for a beer drunk alone. Not "logged and
  hidden" — genuinely absent.
- The global counter undercounts real-world beers, deliberately. It counts **shared**
  beers. That's the number the app is about.
- Every achievement is implicitly social, which is why the combo ladder can be
  session-scoped ([D20](DECISIONS.md#d20--combos-are-session-scoped)) without a separate
  solo path.
- **Anti-cheat is largely solved by the schema.** Inflating the counter requires
  recruiting real accounts into a real party. Most of the Phase 5 anti-cheat work (P1)
  collapses into rate limits.

### 3.5 Session lifecycle

```
   someone starts a session in the party
                 │
                 ▼
           ┌───────────┐
           │   OPEN    │  party members join / are added
           │           │  anyone taps + for anyone
           │           │  anyone taps + ROUND for everyone
           │           │  tally syncs live to every attendee
           └─────┬─────┘
                 │  closed manually, or auto-closed at 06:00 local
                 ▼
           ┌───────────┐
           │  CLOSED   │  no new beers · combos finalised
           └───────────┘  feed entry published
```

Manual close with an **06:00 local auto-close backstop**
([D27](DECISIONS.md#d27--sessions-auto-close-at-0600-local)) — people forget to close a
session, and nobody wants Tuesday's pint landing in Saturday's party.

> **Tension with [D16](DECISIONS.md#d16--backdating-limited-to-today-and-yesterday):**
> backdating and live sessions pull against each other. A session started for last night
> still works, but the live combo toasts never fire, so the night gets recorded without
> ever being celebrated. Worth designing that empty state honestly rather than faking it.

### 3.6 Logging, rounds and corrections

Per [D26](DECISIONS.md#d26--anyone-in-a-session-can-log-for-anyone):

**Per-person `+`** — adds one beer to that attendee.

**`+ ROUND`** — adds one beer to *every* attendee with `in_rounds = true`, sharing a
`round_id`. This is the primitive that matches how drinking actually works: you buy a
round, not a beer. Shows a preview of who's included so the designated driver can be
dropped with one tap.

**Optional detail** — a sheet on the `+`, never required: volume (33cl / 50cl / pint /
custom), ABV, beer type, photo. The counter is unaffected by any of it
([D12](DECISIONS.md#d12--one-tap--one-beer-volume-is-optional-metadata)); it feeds stats
and the volume-dependent achievements.

**`−` corrects errors** via soft delete — set `voided_at`, don't remove the row. Voiding
the most recent un-voided beer for that person in that session. Soft delete because:

- counters decrement cleanly by excluding voided rows
- the audit trail survives, so "who removed my beer?" is answerable
- it composes with [D16](DECISIONS.md#d16--backdating-limited-to-today-and-yesterday)'s
  rule that deletions never revoke achievements

> **Consequence for `global_seq`:** voided beers leave holes in the sequence, so nobody
> may hold seq exactly 1.000.000. Milestone attribution therefore comes from
> **counter-crossing events** recorded in `milestone_events` at the moment the live
> counter hits a rung — not from `global_seq`, which stays a piece of flavour
> ("you drank beer #428.391"). Getting this wrong would mean the millionth beer is
> unattributable, which is the one number that has to work.

---

## 4. The Ladder

One ladder, shared by every scope. Each scope simply enters and exits at a different rung.

```
1 · 5 · 10 · 25 · 50 · 100 · 250 · 500 · 1.000 · 2.500 · 5.000 · 10.000
  · 25.000 · 50.000 · 100.000 · 250.000 · 500.000 · 1.000.000
```

```sql
milestones (
  threshold     bigint primary key,
  label         text not null,           -- "500" / "HALF A MILLION"
  tier          text not null,           -- 'bronze'|'silver'|'gold'|'legendary'
  applies_to    text[] not null          -- {'profile','party','guild','global'}
)

milestone_events (                        -- who crossed what, when
  id            uuid pk,
  threshold     bigint references milestones,
  scope         text not null,
  scope_id      uuid,                     -- null for global
  beer_id       uuid references beers,    -- the Golden Goal
  profile_id    uuid references profiles,
  crossed_at    timestamptz
)
```

`applies_to` keeps it honest — a party never sees the 250.000 rung dangling unreachably,
and the global counter isn't cluttered with a "10 beers" celebration.

**Easter-egg rungs** fire a toast but don't drive the gauge: `442` (the formation), `1337`
(leet), `1966`, `9001` (IT'S OVER 9000), `20000` (midi-chlorians), `90` (full time).

### 4.1 The two gauges

| | Drives | Behaviour |
|---|---|---|
| **Primary ring** | Next milestone at the scope you're viewing | Moves weekly. `428/500 = 85,6%`. The dopamine. |
| **Secondary bar** | Always `0 → 1.000.000` global | Barely moves. Always present. The ambition and the joke. |

---

## 5. Counters — never `COUNT(*)`

Trigger-maintained roll-up tables, updated inside the same transaction as the insert, all
excluding `voided_at is not null`:

```sql
global_stats  (id=1, total_beers, total_sessions, total_profiles, updated_at)
party_stats   (party_id pk, total_beers, beers_this_week, current_streak_days,
               last_logged_at, next_milestone, updated_at)
guild_stats   (guild_id pk, total_beers, party_count, achievement_points, ...)
profile_stats (profile_id pk, total_beers, current_streak_days, biggest_session, ...)
```

The client subscribes to Realtime on the `global_stats` row. When a stranger in another
city logs a pint, the number ticks up on your screen. That single behaviour is the most
compelling thing this app can do — it's what makes it feel communal rather than like a
private diary.

Realtime on the session row does the same job at close range: everyone at the table
watches the tally climb as rounds land.

Weekly figures are rolled by a scheduled `pg_cron` job, not recomputed on read.

---

## 6. Achievement engine

Achievements are **data, not code**. Adding "Fergie Time" must not require an app release.

```sql
achievements (
  code          text primary key,        -- 'ON_FIRE'
  title         text not null,
  description   text not null,
  flavor        text,                    -- the announcer line
  category      text not null,           -- 'combo'|'football'|'gaming'|'milestone'|'social'|'time'
  scope         text not null,           -- 'profile'|'party'|'guild'|'global'
  tier          int,
  rule          jsonb not null,
  is_secret     boolean default false,   -- hidden until unlocked
  points        int default 10
)

achievement_unlocks (
  id            uuid pk,
  achievement_code text references achievements,
  profile_id    uuid, party_id uuid, guild_id uuid,   -- whichever the scope implies
  session_id    uuid references sessions,             -- what triggered it
  unlocked_at   timestamptz,
  unique (achievement_code, coalesce(profile_id, party_id, guild_id))
)
```

### 6.1 Rule vocabulary

A small **closed** set of rule types, each evaluable in SQL. Closed is the point — an open
expression language would be a security and correctness liability.

| Rule type | Example | Unlocks |
|---|---|---|
| `session_total` | `{min: 12}` | BOOMSHAKALAKA (all attendees combined) |
| `session_size` | `{min: 6}` | Full Squad |
| `round_size` | `{min: 8}` | Getting a round in for eight |
| `total_count` | `{scope:'profile', min:9001}` | IT'S OVER 9000 |
| `streak_days` | `{min: 7}` | Session Streak |
| `time_of_day` | `{after:'23:45', before:'00:00'}` | Fergie Time |
| `distinct_partners` | `{window:'7d', min:5}` | Squad Rotation |
| `distinct_venues` | `{window:'all', min:10}` | Groundhopper |
| `distinct_beer_types` | `{in_session:true, min:3}` | Perfect Hat-trick |
| `session_duration` | `{min_minutes: 90}` | The Full Ninety |
| `full_party` | `{scope:'party'}` | ACE — everyone turned up |
| `crossed_milestone` | `{scope:'party'}` | Golden Goal |
| `abstinence` | `{days: 7}` | Clean Sheet |

One function, `evaluate_achievements(session_id uuid)`, runs after each beer commits and
again on session close, evaluates every rule whose category could be affected, and inserts
unlocks. Server-authoritative and deterministic.

See [ACHIEVEMENTS.md](ACHIEVEMENTS.md) for the catalogue.

---

## 7. Offline-first

**Non-negotiable.** You log beers in pubs. Pubs have terrible signal. Bolting this on
later is far more painful than designing for it now.

Not a sync engine — just a durable queue:

1. Taps write to a local store immediately; UI updates optimistically.
2. Each pending beer carries a `client_uuid`.
3. On reconnect the queue replays. The `unique` constraint on `client_uuid` makes replay
   idempotent — a double-send is a no-op, not a double count.
4. Counters and achievements resolve server-side on arrival, so badges may land a moment
   after the log.

Consequence for design: **the celebration is asynchronous.** The ON FIRE toast might fire
when you get signal back in the taxi. That's fine — arguably better.

Rounds queue as a unit: one `round_id`, N beers, all-or-nothing on replay.

---

## 8. Security & fairness

**RLS on everything.** Party data is visible to party members; guild aggregates to guild
members; global aggregates are public.

> **Known trap:** RLS policies on `party_members` that themselves query `party_members`
> cause infinite recursion. Needs a `SECURITY DEFINER` helper:
> `is_party_member(party_id uuid) returns boolean`. Same for guilds. Cheap if anticipated,
> a bad afternoon if not.

**Anti-cheat** is mostly structural now — the FK chain in §3.4 means inflating the counter
requires recruiting real accounts into a real party. What remains:

- Rate limit: beers per person per hour
- `logged_at` cannot be in the future, nor outside the backdating window
- Guild-level statistical outlier flagging for league-table eligibility

---

## 9. Responsible design

An app that gamifies drinking should make a few decisions deliberately rather than by
accident. Not moralising — just choosing:

- **No solo logging** ([D19](DECISIONS.md#d19--no-solo-logging)). Solo drinking is the
  pattern worth not gamifying, and the app has no representation for it at all.
- **Combos reward party size, not consumption**
  ([D20](DECISIONS.md#d20--combos-are-session-scoped)). The route to a big badge is bringing
  a fifth friend, not ordering a fifth beer.
- **Alcohol-free beers count** ([D9](DECISIONS.md#d9--alcohol-free-beers-count)). The app
  should still work for someone taking a break rather than pushing them out.
- **Clean Sheet is an achievement.** A week off earns a badge. Rest is part of the game.
- **No "you're behind" nudges.** Push notifications celebrate what happened; they never
  guilt you into drinking. Hard product rule, constrains Phase 4.
- **Age gate.** Alcohol content requires a 17+ App Store rating and an age declaration.

---

## 10. Repository layout (proposed)

```
/apps/app             Expo app — iOS, Android, web export
/packages/core        Shared types, ladder logic, achievement rule types
/supabase
  /migrations         Versioned SQL
  /functions          Edge Functions
  /seed               Milestones, achievements, club catalogue
/docs                 These documents
/.github/workflows    CI: lint, typecheck, migration check
```
