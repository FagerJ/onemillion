# Decision log

Lightweight ADRs. Each decision records what was chosen, why, and what it costs.
Superseded decisions are kept, struck through — the history is the point.

---

## Settled

### D1 — The million is global, not per-crew
**Decided.** One shared counter across every user of the app. Crews and guilds are teams
inside it, not separate races.

*Why:* a crew of five produces ~1.300 beers/year. A per-crew million takes ~770 years —
the gauge would never visibly move, making it dead UI. Globally, ~10.000 semi-active
users reach a million in months.

*Cost:* cross-scope aggregation, a public stats surface, and anti-cheat becomes mandatory
rather than optional.

---

### D2 — Rolling milestones drive the primary gauge
**Decided.** The big ring shows progress toward the *next rung on the ladder*. A thin
secondary bar always shows `0 → 1.000.000` and never disappears.

*Why:* the next rung is always close enough to chase; the million is always visible enough
to matter. One gauge does dopamine, the other does ambition.

*Cost:* two progress systems to keep in sync, and milestone resolution has to be fast
enough to render on every dashboard load (solved by caching `next_milestone` on
`crew_stats`).

---

### D3 — Crews do not choose a goal
**Decided.** No configurable target. Everyone is on the same ladder, always climbing
toward the same million.

*Why:* a shared, non-negotiable goal is what makes cross-crew and cross-guild comparison
meaningful. Custom targets would fragment it.

---

### D4 — Guilds sit between crews and global
**Decided.** Hierarchy is `profile → crew → guild → global`. A crew belongs to at most one
guild. Football supporter clubs are the intended flavour.

*Why:* crews run out of ladder around 5.000. Guilds are the tier at which rungs like
100.000 become reachable, which is what stops the top half of the ladder being decorative.

*Cost:* a whole product surface (Phase 3) and a new class of leaderboard.

---

### D5 — One row per beer
**Decided.** The `+`/`−` tally UI expands to N rows on save. A `global_seq` column gives
every beer a permanent global number.

*Why:* "who drank beer number 1.000.000" is the entire payoff of the premise. A tally
column cannot answer it, and adding it later is a painful migration.

*Cost:* more rows (irrelevant at this scale — a million rows is small for Postgres).

---

### D6 — `guild_id` is snapshotted, not joined
**Decided.** Sessions and beers store the guild the crew belonged to *at log time*.

*Why:* a crew transferring guilds must not silently rewrite two guilds' historical totals
and every achievement derived from them.

*Cost:* denormalised column to keep correct on write.

---

### D7 — Achievements are data, not code
**Decided.** A closed vocabulary of rule types stored as `jsonb`, evaluated server-side in
Postgres.

*Why:* adding "Fergie Time" must not require an app store release. Server-side evaluation
is also the only way to keep a public competitive counter honest.

*Cost:* rule vocabulary must be designed up front; anything outside it needs a migration.

---

### D8 — Offline-first, in Phase 1
**Decided.** Durable local write queue with `client_uuid` idempotency keys.

*Why:* the app's primary venue is a pub, and pubs have no signal. Retrofitting is ~3× the
work.

*Cost:* celebrations become asynchronous — the RAMPAGE toast may fire in the taxi home.

---

### D9 — Alcohol-free beers count
**Decided.** `is_alcohol_free` flag; NA beer counts toward the million.

*Why:* the app should still work for someone taking a break rather than pushing them out.
Also makes "Clean Sheet" and "The Cake Is a Lie" possible.

*Cost:* purists may object that it dilutes the number. Mitigated by being able to filter
on it in stats.

---

### D10 — Supabase as backend
**Decided.** Postgres + Auth + Realtime + Storage, region `eu-north-1`.

*Why:* the aggregation and trigger workload is exactly Postgres's strength; Realtime gives
the live-ticking global counter; existing org already in that region.

---

## Open — blocking

These block Phase 0. Detail in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

| ID | Question | Blocks |
|---|---|---|
| **Q1** | Client stack: Expo (RN + web) vs Next.js PWA | F3, and every client task |
| **Q2** | What is "one beer"? Unit definition | F4, the meaning of the million |
| **Q3** | Guild join model — open, approval, or invite | U2 |
| **Q4** | v1 scope — which cut line from the roadmap | everything |

## Open — non-blocking

| ID | Question |
|---|---|
| Q5 | Can a person be in multiple crews? |
| Q6 | Pre-seeded club catalogue, user-created guilds, or both? |
| Q7 | Transfer windows — fun gimmick or needless friction? |
| Q8 | Retroactive logging and log editing — allowed, and how far back? |
| Q9 | Where does the multikill ladder stop? |
| Q10 | OVER 9000 — Dragon Ball Z or Star Wars visual treatment? |
| Q11 | Do achievement points do anything? |
| Q12 | Feed scope — crew only, guild, or global? |
| Q13 | Distribution — web link, TestFlight, or public app stores? |
