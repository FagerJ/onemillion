# ONE MILLION BEERS — working notes

A social beer-logging app for a group of friends, built around one shared goal:
1.000.000 beers. See `README.md` for the concepts and `docs/` for the design.

**Read first:** `docs/SESSION-HANDOFF.md` (session memory — what was reversed and why,
which recommendations are baked into the schema), `docs/DECISIONS.md` (30 ADRs — what's settled and why),
`docs/ROADMAP.md` (v0 scope + the irreversibility analysis), `docs/QUESTIONS.md`
(open questions awaiting the owner's answers).

## Where things stand

- **Design: done.** 30 decisions recorded. Architecture, roadmap, achievement catalogue,
  user journeys and story map all written.
- **Schema: written and tested.** `supabase/migrations/20261002120000_schema.sql` — the five
  irreducible tables. 14 behavioural assertions pass (`./supabase/tests/run.sh`).
- **Not started:** RLS policies, counter roll-up triggers, milestones + combo engine, the
  Expo app. Nothing has been applied to a hosted Supabase project; none exists yet.
- Work lives on `claude/million-beers-architecture-inbc70`. `main` has only the initial
  commit. No PR open.

## Vocabulary — get this right

| Term | Means |
|---|---|
| **Party** | The persistent group of friends. Joined with an invite code. |
| **Session** | One night out, inside a party. Has attendees and beers. |
| **Guild** | Many parties under one banner. Phase 3, not built. |
| **Round** | One tap adding a beer to every attendee at once. |

An earlier draft called a Party a "Crew" and used "Party" for the night out. That collision
caused two rounds of wrong design (see the struck-through D22/D23/D24). Don't reintroduce it.

## The rules that are load-bearing

- **No solo logging.** A beer's session must have ≥2 attendees. Enforced by a trigger on
  `beers`, not on `sessions` — see D30 for why the obvious version doesn't work.
- **One row per beer**, never a tally column. Every aggregate is derived from `beers`, which
  is what makes almost everything else safely changeable later.
- **`guild_id` is nullable on `parties`, `sessions` and `beers`** with no FK yet. This is the
  entire hook for guilds. A pre-guild beer keeps `guild_id = null` forever, which is correct.
- **`−` voids, never deletes.** Counters exclude voided rows; achievements are never revoked.
- **Milestones attribute by counter-crossing**, not by `global_seq`. Voids leave holes in the
  sequence, so nobody may hold seq exactly 1.000.000.
- **Combos are session-scoped** and unlock for every attendee. The route to a big badge is
  bringing another friend, not drinking more.

## Running things

```bash
./supabase/tests/run.sh           # apply migrations + assert behaviour
./supabase/tests/run.sh --fresh   # rebuild the throwaway cluster first
```

With Docker available, prefer the real thing — it provides `auth.users` and the Supabase
roles, which the bare-Postgres runner has to stub:

```bash
supabase start
supabase db reset                 # applies every migration from scratch
```

See `docs/LOCAL-SETUP.md`.

## Gotchas already paid for

- **Postgres refuses to run as root.** `run.sh` creates an unprivileged user and owns the
  cluster with it. Its data dir lives outside the scratchpad because sandbox tooling resets
  scratchpad permissions mid-run and kills the server.
- **Trigger names are numbered** (`beers_01_stamp_parents`, `beers_02_require_company`)
  because Postgres fires BEFORE triggers in alphabetical order and the stamping must run
  first.
- **The current tests bypass RLS.** They connect as the table owner, which is exempt. When
  the policies land, they need a test that connects as a non-owner role with a JWT claim,
  or they prove nothing.
- **RLS recursion.** A policy on `party_members` that queries `party_members` hangs. Use the
  `SECURITY DEFINER` helper `is_party_member(party_id)`.
- **RLS is currently on with zero policies**, which denies everything. That's deliberate —
  the schema fails closed if applied before the policy migration exists.

## Conventions

- Migrations are append-only once applied anywhere. The current one has never run against a
  real database, so editing it in place is still free — say so if that changes.
- Numbers in docs and UI use European formatting: `428.391`, `42,8%`.
- Every non-obvious decision goes in `docs/DECISIONS.md` as a new ADR with what it costs,
  not just what was chosen. Superseded ADRs are struck through and kept.
