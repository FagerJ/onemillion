# Decision log

Lightweight ADRs. Each decision records what was chosen, why, and what it costs.
Superseded decisions are kept, struck through — the history is the point.

---

## Settled

### D1 — The million is global, not per-party
**Decided.** One shared counter across every user of the app. Parties and guilds are teams
inside it, not separate races.

*Why:* a party of five produces ~1.300 beers/year. A per-party million takes ~770 years —
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
`party_stats`).

---

### D3 — Parties do not choose a goal
**Decided.** No configurable target. Everyone is on the same ladder, always climbing
toward the same million.

*Why:* a shared, non-negotiable goal is what makes cross-party and cross-guild comparison
meaningful. Custom targets would fragment it.

---

### D4 — Guilds sit between parties and global
**Decided.** Hierarchy is `profile → party → guild → global`. A party belongs to at most one
guild. Football supporter clubs are the intended flavour.

*Why:* parties run out of ladder around 5.000. Guilds are the tier at which rungs like
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
**Decided.** Sessions and beers store the guild the party belonged to *at log time*.

*Why:* a party transferring guilds must not silently rewrite two guilds' historical totals
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
Guilds only become interesting once several parties are already active, so shipping to
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

### D15 — Party feed is the default; no global firehose
**Decided.** The activity feed shows your party. A guild feed arrives as a second tab in
Phase 3. There is no global feed.

*Why:* a global firehose is noise and a moderation burden. Reverse if you disagree — it's
a cheap change in v1.

---

### D16 — Backdating limited to today and yesterday
**Decided.** A session can be logged for today or yesterday only. Edit or delete within
24h. Deletes decrement counters but **never revoke already-unlocked achievements**.

*Why:* keeps the feed live and honest, makes streaks mean something, and closes the
easiest anti-cheat hole (bulk-importing an invented history). Revoking a badge someone has
already celebrated feels awful and is a griefing vector.

*Cost:* forget to log Saturday and by Monday it's gone. Accepted — the number is a shared
joke, not an audit.

---

### D17 — A person may belong to several parties; v1 ships one
**Decided.** The schema supports multi-party membership from day one. The v1 UI assumes a
single active party; the party switcher arrives when someone asks.

*Why:* attribution stays unambiguous either way (each beer → one session → one party → one
guild), so there's no migration risk in deferring the UI. Avoids putting a "which party?"
decision in front of every log while the app is still proving itself.

---

### D18 — No kill-streak language
**Decided.** The combo ladder is arcade-sports and football flavoured — BRACE, HAT-TRICK,
HEATING UP, ON FIRE, BOOMSHAKALAKA, SCREAMER, WORLDIE, RAMPAGE. No DOUBLE KILL, MONSTER
KILL, GODLIKE or WICKED SICK. `FIRST_BLOOD` becomes `KICK_OFF`.

*Why:* the announcer energy is the point, the violence isn't. NBA Jam and a football
commentator carry the same volume with none of the baggage — and they sit far more
naturally alongside the guild/supporter-club framing.

---

### D19 — No solo logging
**Decided.** A session requires **at least two attendees**. Enforced as a database
constraint, not a UI convention. You cannot log a beer you drank alone.

*Why:* the premise is *"log every beer with your party"* — this makes that structural
rather than aspirational. It also happens to be the single most meaningful responsible-design
choice available: solo drinking is the pattern worth not gamifying, and the app simply
has no representation for it.

*Cost:* real beers go unlogged, so the counter undercounts reality. That's a feature — it's
a count of *shared* beers. Open question on who qualifies as the second person (see Q16).

---

### D20 — Combos are session-scoped
**Decided.** Combo achievements count the **session total across everyone present**, and
unlock for **every attendee**. There is no per-person combo ladder.

