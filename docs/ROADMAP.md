# Roadmap

Status: **proposed order — needs your prioritisation.**

Every item has an ID. To reprioritise, just say e.g. *"move G1 into Phase 1, drop S3"*.

Estimates are rough build-effort, assuming decisions are already made.

---

## Phase 0 — Foundations

*Nothing works until this exists. Not negotiable, not reorderable.*

| ID | Item | Effort |
|---|---|---|
| F1 | Answer [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md); freeze decisions in [DECISIONS.md](DECISIONS.md) | — |
| F2 | Supabase project (eu-north-1), env/secrets management | S |
| F3 | Client scaffold + design tokens (palette, Anton/Space Grotesk) | M |
| F4 | Schema v1 migration: profiles, crews, crew_members, sessions, beers | M |
| F5 | RLS policies + `is_crew_member` SECURITY DEFINER helper | M |
| F6 | CI: lint, typecheck, migration check on PR | S |

---

## Phase 1 — The core loop

*A crew can log beers and see a number go up. If only this shipped, it would still work.*

| ID | Item | Effort |
|---|---|---|
| C1 | Auth: Apple + Google + magic link; profile creation | M |
| C2 | Create a crew / join by invite link | M |
| C3 | **Session logger** — friend chips, per-person `+`/`−` tallies, save | L |
| C4 | Counter roll-up triggers (`global_stats`, `crew_stats`, `profile_stats`) | M |
| C5 | **Crew dashboard** — dual gauge (milestone ring + 1M bar), stat cards | L |
| C6 | Crew leaderboard | S |
| C7 | Activity feed | M |
| C8 | **Offline write queue** + idempotent replay | L |
| C9 | Milestone ladder table + seed; "next milestone" resolution | S |

> C8 is in Phase 1 on purpose. Retrofitting offline is roughly 3× the work of building it
> in, and the app's primary venue has no signal.

---

## Phase 2 — The game layer

*This is what makes it a game rather than a spreadsheet.*

| ID | Item | Effort |
|---|---|---|
| G1 | Achievement engine: schema, rule vocabulary, `evaluate_achievements()` | L |
| G2 | Seed the catalogue (multikill + football + gaming) | M |
| G3 | Achievements screen (grid, locked/unlocked, progress bars) | M |
| G4 | **Live multikill toasts** — DOUBLE KILL → RAMPAGE during a session | M |
| G5 | Milestone celebration: full-screen takeover, "Golden Goal" attribution | M |
| G6 | Easter-egg rungs (442, 1337, 9001, 1966) | S |
| G7 | Sound design — announcer lines (optional, muted by default) | M |

> G4 and G5 are the emotional payload of the whole product. If Phase 2 gets cut for time,
> cut G3 and G7 before you cut these.

---

## Phase 3 — Guilds

*The tier that makes the big ladder rungs reachable.*

| ID | Item | Effort |
|---|---|---|
| U1 | Guild schema + `guild_id` snapshotting on sessions/beers | M |
| U2 | Guild create / browse / join (per chosen join policy) | M |
| U3 | Club catalogue seed (football clubs w/ crests + colours) | M |
| U4 | Guild dashboard — guild gauge, contributing crews | M |
| U5 | **Guild league table** — the Champions League standings view | L |
| U6 | Guild-scoped achievements + milestones | M |
| U7 | Transfer window mechanic (if adopted — see Q7) | M |

---

## Phase 4 — Social & retention

*Makes people come back without nagging them.*

| ID | Item | Effort |
|---|---|---|
| S1 | Push notifications — milestones, achievements, crew activity | L |
| S2 | Reactions on feed items | S |
| S3 | Beer photos (Storage + upload + feed rendering) | M |
| S4 | Venues — search, save, "Groundhopper" support | M |
| S5 | Beer types / catalogue (enables Perfect Hat-trick, Critical Hit) | M |
| S6 | Streaks + weekly recap | M |
| S7 | Guest attendees (drinking with non-users) | S |

> Hard product rule from [ARCHITECTURE.md §9](ARCHITECTURE.md#9-responsible-design): S1
> notifications celebrate what happened. They never nudge you to drink.

---

## Phase 5 — Scale & polish

| ID | Item | Effort |
|---|---|---|
| P1 | Anti-cheat: constraints, rate limits, outlier flagging | M |
| P2 | Public global counter page (no auth) — the shareable artefact | M |
| P3 | Home-screen widget (native only) | M |
| P4 | App Store / Play Store submission, 17+ rating, age gate | L |
| P5 | Load/perf pass on leaderboards + league table | M |
| P6 | Onboarding polish, empty states, first-run experience | M |

> P1 must ship **before** P2. A public counter without anti-cheat is an invitation.

---

## Suggested cut lines

**Thinnest thing worth showing friends:** Phase 0 + C1, C2, C3, C4, C5, C8.
A crew logs beers, the number goes up, it works in a pub with no signal.

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
