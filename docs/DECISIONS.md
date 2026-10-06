# Decision log

Lightweight ADRs. Each decision records what was chosen, why, and what it costs.
Superseded decisions are kept, struck through — the history is the point.

---

### D36 — Single-attendee sessions are purged after 7 days
**Decided** (owner, A7). A session that never got a second attendee is deleted once it is
closed and more than 7 days old. Runs alongside the auto-close job (`C10`). Not built yet.

*Why:* [D30](#d30--the-party-rule-is-enforced-on-beers-not-on-sessions) lets a session hold
one person while friends arrive, so abandoned ones accumulate. They are clutter in the feed
and in every query that walks sessions.

*Cost:* the only hard delete in the design. Safe because such a session cannot hold a beer:
the `beers` trigger refuses any beer in a session with fewer than two attendees. A session
with two or more attendees and zero beers is **kept** — it is the record of who showed up
(`ACE` needs it).

---

### D39 — Access rules: read tables directly, change membership through functions
**Decided.** Row level security (`F5`), in `supabase/migrations/20261006120000_rls.sql`:

- Clients **read** tables directly. You see your parties, their members (past ones
  included), their sessions and beers, and your own beers even after leaving.
- Clients **write** directly only where the row itself says who may: your own profile,
  starting a session, checking yourself in (or adding a party-mate once you're there),
  logging a beer in your own name, voiding one within 24 hours, skipping rounds, and a
  captain renaming the party.
- **Membership and lifecycle** go through functions: `create_party`, `join_party`,
  `leave_party`, `remove_member`, `promote_member`, `regenerate_invite_code`,
  `close_session`.
- **Column grants** back the policies: no client can write `global_seq`, `party_id`,
  `status` or `max_members`. Signed-out visitors get nothing.

Calls made where the docs were silent — each is a line to change if the owner disagrees:

- Someone who left, or was removed, can rejoin with the current invite code. To keep
  someone out, a captain regenerates the code.
- If the last captain leaves, the longest-standing member becomes captain.
- Attendees can't be removed in v0. Someone added by mistake stays, with zero beers.
- The party cap can't be changed from the app.

*Why:* reading is the common case, and Supabase's API reads tables directly. The risky
writes are state changes — joining, leaving, closing — and RLS can't compare a row's old
value with its new one, so those go through functions that can.

*Cost:* seven functions to maintain beside the policies. `join_party` lets anyone signed in
guess invite codes (32⁶ ≈ 1 billion of them) with no rate limit yet. `logged_at` is
client-writable so offline taps keep their time; sanity bounds on it come with `C8`.
Anyone at the table can add any party-mate, who then shares the night's combos — the risk
D22a already accepted.

*Verified:* `supabase/tests/rls_test.sql` runs 44 assertions as real signed-in users, the
way the app's requests arrive. Each policy was loosened on purpose to confirm a test fails.

---

### D38 — v0 ships to Android as an installable app and to iPhones as a web app
**Decided** (owner, A3 + F4). Android friends install a real app from a download link
(an Expo internal-distribution build, no Play Store). Everyone else, iPhones included, uses
the web build. No App Store and no TestFlight until v0 has proved fun.

*Why:* the owner wants a real app, but not the Apple Developer account (99 USD/year) or
store review yet. Expo builds Android and web from the same code
([D11](#d11--client-is-expo-react-native-with-web-export)), so TestFlight later is a build
target, not a rewrite.

*Cost:* iPhone users get the web app. They should add it to the home screen — Safari can
clear a website's stored data after a few weeks unused, which would lose queued offline taps
(`C8`); home-screen web apps keep theirs. Android installs from outside the Play Store need
"install unknown apps" allowed once per phone.

---

### D37 — The app is in English, with every string translatable
**Decided** (owner, F6). All UI text is English. Every user-facing string goes through a
translation layer from the first screen, so Swedish later is a translation file, not a
rewrite. Badge names stay English in any language.

*Why:* the announcer voice (BOOMSHAKALAKA, WORLDIE, HAT-TRICK) is English football
commentary, and retrofitting translation onto hard-coded strings means touching every
screen.

*Cost:* every string is a key lookup instead of a literal — slightly slower to write.
Number formatting is fixed to the European style (`428.391`, `42,8%`) regardless of
language.

---

### D35 — v0 pulls back in achievements, the offline queue and streaks
**Decided** (owner, A6). Added to v0: the achievement engine and catalogue (`G1`, `G2`),
the achievements grid (`G3`), the durable offline queue (`C8`) and weekly streaks (the
streak half of `S6`; the recap stays out).

*Amended 2026-10-06 (owner, F3):* venues (`S4`) were pulled in too, then deferred again.

*Why:* the owner's call. `C8` was already flagged as "the one thing v0 gives up that hurts",
and achievements are most of the fun.

*Cost:* v0 gains four items and the minimal `G1'` grows into the full `G1` — roughly 40%
more work than the original cut. None of it touches the five irreducible tables, so the D29
safety argument still holds.

---

### D34 — `beer_type` is a curated list, no free text
**Decided** (owner, B5). `beers.beer_type` references a `beer_types` lookup table seeded
with lager, pilsner, pale ale, IPA, wheat, stout, porter, sour and other. Free text is
refused.

*Why:* typos fragment the data, which makes every type-based achievement
(`PERFECT_HAT_TRICK`, `LOOT_DROP`) unreliable. A lookup table rather than an enum, because
adding a type is an insert and an enum value can never be removed.

*Cost:* nobody can log a beer by name. `other` catches what doesn't fit and is ignored by
distinct-type achievements, so it can't be farmed. The list is a first guess; editing it is
data, not a migration.

---

### D33 — Parties are capped at 50 members
**Decided** (owner, B2). `parties.max_members` defaults to 50 (30 was recommended). Enforced
by a trigger on `party_members`.

*Why:* caps how far one `+ ROUND` can inflate a session total, which keeps combos from being
farmed by sheer headcount. 50 leaves room for the owner's 10+ group to grow.

*Open:* the owner also picked "scale thresholds by attendee count" and "big parties are
legitimately impressive", which pull in opposite directions. Follow-up F1 in QUESTIONS.md.

---

### D32 — Sessions auto-close at 09:00 the morning after, in the creator's timezone *(supersedes D27)*
**Decided** (owner, B5). Each session stores the creator's timezone and a `closes_at`,
stamped at insert: 09:00 local on the morning after the session's night. A session started
before 06:00 belongs to the night before. Any attendee can still close it earlier.

*Why:* the owner moved the close from 06:00 to 09:00 the next morning. The 06:00 night
boundary exists so a session started between 06:00 and 09:00 doesn't close within minutes.
Storing `closes_at` on the row makes the close job a one-line `update` and lets the UI say
when the night ends. The timezone has to be stored anyway because it can't be derived later.

*Cost:* a session can run up to 27 hours (started at 06:00), and at least 3 (started at
05:59). Changing the rule later doesn't move `closes_at` on existing sessions, which is
intended.

*Verified:* `schema_test.sql` covers an evening start, an after-midnight start, a breakfast
start, an explicit timezone overriding the creator's, and the night summer time ends.

---

### D31 — Sign-in is email and password, with magic link as well
**Decided** (owner, A2). Users sign up with email and password, and can also sign in by
magic link. Both are built-in Supabase Auth email flows. Apple and Google stay deferred.

*Why:* the owner's call. Magic link alone was recommended on the grounds that nobody types a
password in a pub, but sign-up happens once and the session then persists, so it barely
applies.

*Cost:* v0 needs a set-password screen and a reset-password flow, so `C1` grows from S to M.
Supabase stores and hashes the passwords; our code never handles them.

---

### D30 — The Party Rule is enforced on `beers`, not on `sessions`
**Decided.** The "at least two people" check is a `BEFORE INSERT` trigger on `beers`,
which refuses any beer whose session has fewer than two attendees. `sessions` itself
carries no minimum.

*Why:* [ARCHITECTURE §3.4](ARCHITECTURE.md#34-the-party-rule--enforced-in-the-database)
originally specified a deferred constraint trigger on `sessions`. That cannot work with the
real flow — you start a session, then friends are added. A deferred check runs at COMMIT, so
a session created with only its host could never be committed, and "start a session and wait
for the others" would be impossible.

Moving the check to `beers` is truer to the intent anyway: the rule we care about is *no
solo logging*, not *no briefly-empty session*. A session holding one attendee while people
arrive is fine; the first beer is what requires company.

*Cost:* an empty or single-attendee session can exist in the data. Harmless — it holds no
beers, contributes nothing to any counter, and is tidied when closed.

*Verified:* `supabase/tests/schema_test.sql` asserts a solo drinker is refused and that
adding a second attendee unlocks logging.

---

### D29 — Build v0 for one friend group; defer everything additive
**Decided.** Ship the smallest genuinely fun version for a single party, and defer every
feature that can be added later without a painful migration.

*Why:* the irreversibility analysis in [ROADMAP](ROADMAP.md#what-is-actually-irreversible)
shows that counters, badges, milestones, leaderboards and stats are all **derived** from the
`beers` table. One row per beer with correct parents means any aggregate can be recomputed
and any deterministic rule replayed over history to backfill unlocks. So the risk of
deferring is far lower than it looked, and the risk of over-building before anyone has used
it is real.

Only five tables must be right up front — `parties`, `party_members`, `sessions`,
`session_attendees`, `beers` — plus two nullable `guild_id` columns and one join table, which
together are the complete path to guilds.

*Cost:* v0 has no durable offline queue, which genuinely bites in a pub. Mitigated by
shipping the `client_uuid` column now (the expensive half), leaving the queue as a
self-contained client-side addition rather than a migration.

*Also deferred deliberately:* the `jsonb` achievement rule engine. `achievement_unlocks` is
the table that matters; a handful of hardcoded SQL checks can be swapped for the full
vocabulary later and already-recorded unlocks stay valid.

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

### ~~D27 — Sessions auto-close at 06:00 local~~
**Superseded by [D32](#d32--sessions-auto-close-at-0900-the-morning-after-in-the-creators-timezone-supersedes-d27)** — 09:00 the morning after.

Any attendee may close a session; anything still open at 06:00 local time
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

Nothing. Section B of [QUESTIONS.md](QUESTIONS.md) is answered and built into the schema.

## Open — later phases

| ID | Question | Needed by |
|---|---|---|
| D5 | Who joins a guild — the party (team), the person (supporter), or each session (matchday)? Parked by the owner; see QUESTIONS.md D5 | Phase 3 |
| Q3 | Guild join model — open, approval, or invite | Phase 3 |
| Q6 | Pre-seeded club catalogue, user-created guilds, or both? | Phase 3 |
| Q7 | Transfer windows — fun gimmick or needless friction? | Phase 3 |
| Q13 | Distribution — web link, TestFlight, or public app stores? | Phase 5 |
| Q14 | Who else is following this repo? | — |
| Q15 | Combo thresholds — owner wants 10 / 25 / 50 / 100; names and B2 scaling still open | G4 |
| Q24 | Does the guild league table have seasons? | Phase 3 |

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
| ~~Q19~~ | When does a session close? | → ~~D27~~ D32, manual with 09:00-next-morning auto-close |
| ~~Q21~~ | Daily streak badge rewards daily drinking? | → streaks count **weeks** with a session (B1) |
| ~~Q22~~ | What stops a 200-person party farming combos? | → D33, cap at 50 |
| ~~Q23~~ | Account deletion vs. the immutable global counter | → anonymise in place, keep the beers (B3) |
| ~~Q25~~ | Party captain powers; leaving | → as recommended: captain renames, removes, manages guild; founder is captain and can promote; leaving sets `left_at` (B4) |
| ~~Q26~~ | Session timezone, week start, beer types | → D32 creator's timezone, weeks start **Monday**, D34 curated list |
| ~~Q20~~ | Party mates and codes | → D22a/D25, the code joins a *party*, not a session |
