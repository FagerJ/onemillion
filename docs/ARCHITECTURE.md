# Architecture

Status: **draft — pending answers in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)**

---

## 1. Shape of the system

```
┌─────────────────────────────────────────────────────┐
│  Client  (Expo / React Native — iOS, Android, web)  │
│  ┌───────────────┐  ┌──────────────────────────┐    │
│  │ Offline write │  │ Realtime subscriptions   │    │
│  │ queue         │  │ (global + crew counters) │    │
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
never tells the server "I earned RAMPAGE" — it says "I logged a session", and the
database decides what that means. This matters because the global counter is public and
competitive.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Database | Supabase Postgres | Aggregations, triggers, RLS, one row per beer scales fine |
| Auth | Supabase Auth — Apple + Google + magic link | Nobody types a password in a pub |
| Realtime | Supabase Realtime | The global counter ticking live is the app's best moment |
| Storage | Supabase Storage | Beer photos |
| Server logic | Postgres functions + a few Edge Functions | Achievement eval belongs next to the data |
| Client | **Expo (React Native) + web export** | One codebase to iOS, Android and web; push + widgets |
| Hosting (web) | Vercel or Cloudflare Pages | Serves the Expo web export |

Region: `eu-north-1` (Stockholm) to match the existing Supabase org.

---

## 3. Data model

### 3.1 Hierarchy

```
                    ┌──> crew ──> guild        (attribution — follows the DRINKER)
profile ──< beer ───┤
                    └──> party                 (context — who you were with)
```

A **beer** has two independent parents, and keeping them separate is what makes
cross-crew parties work:

- **Attribution** follows the *drinker*. Your beer credits **your** crew and **your**
  guild, always — even when you're drinking in someone else's party.
- **Context** is the party. It records who you were with, where, and when, and it's what
  combo achievements are computed over.

A party can contain people from three different crews; each person's beers flow up their
own hierarchy. Nobody farms another crew's total, and no beer is ever counted twice.

> **Superseded:** the original model had `beer → session → crew → guild`, which assumed
> one crew per session. The party join code ([D22](DECISIONS.md#d22--a-party-is-a-live-joinable-session-with-an-invite-code))
> makes that assumption false.

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

-- Crews (your group of friends) --------------------------------------------
crews (
  id            uuid pk,
  name          text not null,           -- "The Thirsty Five"
  slug          text unique,
  invite_code   text unique not null,
  accent_color  text,
  guild_id      uuid references guilds,  -- nullable; at most one
  guild_joined_at timestamptz,
  created_by    uuid references profiles,
  created_at    timestamptz
)

crew_members (
  crew_id       uuid references crews,
  profile_id    uuid references profiles,
  role          text not null,           -- 'captain' | 'member'
  joined_at     timestamptz,
  primary key (crew_id, profile_id)
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

-- Parties (a night out — live, joinable) -----------------------------------
parties (
  id            uuid pk,
  host_crew_id  uuid references crews not null,   -- whose night it is; context only
  join_code     text,                             -- 4-char, NULL once closed
  status        text not null,                    -- 'open' | 'closed'
  venue_name    text,
  venue_id      uuid references venues,
  note          text,
  photo_url     text,
  started_at    timestamptz not null,
  closed_at     timestamptz,
  created_by    uuid references profiles,
  created_at    timestamptz
)
-- Codes only need to be unique among OPEN parties, so 4 chars is plenty
-- and they recycle freely once a party closes.
create unique index on parties (join_code) where status = 'open';

party_members (                           -- includes people who drank zero
  party_id      uuid references parties,
  profile_id    uuid references profiles not null,  -- NO GUESTS: app account required
  crew_id       uuid not null,            -- SNAPSHOT of the member's own crew
  guild_id      uuid,                     -- SNAPSHOT of that crew's guild
  joined_at     timestamptz,
  primary key (party_id, profile_id)
)

beers (
  id            uuid pk,
  party_id      uuid references parties not null,  -- context: who you were with
  profile_id    uuid references profiles not null, -- the drinker
  crew_id       uuid not null,            -- the DRINKER's crew, not the host's
  guild_id      uuid,                     -- the DRINKER's guild, snapshotted
  beer_type     text,
  volume_ml     int,
  abv           numeric(4,2),
  is_alcohol_free boolean default false,
  logged_at     timestamptz not null,
  global_seq    bigint unique,            -- "you drank beer #428,391"
  client_uuid   text unique               -- idempotency key for offline replay
)
```

Note `beers.crew_id` is copied from `party_members.crew_id` for that profile — the
drinker's own crew — never from `parties.host_crew_id`.

### 3.3 Three modelling decisions worth defending

**One row per beer, not a tally column.** The UI stays the `+`/`−` stepper from the
mockup; saving a tally of 3 writes 3 rows. A million rows is nothing for Postgres, and it
buys the thing the entire meme is about: knowing exactly who drank beer number 1.000.000,
where, and when. `global_seq` is a monotonic sequence that makes that queryable forever.
A tally column can never answer it, and retrofitting is a painful migration.