*Why:* this inverts the incentive. Under a per-person ladder the route to a big badge is
"drink more". Under a party ladder it's "bring more people". Together with
[D14](#d14--achievement-points-rank-the-guild-league-table), the entire scoring system now
rewards socialising rather than volume — which is both a better game and a much better
thing to be encouraging.

*Cost:* thresholds are harder to tune, since they depend on typical session size. Mitigated
by achievements being data (D7) — retunable without a release.

---

### D21 — Two power-level badges, not one
**Decided.** `OVER_9000` at 9.001 gets the Dragon Ball Z scouter treatment.
`OFF_THE_CHART` at 20.000 gets Star Wars — the midi-chlorian reading from *The Phantom
Menace* ("over twenty thousand... even Master Yoda doesn't have a count that high").

*Why:* both are the same joke from different franchises, so they work better as a matched
pair at different rungs than as one muddled badge. And 20.000 is a genuinely canonical
number, not an invented one.

---

### ~~D22 — A party is a live, joinable session with an invite code~~
**Superseded by [D25](#d25--vocabulary-party-is-the-group-session-is-the-night) and
[D22a](#d22a--joining-a-party-requires-an-invite-code-supersedes-d22).**

Put a `join_code` on each *night out*. This was a misreading: "party" meant the group of
friends all along, so the code belongs on party membership, not on the evening. Kept here
because the reasoning that produced it — that the second person must be a verified account,
not a typed name — survived intact into D22a.

---

### ~~D23 — Attribution follows the drinker, not the host~~
**Superseded by [D23a](#d23a--sessions-live-inside-one-party-supersedes-d23).**

Split attribution (drinker's party) from context (the session) so a night could span
several parties. Once outsiders join your *party* instead of your *evening*, cross-party
sessions can't happen and the machinery is unnecessary. Deleted rather than kept — the
simple chain is better.

---

### ~~D24 — Party membership is enforced by foreign key~~
**Folded into [D22a](#d22a--joining-a-party-requires-an-invite-code-supersedes-d22).**

Still true, now as a two-link chain: `beers → session_attendees → party_members`. See
[ARCHITECTURE §3.4](ARCHITECTURE.md#34-the-party-rule--enforced-in-the-database).

---

### D25 — Vocabulary: Party is the group, Session is the night
**Decided.** A **Party** is the persistent group of friends, joined with an invite code. A
**Session** is one night out inside a party. A **Guild** is many parties.

*Why:* this was the user's vocabulary from the first message ("one party (group of
friends) can join together in a Guild"). Earlier drafts renamed it "Party" and then reused
"Party" for a night out, which collided and produced a per-night join code nobody asked
for.

*Supersedes:* D22 and D23 in their original form — see D22a and D23a below.

*Cost:* a rename across every document and the not-yet-written schema. Cheap now,
expensive after the first migration.

---

### D22a — Joining a party requires an invite code *(supersedes D22)*
**Decided.** To drink with someone they must (1) have the app and (2) join your **party**
with its invite code. Then they can attend sessions. There are no guest attendees and no
per-session join codes.

*Why:* the code belongs on the durable thing. Party membership is the persistent
relationship worth proving; a session is just an evening. One code, one join, and
everything after it is one tap.

*Cost:* real, and worth naming. Your first night out requires everyone at the table to
download something. Beers with non-app friends can never be logged, and the app is useless
to a lone early adopter. Biggest adoption risk in the design, accepted deliberately in
exchange for the number meaning something.

---

### D23a — Sessions live inside one party *(supersedes D23)*
**Decided.** A session belongs to exactly one party; all its beers credit that party and
its guild. The `beer → session → party → guild` chain is restored.

*Why:* D22a routes outsiders through party membership, so cross-party sessions never
occur. The drinker-scoped attribution machinery in D23 solved a problem that no longer
exists, and the simple chain is easier to reason about, index and audit.

*Note:* a person in several parties still has an unambiguous total — each beer belongs to
exactly one session, hence exactly one party.

---

### D26 — Anyone in a session can log for anyone
**Decided.** Once a session is open, any attendee can tap `+` for any other attendee, or
`+ ROUND` to add one beer to everyone at once. `−` corrects mistakes. Every beer records
`added_by`.

*Why:* rounds are bought *for* people — pure self-logging fights the actual behaviour and
strands anyone who's left their phone in a pocket. Shared logging with a visible audit
trail matches how a table actually works, and among friends the social cost of a bad edit
is enough enforcement.

*Cost:* a griefing vector in principle. Mitigated by attribution (`added_by`, `voided_by`)
and by the fact that parties are invite-only groups of friends.

---

### D27 — Sessions auto-close at 06:00 local
**Decided.** Any attendee may close a session; anything still open at 06:00 local time
closes itself.

*Why:* people forget. Nobody wants Tuesday's pint landing in Saturday's session, and an
indefinitely open session makes combo totals meaningless.

---

### D28 — `−` is a soft delete; milestones attribute by counter-crossing
**Decided.** `−` sets `voided_at` rather than deleting the row. Counters exclude voided
beers. Milestone attribution comes from `milestone_events` recorded when the live counter
crosses a rung — **not** from `global_seq`.

*Why:* voiding leaves holes in `global_seq`, so nobody may hold sequence number exactly
1.000.000. Attributing the millionth beer by sequence would make the single most important
number in the app unattributable. Counter-crossing events are robust to voids; `global_seq`
stays as flavour ("you drank beer #428.391").

*Cost:* two mechanisms where a naive design has one.

---

## Open — blocking

Raised during review of the completed design; all touch the v1 schema or seed data.

| ID | Question | Blocks |
|---|---|---|
| **Q21** | Daily streak badge rewards daily drinking — weeks instead? | F4, G2 |
| **Q22** | What stops a 200-person party farming combos? | F4, G2 |
| **Q23** | Account deletion vs. the immutable global counter (GDPR) | F4 |

## Open — later phases

| ID | Question | Needed by |
|---|---|---|
| Q3 | Guild join model — open, approval, or invite | Phase 3 |
| Q6 | Pre-seeded club catalogue, user-created guilds, or both? | Phase 3 |
| Q7 | Transfer windows — fun gimmick or needless friction? | Phase 3 |
| Q13 | Distribution — web link, TestFlight, or public app stores? | Phase 5 |
| Q14 | Who else is following this repo? | — |
| Q15 | Are the combo thresholds right for typical session sizes? | post-launch tuning |
| Q24 | Does the guild league table have seasons? | Phase 3 |
| Q25 | Party captain powers; what happens when someone leaves | F4 (needs `left_at`) |
| Q26 | Session timezone, week start, beer-type vocabulary | F4 |

## Answered

| ID | Question | Outcome |
|---|---|---|
| ~~Q1~~ | Client stack | → D11, Expo + web export |
| ~~Q2~~ | What is "one beer"? | → D12, tap = 1, volume optional |
| ~~Q4~~ | v1 scope | → D13, core + game layer |
| ~~Q5~~ | Multiple parties per person? | → D17, schema yes, v1 UI single |
| ~~Q8~~ | Retroactive logging and editing | → D16, today + yesterday, 24h edits |
| ~~Q9~~ | Where does the combo ladder stop? | → D18/D20, party-scoped, no kill language |
| ~~Q10~~ | OVER 9000 — DBZ or Star Wars? | → D21, both, at 9.001 and 20.000 |
| ~~Q11~~ | Do achievement points do anything? | → D14, they rank the guild table |
| ~~Q12~~ | Feed scope | → D15, party feed, no global firehose |
| ~~Q16~~ | Who counts as the second person? | → D22a, an app user who joined your party by code. No guests |
| ~~Q17~~ | Does the other person confirm? | → D22a, joining the party *is* the confirmation |
| ~~Q18~~ | Who logs the beers? | → D26, anyone for anyone, plus `+ ROUND` |
| ~~Q19~~ | When does a session close? | → D27, manual with 06:00 local auto-close |
| ~~Q20~~ | Party mates and codes | → D22a/D25, the code joins a *party*, not a session |
