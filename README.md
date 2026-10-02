# ONE MILLION BEERS

> Log every beer with your party. Every round with a friend counts toward one million.

A social beer-logging app built around a single absurd, communal goal: **1.000.000 beers**.

You don't drink a million beers. Nobody does. That's the joke — and the point. You log
with your party, your party climbs its own milestone ladder, your party joins a **guild**
(think supporter club), and every pint anyone anywhere logs pushes one shared global
counter toward seven figures.

## Status

**v0 started.** 30 decisions recorded. The schema migration is written and tested — the
one part that is expensive to get wrong. RLS policies, counter roll-ups, the combo engine
and the app itself are next, and wait on the answers in `docs/QUESTIONS.md`.

```
supabase/migrations/   schema (applied + tested against Postgres 16)
supabase/tests/run.sh  spins up a throwaway cluster and asserts the rules hold
```

No Supabase project exists yet, and nothing has been applied to a real database.
To run it locally: **[docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md)**.

👉 **[docs/QUESTIONS.md](docs/QUESTIONS.md) is the answer sheet** — edit the `Answer:` lines.

| Document | What it covers |
|---|---|
| [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) | **Start here — getting it running on your machine** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data model, counters, achievement engine, offline, security |
| [docs/ROADMAP.md](docs/ROADMAP.md) | v0 scope + the irreversibility analysis |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decision log (ADRs) — what's settled, what's open |
| [docs/USER-JOURNEYS.md](docs/USER-JOURNEYS.md) | Journey flowcharts + story map of every story by release |
| [docs/ACHIEVEMENTS.md](docs/ACHIEVEMENTS.md) | The achievement catalogue — gaming + football references |
| [docs/QUESTIONS.md](docs/QUESTIONS.md) | **Open questions — the answer sheet** |

## The core concepts

**Party** — your group of friends. This is where you log. 3-15 people typically.

**Guild** — many parties banded together under a shared banner. Football supporter clubs
are the intended flavour ("Blåvitt Supporter Guild"). This is the tier where big numbers
become reachable.

**The Ladder** — a fixed sequence of milestones (10 → 25 → 50 → 100 → 250 → 500 → 1.000 →
… → 1.000.000). Every scope climbs the same ladder, just starting and ending at
different rungs.

**The Two Gauges** — the big ring shows progress to your *next milestone* (moves weekly,
feels great). The thin bar underneath always shows 0 → 1.000.000 (barely moves, never
goes away).

**Session** — one night out, inside a party. Anyone present can tap `+` for anyone, or
`+ ROUND` to add a beer to everyone at once. The tally syncs live to every phone at the
table. Closes when someone closes it, or at 06:00.

**The Party Rule** — **you cannot log a beer alone.** A session needs at least two
attendees, and every attendee is a real account that joined your party with its invite
code — no guests, no typed-in names. Enforced by foreign keys, not by the UI. Combo
achievements count the *session's* total and unlock for everyone there, so the route to a
big badge is bringing a fifth friend, not ordering a fifth beer.

The counter is therefore a count of **shared** beers. It undercounts reality on purpose,
and you cannot use this app without recruiting the people you drink with.

## Why guilds exist

At ~5 beers per person per week, a party of five logs ~1.300 beers a year:

| Scope | Realistic output | Ladder rungs it can reach |
|---|---|---|
| One person | ~250/year | 10 → 1.000 |
| Party of 5 | ~1.300/year | 10 → 5.000 |
| Guild of 500 parties | ~650.000/year | 1.000 → 500.000 |
| Global | everyone | → 1.000.000 |

A party runs out of ladder around 5.000. Guilds are the tier that makes the big rungs
reachable — without them the top half of the ladder is decorative.

## Design language

Dark, warm, arcade-cabinet-meets-terrace. Numbers are the hero.

| Token | Hex | Use |
|---|---|---|
| Stout Black | `#161009` | App background |
| Cask Brown | `#1D160D` | Cards, surfaces |
| Gold | `#F5B23A` | Primary accent, progress |
| Fire | `#FF5B35` | Alerts, rivalries, hot streaks |
| Hop Green | `#8BD450` | Unlocked, success |
| Foam | `#FBF4E4` | Text |

Type: **Anton** for scoreboard numbers, **Space Grotesk** for everything else.
