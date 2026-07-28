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

### D11 — Client is Expo (React Native) with web export
**Decided.** One codebase to iOS, Android and web via react-native-web.

*Why:* push notifications are the retention mechanic for this app, and a home-screen
widget showing the global counter tick up is a signature feature that a PWA can't do. The
web export still gives zero-friction sharing on day one.

*Cost:* react-native-web setup is more involved than a plain web app; native builds need
an Apple developer account ($99/yr); store review adds days to native releases.

---

### D12 — One tap = one beer; volume is optional metadata
**Decided.** The counter counts taps, so it is always a clean integer. `volume_ml` and
`abv` are recorded when offered but never required.

*Why:* keeps the scoreboard aesthetic intact (a million *beers*, not 428.391,4 litre-units)
while still enabling volume-dependent achievements — Route One, Tiki-Taka, Critical Hit —
and litres-drunk stats.

*Cost:* someone drinking halves all night scores the same as someone on pints. Accepted:
the number is a shared joke, not an audit.

---

### D13 — v1 = core loop + game layer
**Decided.** Phase 0, Phase 1 and the emotional core of Phase 2 (G1, G2, G4, G5). Guilds
(Phase 3) follow immediately after.

*Why:* the core loop alone works but isn't fun; the game layer is what makes it a game.
Guilds only become interesting once several crews are already active, so shipping to
friends first generates the very population guilds need.

---

### D14 — Achievement points rank the guild league table
**Decided.** Guild standings order on accumulated achievement points, not raw beer count.

*Why:* this is the highest-leverage decision in the product. Ranking on raw beers makes
the optimal strategy "drink more". Ranking on points makes it "drink varied, log
consistently, bring friends along" — a better game, and a materially better thing to be
incentivising.

*Cost:* points values across the catalogue now need balancing, and the ranking is less
immediately legible than a beer count. Mitigated by showing both figures on the table.

---

### D15 — Crew feed is the default; no global firehose
**Decided.** The activity feed shows your crew. A guild feed arrives as a second tab in
Phase 3. There is no global feed.

*Why:* a global firehose is noise and a moderation burden. Reverse if you disagree — it's
a cheap change in v1.

---

## Open — blocking

These block Phase 0. Detail in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

| ID | Question | Blocks |
|---|---|---|
| **Q5** | Can a person be in multiple crews? | C2, C5 navigation |
| **Q8** | Retroactive logging and editing — allowed, how far back? | F4 schema, C3 logger |
| **Q9** | Where does the multikill ladder stop? | G2 catalogue seed |
| **Q10** | OVER 9000 — Dragon Ball Z or Star Wars treatment? | G2 seed, art direction |

## Open — later phases

| ID | Question | Needed by |
|---|---|---|
| Q3 | Guild join model — open, approval, or invite | Phase 3 |
| Q6 | Pre-seeded club catalogue, user-created guilds, or both? | Phase 3 |
| Q7 | Transfer windows — fun gimmick or needless friction? | Phase 3 |
| Q13 | Distribution — web link, TestFlight, or public app stores? | Phase 5 |
| Q14 | Who else is following this repo? | — |

## Answered

| ID | Question | Outcome |
|---|---|---|
| ~~Q1~~ | Client stack | → D11, Expo + web export |
| ~~Q2~~ | What is "one beer"? | → D12, tap = 1, volume optional |
| ~~Q4~~ | v1 scope | → D13, core + game layer |
| ~~Q11~~ | Do achievement points do anything? | → D14, they rank the guild table |
| ~~Q12~~ | Feed scope | → D15, crew feed, no global firehose |