**`crew_id` and `guild_id` are snapshotted, not joined through.** When a crew transfers
to a new guild, history stays where it was earned. Without this, a crew switching guilds
would silently rewrite two guilds' totals — and every achievement derived from them. Same
argument applies to a person changing crews.

**Party membership is separate from beers.** The designated driver still appears in the
feed, still counts toward party size for social achievements, and contributes zero to the
counter.

### 3.4 The Party Rule — enforced in the database

Per [D19](DECISIONS.md#d19--no-solo-logging), **a party must have at least two members**,
and per [D22](DECISIONS.md#d22--a-party-is-a-live-joinable-session-with-an-invite-code)
every member is a real app user who chose to join. Not a UI convention a rogue client can
skip:

```sql
-- Deferred so a party and its members can be inserted in one transaction,
-- but the transaction cannot commit with a lone drinker in it.
create constraint trigger party_requires_two
  after insert or update on parties
  deferrable initially deferred
  for each row execute function assert_party_of_two();

-- A beer can only exist for someone who actually joined the party.
alter table beers add constraint beer_drinker_is_member
  foreign key (party_id, profile_id) references party_members (party_id, profile_id);
```

That foreign key is the load-bearing one. You cannot log a beer for a person who did not
enter the code on their own phone, which means the second person in every party is a
genuine, consenting account — not a name typed into a box.

Consequences worth being explicit about:

- There is no representation in this system for a beer drunk alone. Not "logged and
  hidden" — genuinely absent.
- The global counter undercounts real-world beers, deliberately. It counts **shared**
  beers, verified by both parties. That's the number the app is about.
- Every achievement is implicitly social, which is why the combo ladder can be
  party-scoped ([D20](DECISIONS.md#d20--combos-are-party-scoped)) without a separate solo
  path.
- **Anti-cheat is largely solved by the schema.** Inflating the counter requires
  recruiting real accounts who join real parties. Most of the Phase 5 anti-cheat work
  (P1) collapses into rate limits.

---

### 3.5 Party lifecycle

```
   host starts a party
           │
           ▼
     ┌───────────┐   others enter the 4-char code on their own phone
     │   OPEN    │◄──────────────────────────────────────────────────┐
     │           │                                                   │
     │ · code live                                    join / rejoin ─┘
     │ · members may join
     │ · beers may be logged
     └─────┬─────┘
           │  host closes it, or auto-close (see Q19)
           ▼
     ┌───────────┐
     │  CLOSED   │  code released · no new members · no new beers
     └───────────┘  combos finalised · feed entry published
```

The join code is short (4 characters) because it only needs to be unique among
*currently open* parties — the partial unique index enforces exactly that, and codes
recycle once a party closes. Shown as text and as a QR so nobody types anything in a
dark pub.

This also makes the party a **live object**: everyone in it can watch the tally climb in
real time over Realtime, which is a far better experience than one person tallying for
the table afterwards.

> **Tension with [D16](DECISIONS.md#d16--backdating-limited-to-today-and-yesterday):**
> backdating and live parties pull against each other. A party started for last night still
> works — the code goes live now, people join now, `started_at` is yesterday — but the
> live combo toasts never fire, so the night is recorded without ever being celebrated.
> Acceptable, and worth designing the empty state for: a backdated party should say so
> rather than pretending it was live.

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
  applies_to    text[] not null          -- {'profile','crew','guild','global'}
)
```

`applies_to` is what keeps it honest — a crew never sees the 250.000 rung dangling
unreachably, and the global counter isn't cluttered with a "10 beers" celebration.

**Easter-egg rungs** fire a toast but don't drive the gauge: `442` (the formation), `1337`
(leet), `1966`, `9001` (IT'S OVER 9000), `90` (full time), `128 / 256 / 512 / 1024`.

### 4.1 The two gauges

| | Drives | Behaviour |
|---|---|---|
| **Primary ring** | Next milestone at the scope you're viewing | Moves weekly. `428/500 = 85.6%`. The dopamine. |
| **Secondary bar** | Always `0 → 1.000.000` global | Barely moves. Always present. The ambition and the joke. |

---

## 5. Counters — never `COUNT(*)`

Trigger-maintained roll-up tables, updated inside the same transaction as the insert:

```sql
global_stats  (id=1, total_beers, total_sessions, total_profiles, updated_at)
crew_stats    (crew_id pk, total_beers, beers_this_week, current_streak_days,
               last_logged_at, next_milestone, updated_at)
guild_stats   (guild_id pk, total_beers, crew_count, beers_this_week, ...)
profile_stats (profile_id pk, total_beers, current_streak_days, longest_session, ...)
```

The client subscribes to Realtime on the `global_stats` row. When a stranger in another
city logs a pint, the number ticks up on your screen. That single behaviour is the most
compelling thing this app can do — it's what makes it feel communal rather than like a
private diary.

Weekly figures are maintained by a scheduled `pg_cron` job that rolls the window, not by
recomputing on read.

---

## 6. Achievement engine

Achievements are **data, not code**. Adding "Fergie Time" must not require an app release.

```sql
achievements (
  code          text primary key,        -- 'RAMPAGE'
  title         text not null,
  description   text not null,
  flavor        text,                    -- the announcer line
  category      text not null,           -- 'combo'|'football'|'gaming'|'milestone'|'social'|'time'
  scope         text not null,           -- 'profile'|'crew'|'guild'|'global'
  tier          int,
  rule          jsonb not null,
  is_secret     boolean default false,   -- hidden until unlocked
  points        int default 10
)

achievement_unlocks (
  id            uuid pk,
  achievement_code text references achievements,
  profile_id    uuid, crew_id uuid, guild_id uuid,   -- whichever the scope implies
  session_id    uuid references sessions,            -- what triggered it
  unlocked_at   timestamptz,
  unique (achievement_code, coalesce(profile_id, crew_id, guild_id))
)
```

### 6.1 Rule vocabulary

A small **closed** set of rule types, each evaluable in SQL. Closed is the point — an open
expression language would be a security and correctness liability.

| Rule type | Example | Unlocks |
|---|---|---|
| `party_session_count` | `{min: 12}` | BOOMSHAKALAKA (session total, all attendees) |
| `party_size` | `{min: 6}` | Full Squad |
| `total_count` | `{scope:'profile', min:9001}` | IT'S OVER 9000 |
| `streak_days` | `{min: 7}` | Session Streak |
| `time_of_day` | `{after:'23:45', before:'00:00'}` | Fergie Time |
| `distinct_partners` | `{window:'7d', min:5}` | Squad Rotation |
| `distinct_venues` | `{window:'all', min:10}` | Groundhopper |
| `distinct_beer_types` | `{in_session:true, min:3}` | Perfect Hat-trick |
| `session_duration` | `{min_minutes: 90}` | Full Ninety |
| `full_squad` | `{scope:'crew'}` | ACE |
| `crossed_milestone` | `{scope:'crew'}` | Golden Goal |
| `abstinence` | `{days: 7}` | Clean Sheet |

One function, `evaluate_achievements(session_id uuid)`, runs after a session commits,
evaluates every rule whose category could possibly be affected, and inserts unlocks.
Server-authoritative and deterministic — replaying the same session always yields the same
badges.

See [ACHIEVEMENTS.md](ACHIEVEMENTS.md) for the catalogue.

---

## 7. Offline-first

**Non-negotiable.** You log beers in pubs. Pubs have terrible signal. Bolting this on
later is far more painful than designing for it now.

Not a sync engine — just a durable queue:

1. Log writes to a local store immediately; UI updates optimistically.
2. Each pending session carries a `client_uuid`.
3. On reconnect, the queue replays. The `unique` constraint on `client_uuid` makes replay
   idempotent — a double-send is a no-op, not a double count.
4. Counters and achievements resolve server-side on arrival, so badges may land a moment
   after the log. Surfaced as a celebratory push rather than an inline update.

Consequence for design: **the celebration is asynchronous.** The RAMPAGE toast might fire
when you get signal back in the taxi. That's fine — arguably better.

---

## 8. Security & fairness

**RLS on everything.** Crew data is visible to crew members; guild aggregates are visible
to guild members; global aggregates are public.

> **Known trap:** RLS policies on `crew_members` that themselves query `crew_members`
> cause infinite recursion. Needs a `SECURITY DEFINER` helper:
> `is_crew_member(crew_id uuid) returns boolean`. Same for guilds. Cheap if anticipated,
> a bad afternoon if not.

**Anti-cheat** — the global counter is public and competitive, so someone will tap +9999.
Layered, all server-side:

- `CHECK` constraints: beers per person per session ≤ N
- Rate limit: beers per person per hour ≤ N
- `logged_at` cannot be in the future, nor more than N days in the past
- Guild-level statistical outlier flagging for leaderboard eligibility

Thresholds are in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) — they need a human call, not a
default.

---

## 9. Responsible design

An app that gamifies drinking with a badge called RAMPAGE should make a few decisions
deliberately rather than by accident. Not moralising — just choosing:

- **Alcohol-free beers count.** `is_alcohol_free` is on the schema. NA beer is a beer, it
  counts toward the million, and it means the app works for someone taking a break rather
  than pushing them out.
- **Clean Sheet is an achievement.** A week without logging earns a badge. Rest is part of
  the game, not a failure state.
- **No solo logging** ([D19](DECISIONS.md#d19--no-solo-logging)). The single most
  meaningful choice available here: solo drinking is the pattern worth not gamifying, and
  the app has no representation for it at all.
- **Combos reward party size, not consumption** ([D20](DECISIONS.md#d20--combos-are-party-scoped)).
  The route to a big badge is bringing a fifth friend, not ordering a fifth beer.
- **No "you're behind" nudges.** Push notifications celebrate what happened; they never
  guilt you into drinking. This is a hard product rule, and it constrains Phase 4.
- **Age gate.** Alcohol content requires a 17+ rating on the App Store and an age
  declaration. Affects distribution — see Q13.

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
