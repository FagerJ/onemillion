# Session handoff — paste this into your local Claude Code chat

> **History.** Written on 2026-10-02 to carry the cloud session over to a local one, and
> kept for its record of what was reversed and why. Where things stand now is in
> [CLAUDE.md](../../CLAUDE.md) and the [roadmap](../ROADMAP.md).

Everything below is context from a cloud session that designed and started building this
project. The repo already contains `CLAUDE.md` and `docs/`, which cover the design. This
file is the **session memory**: the things that happened, the reversals and why, and what
the recommendations I built on were — none of which is obvious from the committed docs.

Branch: `claude/million-beers-architecture-inbc70` · 12 commits · no PR · `main` has only
the initial commit.

---

## 1. What this is

A social beer-logging app for a friend group, built around one absurd shared goal:
**1.000.000 beers**. It came from a meme. The owner wants a genuinely fun app for his mates
first, and the option to grow it later — explicitly: *"I want a FUN app for me and my
friends, and if we decide to go further, then we can do that"* — **without** making
decisions now that break the guild system later.

Originating design mockup (4 screens, palette, fonts):
https://claude.ai/code/artifact/3e78a2db-205a-4052-961f-b9d5f047b80b

Journeys + story map I drew from the design:
https://claude.ai/artifact/4LTZV3XhUSWHSDc2rFp8jE

## 2. Vocabulary — this caused two rounds of wrong design

| Term | Means |
|---|---|
| **Party** | The persistent group of friends. Joined with an invite code. |
| **Session** | One night out, inside a party. |
| **Guild** | Many parties under one banner (football supporter clubs). Phase 3. |
| **Round** | One tap adding a beer to every attendee at once. |

The owner said "party" for the group from his first message. I renamed it "Crew" and reused
"Party" for the night out. That collision made me invent a per-night join code nobody asked
for, which forced a cross-party attribution model, which I then had to delete. See the
struck-through D22/D23/D24 in `docs/DECISIONS.md`. **Do not reintroduce "Crew".**

## 3. The insight that shaped the plan

Counters, badges, milestones, leaderboards, streaks and stats are **all derived from the
`beers` table**. One row per beer with correct parents means any aggregate can be recomputed,
and any deterministic achievement rule can be replayed over history to backfill unlocks.

So "don't break guilds" reduces to five tables getting their columns right, plus:

