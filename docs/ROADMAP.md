# Roadmap

Status: **v0 scoped** — smallest genuinely fun thing, no decision that damages guilds later.

Every item has an ID. To reprioritise, just say e.g. *"move U5 into v0, drop S3"*.

> ### 🍺 v0 — The Lads Build
> A working, fun app for one friend group. Everything beyond it is additive.
> See [the irreversibility analysis](#what-is-actually-irreversible) for why this is safe.

---

## What is actually irreversible

**Almost nothing.** Counters, badges, milestones, leaderboards, streaks and stats are all
*derived* from the `beers` table. One row per beer with correct parents means any aggregate
can be recomputed, and any deterministic achievement rule can be replayed over history to
backfill who earned what, at any point in the future.

So the whole "don't paint ourselves into a corner" problem reduces to getting **five tables**
right:

| Table | The bit that must be right now | Why it can't be fixed later |
|---|---|---|
| `parties` | `guild_id` **nullable** | The entire hook for guilds. One column. |
| `party_members` | a **join table**, not a column on `profiles` | A person in two parties is impossible to retrofit |
| `sessions` | `party_id`, `guild_id` nullable, `started_at timestamptz` + stored tz | Timezone is not derivable after the fact |
| `session_attendees` | exists at all | The only record of who was there but drank zero |
| `beers` | `party_id`, `guild_id` nullable, `profile_id`, `added_by`, `round_id`, `logged_at timestamptz`, `voided_at`, `client_uuid` | None of these can be reconstructed from anything else |

Two nullable `guild_id` columns and one join table cost nothing today and are the complete
path to guilds. A pre-guild beer correctly keeps `guild_id = null` forever — it was earned
before the party joined, which is exactly what
[D6](DECISIONS.md#d6--guild_id-is-snapshotted-not-joined) wants.

**Everything else is additive**: new tables, new screens, no painful migration. That
includes the achievement rule engine — the `achievement_unlocks` table is what matters, not
how clever the evaluator is. Start with a handful of hardcoded SQL checks and replace them
with the full `jsonb` vocabulary later; unlocks already recorded stay valid.

---

## Phase v0 — The Lads Build

*Ship this, drink some beers, see if it is fun.*

| ID | Item | Effort | Cut from the full plan |
|---|---|---|---|
| F2 | Supabase project (eu-north-1) | S | — |
| F3 | Expo scaffold + design tokens (palette, Anton/Space Grotesk) | M | — |
| F4 | Schema: the five tables above, with nullable `guild_id` | M | guild tables themselves |
| F5 | RLS: party-scoped + `is_party_member` helper | S | guild policies |
| C1 | Auth — magic link only | S | Apple + Google |
| C2 | Create a party · share the invite code · join by code | M | — |
| C3 | **Logger** — `+` per person, `+ ROUND`, `−` to correct | L | detail sheet (volume/ABV/type/photo) |
| C10 | Session start + manual close; stale sessions close on next open | S | the 06:00 `pg_cron` job |
| C11 | **Realtime tally** — everyone at the table watches it climb | M | — |
| C4 | Counter roll-ups: `party_stats`, `global_stats`, `profile_stats` | M | `guild_stats` |
| C9 | Milestone ladder table + seed | S | — |
| C12 | `milestone_events` — crossing attribution | S | — |
| C5 | **Dashboard** — milestone ring + the 1M bar + stat tiles | L | — |
| C6 | Party leaderboard (on the dashboard, not its own screen) | S | — |
| C7 | Feed — a list of closed sessions | S | reactions, photos |
| G4 | **Live combo toasts** — BRACE → HAT-TRICK → ON FIRE → … | M | — |
| G5 | **Milestone celebration** + Golden Goal attribution | M | — |
| G1' | `achievement_unlocks` table + a few hardcoded checks | S | the full `jsonb` rule engine |

**Deliberately out of v0, all additive:** every guild item (`U1`–`U7`), the full rule engine
and catalogue (`G1`, `G2`), achievements grid (`G3`), easter-egg rungs (`G6`), announcer
sound (`G7`), the durable offline queue (`C8` — but the `client_uuid` column ships now, so
adding the queue is client-side only), push (`S1`), reactions (`S2`), photos (`S3`), venues
(`S4`), beer types (`S5`), streaks and recaps (`S6`), and all of Phase 5.

> **The one thing v0 gives up that hurts:** no durable offline queue. Pubs have no signal,
> so some taps will fail and need retrying by hand. The `client_uuid` column is there from
> day one, which is the expensive half — so if it bites, `C8` is a self-contained client-side
> fix, not a migration.

---
## Phase 0 — Foundations *(full version, if v0 proves fun)*

*Nothing works until this exists. Not negotiable, not reorderable.*

| ID | Item | Effort |
|---|---|---|
| F1 | Answer [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md); freeze decisions in [DECISIONS.md](DECISIONS.md) | — |
| F2 | Supabase project (eu-north-1), env/secrets management | S |
| F3 | Client scaffold + design tokens (palette, Anton/Space Grotesk) | M |
| F4 | Schema v1 migration: profiles, parties, party_members, sessions, session_attendees, beers | M |
| F5 | RLS policies + `is_party_member` SECURITY DEFINER helper | M |
| F6 | CI: lint, typecheck, migration check on PR | S |

---

## Phase 1 — The core loop

*A party can log beers and see a number go up. If only this shipped, it would still work.*

| ID | Item | Effort |
|---|---|---|
| C1 | Auth: Apple + Google + magic link; profile creation | M |
| C2 | Create a party / join by invite code | M |
| C3 | **Session logger** — per-person `+`, `+ ROUND`, `−` corrections, detail sheet | L |
| C10 | **Session lifecycle** — start, attendees, close, 06:00 auto-close job | M |
| C11 | Realtime session sync — everyone at the table watches the tally climb | M |
| C4 | Counter roll-up triggers (`global_stats`, `party_stats`, `profile_stats`) | M |
| C5 | **Party dashboard** — dual gauge (milestone ring + 1M bar), stat cards | L |
| C12 | `milestone_events` — counter-crossing attribution, robust to voids ([D28](DECISIONS.md#d28-----is-a-soft-delete-milestones-attribute-by-counter-crossing)) | S |
| C6 | Party leaderboard | S |
| C7 | Activity feed | M |
| C8 | **Offline write queue** + idempotent replay | L |
| C9 | Milestone ladder table + seed; "next milestone" resolution | S |

> C8 is in Phase 1 on purpose. Retrofitting offline is roughly 3× the work of building it
> in, and the app's primary venue has no signal.

---

## Phase 2 — The game layer

*This is what makes it a game rather than a spreadsheet.*

| ID | Item | Effort | v1 |
|---|---|---|---|
| G1 | Achievement engine: schema, rule vocabulary, `evaluate_achievements()` | L | ✅ |
| G2 | Seed the catalogue (combos + football + gaming) | M | ✅ |
| G3 | Achievements screen (grid, locked/unlocked, progress bars) | M | |
| G4 | **Live combo toasts** — BRACE → HAT-TRICK → ON FIRE during a session | M | ✅ |
| G5 | Milestone celebration: full-screen takeover, "Golden Goal" attribution | M | ✅ |
| G6 | Easter-egg rungs (442, 1337, 9001, 1966) | S | |
| G7 | Sound design — announcer lines (optional, muted by default) | M | |

> G4 and G5 are the emotional payload of the whole product — hence their place in v1 ahead
> of the achievements screen itself. Badges you never see a celebration for are just rows
> in a table.

---

## Phase 3 — Guilds

*The tier that makes the big ladder rungs reachable.*

| ID | Item | Effort |
|---|---|---|
| U1 | Guild schema + `guild_id` snapshotting on sessions/beers | M |
| U2 | Guild create / browse / join (per chosen join policy) | M |
| U3 | Club catalogue seed (football clubs w/ crests + colours) | M |
| U4 | Guild dashboard — guild gauge, contributing parties | M |
| U5 | **Guild league table** — standings ranked on achievement points ([D14](DECISIONS.md#d14--achievement-points-rank-the-guild-league-table)) | L |
| U6 | Guild-scoped achievements + milestones | M |
| U7 | Transfer window mechanic (if adopted — see Q7) | M |

---

## Phase 4 — Social & retention

*Makes people come back without nagging them.*

| ID | Item | Effort | Note |
|---|---|---|---|
| S1 | Push notifications — milestones, achievements, party activity | L | |
| S2 | Reactions on feed items | S | |
| S3 | Beer photos (Storage + upload + feed rendering) | M | |
| S4 | Venues — search, save, "Groundhopper" support | M | |
| S5 | Beer types / catalogue (enables Perfect Hat-trick, Critical Hit) | M | |
| S6 | Streaks + weekly recap | M | |
| ~~S7~~ | ~~Guest attendees~~ | — | ❌ dropped — [D22a](DECISIONS.md#d22a--joining-a-party-requires-an-invite-code-supersedes-d22) requires an app account |

> Hard product rule from [ARCHITECTURE.md §9](ARCHITECTURE.md#9-responsible-design): S1
> notifications celebrate what happened. They never nudge you to drink.

---

## Phase 5 — Scale & polish

| ID | Item | Effort |
|---|---|---|
| P1 | Anti-cheat: rate limits + outlier flagging (mostly solved by the FK chain in [ARCHITECTURE §3.4](ARCHITECTURE.md#34-the-party-rule--enforced-in-the-database)) | S |
| P2 | Public global counter page (no auth) — the shareable artefact | M |
| P3 | Home-screen widget (native only) | M |
| P4 | App Store / Play Store submission, 17+ rating, age gate | L |
| P5 | Load/perf pass on leaderboards + league table | M |
| P6 | Onboarding polish, empty states, first-run experience | M |

> P1 must ship **before** P2. A public counter without anti-cheat is an invitation.

---

## Suggested cut lines

**Thinnest thing worth showing friends:** Phase 0 + C1, C2, C3, C4, C5, C8, C10.
Friends join your party with a code, you start a session, the number goes up, and it works
in a pub with no signal. C2 is non-negotiable — without the invite code nobody can legally
log a beer at all.

**Thinnest thing that's actually fun:** the above + G1, G2, G4, G5.
Now it shouts at you.

**Thinnest thing that matches the pitch:** the above + all of Phase 3.
Guilds are what make "ONE MILLION BEERS" a claim rather than a joke.

---

## Explicitly out of scope for now

Recorded so they don't creep in:

- Untappd-style beer ratings and reviews
- Bar/venue partnerships or any commercial layer
- Web3 / NFT anything
- Calorie or health tracking
- Public global social graph (following strangers)
