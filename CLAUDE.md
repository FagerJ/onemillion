# ONE MILLION BEERS — working notes

A social beer-logging app for a group of friends, built around one shared goal:
1.000.000 beers. See `README.md` for the concepts and `docs/` for the design.

**Read first:** `docs/SESSION-HANDOFF.md` (session memory — what was reversed and why,
which recommendations are baked into the schema), `docs/DECISIONS.md` (42 ADRs — what's settled and why),
`docs/ROADMAP.md` (v0 scope + the irreversibility analysis), `docs/QUESTIONS.md`
(open questions awaiting the owner's answers).

## Where things stand

- **Design: done.** 42 decisions recorded. Architecture, roadmap, achievement catalogue,
  user journeys and story map all written.
- **Schema: written and tested.** `supabase/migrations/20261002120000_schema.sql` — the five
  irreducible tables plus the `beer_types` lookup.
- **RLS: written and tested** (`F5`, D39). `supabase/migrations/20261006120000_rls.sql` —
  policies, column grants, and the membership/lifecycle functions (`create_party`,
  `join_party`, `close_session`, …). `rls_test.sql` checks them as real signed-in users.
- **Counters: written and tested** (`C4`, D40). `supabase/migrations/20261006130000_stats.sql`
  — trigger-kept totals in `global_stats` / `party_stats` / `profile_stats`, and
  `profile_summary()` / `party_summary()` for this-week figures and weekly streaks.
- **Session lifecycle: written and tested** (`C10`, D41).
  `supabase/migrations/20261006140000_session_lifecycle.sql` — `pg_cron` closes overdue
  nights every 5 minutes and purges lonely sessions nightly; opening a night closes the
  party's stale one; D16's today-or-yesterday window is enforced for the app.
- **Every question that blocks v0 is answered** (QUESTIONS.md, D31–D38). Venues are out of
  v0 again. English UI behind a translation layer. Ships to Android as an app and to iPhones
  as a web app — no App Store yet. Guilds are parked (QUESTIONS.md D5).
- **App: first version running** (D42). `app/` — React + Vite + TypeScript, Tailwind v4,
  shadcn/ui (Radix), TanStack Query, React Router, motion, i18next. Sign-up/in, profile,
  create/join party, kick-off, + / + ROUND / −, live updates, home, feed, party, me.
  `supabase/migrations/20261007120000_app_reads.sql` adds `party_leaderboard()`,
  `party_feed()` and the Realtime publication. `supabase/seed.sql` loads a demo party.
- **Not started:** milestones + combo engine, achievements, the offline queue, PWA install
  (manifest/icons — needs hosting for HTTPS anyway). Nothing has been applied to a hosted
  Supabase project; none exists yet.
- **Everything is on `main`** (merged 2026-10-09, so the repo can be shared). The owner
  shares it with friends, so `main` should always run: do new work on a branch and merge
  when it's tested.

## Vocabulary — get this right

| Term | Means |
|---|---|
| **Party** | The persistent group of friends. Joined with an invite code. |
| **Session** | One night out, inside a party. Has attendees and beers. |
| **Guild** | A banner many people drink under. Phase 3, not built. Whether *parties* or *people* join is undecided — QUESTIONS.md D5. Don't build anything that assumes either. |
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
  `beers.guild_id` is the one that matters: it works whichever guild model is chosen. The
  `parties`/`sessions` columns only matter if parties end up joining guilds.
- **`−` voids, never deletes.** Counters exclude voided rows; achievements are never revoked.
- **Milestones attribute by counter-crossing**, not by `global_seq`. Voids leave holes in the
  sequence, so nobody may hold seq exactly 1.000.000.
- **Combos are session-scoped** and unlock for every attendee. The route to a big badge is
  bringing another friend, not drinking more.

## Running things

The owner works on **Windows 11** with Docker Desktop and the Supabase CLI via `npx`
(no global install). The local stack is the primary way to test:

```bash
npx supabase start                    # once per boot; Docker Desktop must be running
./supabase/tests/run-supabase.sh      # db reset from migrations, then every *_test.sql
./supabase/tests/run-supabase.sh --no-reset
```

Tests run inside `begin … rollback`, so they leave the dev database clean. Studio is at
http://127.0.0.1:54323.

The app (see `docs/LOCAL-SETUP.md` § 4½):

```bash
npm --prefix app run dev              # http://localhost:5173 — demo logins in supabase/seed.sql
npm --prefix app run build            # type-check + build
```

In Claude Code, `.claude/launch.json` starts the same dev server in the browser pane. A
pane that is open but not on screen paints no animation frames, so motion freezes on its
first frame — add `?raf-shim` to the URL (dev only; see `app/vite.config.ts`).

`./supabase/tests/run.sh` is the bare-Postgres fallback from the cloud session. It is
Linux-only (`useradd`, `su`), so it won't run here. See `docs/LOCAL-SETUP.md`.

## Gotchas already paid for

- **Real `auth.users.id` has no default.** Fixtures must insert
  `(id) values (gen_random_uuid())`; the bare-Postgres stub hid this.
- **Docker isn't on PATH** in shells started before Docker Desktop was installed. Scripts
  fall back to `/c/Program Files/Docker/Docker/resources/bin`.
- **Line endings.** Git for Windows has `core.autocrlf=true`; `.gitattributes` pins `*.sh`
  and `*.sql` to LF, because a CRLF script fails in bash.
- **Postgres refuses to run as root.** `run.sh` creates an unprivileged user and owns the
  cluster with it. Its data dir lives outside the scratchpad because sandbox tooling resets
  scratchpad permissions mid-run and kills the server.
- **Trigger names are numbered** (`beers_01_stamp_parents`, `beers_02_require_company`)
  because Postgres fires BEFORE triggers in alphabetical order and the stamping must run
  first.
- **`schema_test.sql` bypasses RLS** — it runs as the table owner, which is exempt. Access
  checks sign in with `test_helpers.sign_in(uuid)` (the `authenticated` role plus a JWT
  `sub`), defined in `supabase/tests/helpers.sql`, which both runners load before every
  `*_test.sql`. When adding a rule, break it once on purpose and check a test fails, or the
  test proves nothing.
- **Upserts check the insert row first.** `insert … on conflict do update` with a value that
  breaks a CHECK constraint fails even when the row exists — Postgres validates the
  proposed insert before looking for the conflict. Decrement counters with a plain `update`.
- **RLS recursion.** A policy on `party_members` that queries `party_members` hangs. Use the
  `SECURITY DEFINER` helpers (`is_party_member`, `is_party_captain`, `is_session_attendee`,
  `shares_party_with`).
- **`set search_path` on every function.** The `SECURITY DEFINER` functions run with an
  empty search_path, and triggers fired inside them inherit it. A trigger function without
  its own `set search_path = public` fails with "relation does not exist".
- **New tables start locked.** Supabase grants everything to `anon`/`authenticated` by
  default; the RLS migration revokes it and grants back column by column. A new table needs
  its own `revoke`, `grant`, `enable row level security` and policies.

## App conventions

- **Design language** (D42): stout-black and gold, Anton for numbers/headlines (uppercase,
  `.display`), Space Grotesk for UI, dark only. People are bottle caps (`Cap`), the
  milestone gauge is a pint (`PintGauge`), big counts sit on flaps (`FlapNumber`), cards
  are beer mats (`.mat`). Tokens live in `app/src/index.css`. Reuse these; don't add a
  second visual vocabulary.
- **Every string goes through i18next** (`app/src/i18n/en.ts`, typed keys) — no literals in
  JSX, including aria-labels and placeholders.
- **Data access lives in `app/src/data/queries.ts`.** Party-scoped query keys start with
  `['party', id]` so one Realtime event refreshes a party. Columns that BEFORE triggers stamp
  (`party_id`, `closes_at`, `timezone`) are left out of inserts — clients aren't granted them.
- **Regenerate DB types** after a migration:
  `npx supabase gen types typescript --local --schema public > app/src/lib/database.types.ts`.
- No `crypto.randomUUID` or clipboard without a fallback: a phone on the LAN dev server
  is not a secure context. Use `lib/uuid.ts`.

## Conventions

- Migrations are append-only once applied anywhere. The current ones have only run against
  throwaway local databases, so editing them in place is still free — say so if that changes.
- Numbers in docs and UI use European formatting: `428.391`, `42,8%`.
- Every non-obvious decision goes in `docs/DECISIONS.md` as a new ADR with what it costs,
  not just what was chosen. Superseded ADRs are struck through and kept.