- nullable `guild_id` on `parties`, `sessions`, `beers` (no FK yet — that's the whole hook)
- `party_members` as a **join table**, never a column on profiles
- `session_attendees` existing at all (the only record of who drank zero)
- `timestamptz` everywhere, plus a stored session timezone (not derivable later)

Everything else is additive. Written up in `docs/ROADMAP.md` → "What is actually
irreversible". This is why v0 is 18 items instead of 35.

## 4. What is built

**`supabase/migrations/20261002120000_schema.sql`** — the five tables, tested, never applied
to any real database. Editing it in place is still free.

**`supabase/tests/schema_test.sql` + `run.sh`** — 14 behavioural assertions, all passing:
solo drinker refused, second attendee unlocks logging, party/guild stamping, cross-logging
allowed, can't log for a non-attendee, voids keep the row, void requires `voided_by`, one
open session per party, closed session refuses beers, closed requires `closed_at`, departed
member can't rejoin but history survives, party cap enforced, `client_uuid` replay
idempotent, `global_seq` always assigned.

**Not built:** RLS policies, counter roll-ups, milestones + combo engine, the Expo app.

## 5. Decisions I made on recommendations, not answers

`docs/QUESTIONS.md` is **unanswered**. The owner said he'd fill it in. I said I'd take my
recommendations in the meantime, and the schema now bakes these in. **Any of them may be
overruled — the migration has never run, so changing it is free.**

| | Baked into the schema |
|---|---|
| A1 | No-solo-logging strict from day one (strict→relaxed is one line; the reverse is impossible) |
| A2 | Magic-link auth only for v0 |
| B1 | Streaks count **weeks**, not days — a daily streak badge rewards drinking daily, which fights every other incentive in the design |
| B2 | `parties.max_members` default **30** |
| B3 | GDPR erasure anonymises in place, keeps beer rows, so the counter can never fall |
| B4 | `party_members.left_at`, never a delete |
| B5 | Session stores its own timezone; week starts Monday |

## 6. One decision I had to make unprompted — D30

`ARCHITECTURE.md` specified the Party Rule as a deferred constraint trigger on `sessions`
("a session must have ≥2 attendees"). **That cannot work.** A deferred check runs at COMMIT,
so a session created with only its host could never be committed, and "start a session,
friends join" is impossible.

I moved it to a `BEFORE INSERT` trigger on `beers`. Truer to intent too — the rule is *no
solo logging*, not *no briefly-empty session*. Side effect: an empty session can exist in
the data. It holds no beers and counts for nothing.

Recorded as D30, flagged as question **A7** for the owner to sanity-check.

## 7. Gotchas already paid for

- **The current tests prove nothing about RLS.** They connect as the table owner, and owners
  are exempt from row-level security. All 14 assertions would pass just as happily against
  wide-open policies. When policies land they need a non-owner role with a JWT claim.
- **RLS is currently ON with zero policies**, which denies everything. Deliberate — the
  schema fails closed if applied before the policy migration exists. A client will get empty
  results until then. Don't read it as a bug.
- **RLS recursion:** a policy on `party_members` that queries `party_members` hangs. Needs
  the `SECURITY DEFINER` helper `is_party_member(party_id)`.
- **Trigger names are numbered** (`beers_01_stamp_parents`, `beers_02_require_company`)
  because Postgres fires BEFORE triggers in alphabetical order and stamping must run first.
- **Postgres won't run as root** — `run.sh` creates an unprivileged user. You probably won't
  need `run.sh` locally; use `supabase db reset` instead.
- **Docker Hub rate-limits the shared cloud IP.** I worked around it with
  `{"registry-mirrors": ["https://mirror.gcr.io"]}` in `/etc/docker/daemon.json`. You almost
  certainly don't need this locally, but it's there if you ever hit 429s.

## 8. Loose end

I ran `supabase init --force`, which generated `supabase/config.toml` (Postgres major
version 17) and `supabase/.gitignore`. **Both are uncommitted** — I was interrupted before
`supabase start` finished. Decide whether to commit them locally; standard practice is yes
for `config.toml`.

## 9. Product rules worth not breaking

These came from the owner directly and several are load-bearing:

- **You cannot log a beer alone.** It's the app's identity, not a validation rule.
- **Combos are session-scoped** and unlock for every attendee — so the way to a big badge is
  bringing another friend, not drinking more. Combined with ranking the guild table on
  achievement points rather than beer count, the whole scoring system points at socialising
  rather than volume. That emerged across three separate answers and is the best thing about
  the design.
- **No kill-streak language.** He asked for gaming + European football references but
  explicitly rejected "KILL" wording. Ladder is BRACE → HAT-TRICK → HEATING UP → ON FIRE →
  BOOMSHAKALAKA → SCREAMER → WORLDIE → RAMPAGE. NBA Jam announcer crossed with a football
  commentator.
- **Two power-level badges:** `OVER_9000` at 9.001 (Dragon Ball Z, Vegeta's scouter) and
  `OFF_THE_CHART` at 20.000 (Star Wars midi-chlorians — he spotted the parallel himself).
- **The counter undercounts reality on purpose.** It counts *shared* beers.
- Numbers use European formatting: `428.391`, `42,8%`.

## 10. Next steps, in order

1. **`F5` RLS policies** — party-scoped, `is_party_member` SECURITY DEFINER helper. Depends
   on no open question, so it can start immediately. Needs a non-owner test role.
2. **`C4` counter roll-ups** — `party_stats`, `global_stats`, `profile_stats` triggers.
   Affected by B1 (streak units).
3. **`G1'`/`G4`/`G5`** — `achievement_unlocks` table, a few hardcoded combo checks,
   milestone crossing events, the celebration payloads.
4. **`F3`, `C1`–`C11`** — the Expo app. Dashboard with the dual gauge (next-milestone ring
   plus the always-present 0→1.000.000 bar), session logger with `+` / `+ ROUND` / `−`,
   realtime tally, combo toasts, feed.

The owner's biggest open risk, stated in D22a: requiring everyone at the table to have the
app means the first night out is a recruitment drive, and a lone early adopter can't use it
at all. Accepted deliberately, but worth watching in week one.

## 11. Suggested opening message for the local session

> Read `CLAUDE.md`, `docs/SESSION-HANDOFF.md` and `docs/QUESTIONS.md`. We're at the start of
> v0: the schema migration is written and tested, RLS policies are next. I haven't answered
> QUESTIONS.md yet — don't block on it, section B answers are already baked into the schema
> on your recommendations and can be changed freely since the migration has never run.
