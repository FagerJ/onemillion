# Open questions *(superseded)*

> ⚠️ **Answer [QUESTIONS.md](QUESTIONS.md) instead** — it is the editable answer sheet and
> covers everything here plus the v0 scope questions. This file is kept for its longer
> write-ups of the already-answered decisions.

Answer inline, or just reply with e.g. *"Q1: Expo. Q2: option B. Q7: skip it."*

Blocking questions are marked 🔴 — Phase 0 can't start without them.

**Nothing is currently blocking Phase 0.** Everything below is for later phases or
post-launch tuning.

---

## ✅ Answered — see [DECISIONS.md](DECISIONS.md)

| ID | Question | Outcome |
|---|---|---|
| Q1 | Client stack | **Expo (React Native) + web export** → D11 |
| Q2 | What is "one beer"? | **Tap = 1, volume optional metadata** → D12 |
| Q4 | v1 scope | **Core loop + game layer** → D13 |
| Q11 | Do achievement points do anything? | **They rank the guild league table** → D14 |
| Q12 | Feed scope | **Party feed default, no global firehose** → D15 |
| Q5 | Multiple parties per person? | **Schema yes, v1 UI single party** → D17 |
| Q8 | Retroactive logging | **Today + yesterday, 24h edits, no revokes** → D16 |
| Q9 | Where does the combo ladder stop? | **Party-scoped, no kill language** → D18/D20 |
| Q10 | OVER 9000 | **Both — DBZ at 9.001, midi-chlorians at 20.000** → D21 |
| Q16 | Who counts as the second person? | **An app user who joined your party by code. No guests** → D22a |
| Q17 | Does the other person confirm? | **Joining the party *is* the confirmation** → D22a |
| Q18 | Who logs the beers? | **Anyone can log for anyone; `+ ROUND` for everyone** → D26 |
| Q19 | When does a session close? | **Manual, with 06:00 local auto-close** → D27 |
| Q20 | Party mates and codes | **The code joins a *party*, not a session** → D22a/D25 |

---

## 🔴 Q21 — The streak badge contradicts everything else

`SESSION_STREAK` currently unlocks on a **7-day logging streak**. Because you cannot log
alone ([D19](DECISIONS.md#d19--no-solo-logging)), that badge literally rewards *drinking
with someone every single day for a week* — and then punishes you for stopping.

That runs directly against [D20](DECISIONS.md#d20--combos-are-session-scoped) (reward party
size, not consumption) and the whole of
[ARCHITECTURE §9](ARCHITECTURE.md#9-responsible-design). It's the one mechanic in the
catalogue that pushes the wrong way, and it's in v1's seed data.

| Option | |
|---|---|
| **A. Streaks count weeks with a session, not days** | "12 weeks running" — rewards showing up regularly without implying daily drinking |
| **B. Drop streaks entirely** | Simplest. `CLEAN_SHEET` already covers the rest side |
| **C. Keep daily streaks** | Highest engagement pull, and the reason engagement mechanics get criticised |

**Recommendation: A.** Weekly streaks keep the retention value and read as "we're a party
that actually meets up", which is the behaviour worth reinforcing. This also changes
`profile_stats.current_streak_days` → `current_streak_weeks`, so it's cheaper to decide
before F4 than after.

---

## 🔴 Q22 — What stops a 200-person "party" farming combos?

Combo thresholds ([Q15](#q15--are-the-combo-thresholds-right)) assume a session of 3-6.
Nothing currently caps party size. A party of 200 where everyone attends one session and
somebody taps `+ ROUND` produces 200 beers instantly — WORLDIE and RAMPAGE unlocked, no
rule broken, no beers invented.

| Option | |
|---|---|
| **A. Cap party size** (~30?) | A party is a group of friends. Simple, and keeps thresholds meaningful |
| **B. Scale combo thresholds by attendee count** | e.g. RAMPAGE = 3× attendees. Fair at every size, more complex to explain |
| **C. Cap the round button** | `+ ROUND` limited to N attendees at a time |
| **D. Nothing — let it happen** | Big parties are legitimately impressive |

**Recommendation: A**, with a generous cap. Guilds already exist for scale; parties should
stay small enough that the leaderboard is people you know.

---

## 🔴 Q23 — Account deletion vs. the immutable counter

Swedish users, EU hosting, so GDPR erasure is a legal requirement, not a nice-to-have. But
if deleting an account removes their beers, **the global counter goes down** — which breaks
the one number the whole app is built on, and retroactively invalidates milestones already
celebrated.

| Option | |
|---|---|
| **A. Anonymise, keep the rows** | Profile becomes "A departed drinker", beers stay counted. Counter never decreases. Standard practice, and defensible: the aggregate is anonymous statistical data |
| **B. Hard delete everything** | Cleanest privacy story, but the counter drops and milestone history lies |
| **C. Anonymise, but let the user choose** | Offer "delete my account, keep my beers in the total" as an explicit consent at deletion time |

**Recommendation: A**, with C's wording at the deletion screen so the choice is informed.
Worth deciding before F4 because it determines whether `beers.profile_id` can be nullable.

---

## Q24 — Does the guild league table have seasons?

[D14](DECISIONS.md#d14--achievement-points-rank-the-guild-league-table) ranks guilds on
achievement points, but over what window?

| Option | |
|---|---|
| **A. All-time** | Simple. But the first big guild leads forever and nobody else can catch up |
| **B. Seasons** | Table resets (quarterly? annually?), all-time totals preserved separately. Fits the football framing perfectly — promotion, relegation, silverware |
| **C. Rolling 90 days** | Always current, no reset drama, no season narrative |

**Recommendation: B.** The entire guild concept is borrowed from football; seasons are the
mechanic that makes a league table worth looking at twice, and they give perpetual
newcomers a reason to start.

---

## Q25 — Party captains: what can they actually do?

`party_members.role` is `'captain' | 'member'` in the schema but the powers were never
specified. Also unaddressed: what happens when someone **leaves** a party?

- Can a captain remove a member? Rename the party? Change or leave the guild?
- Are there multiple captains, or one?
- On leaving: do that person's beers stay in the party's historical total? *(They must, or
  totals become rewritable — so `party_members` needs a `left_at` rather than a delete.)*
- Does a departed member stay on the party leaderboard?

**Recommendation:** captain can rename, manage guild membership, and remove members;
founder is captain by default and can promote others; leaving sets `left_at` and keeps all
historical beers. Confirm before F4 — the `left_at` column is a schema change.

---

## Q26 — Three small ones, bundled

- **Whose timezone closes a session at 06:00?** The session creator's, or the venue's?
  Recommend the creator's profile timezone, stored on `sessions` at start.
- **When does a week start?** Recommend Monday — European convention, and it makes "this
  week" match how the crowd actually thinks about a weekend.
- **Is `beer_type` free text or a controlled list?** Free text is easy but makes
  `RARE_DROP` and `PERFECT_HAT_TRICK` unreliable (typos fragment the data). Recommend a
  small curated list (lager, IPA, stout, pilsner, wheat, sour, …) plus free text, with only
  the curated values feeding achievements.

---

## Q15 — Are the combo thresholds right?

BRACE 2 · HAT-TRICK 3 · HEATING UP 5 · ON FIRE 8 · BOOMSHAKALAKA 12 · SCREAMER 16 ·
WORLDIE 20 · RAMPAGE 25 — all **session totals**, not per-person.

Tuned for sessions of 3-6 people. If sessions turn out to be mostly pairs, everything above
ON FIRE is unreachable. Cheap to retune post-launch since achievements are data ([D7](DECISIONS.md#d7--achievements-are-data-not-code)).

---

## Q3 — Guild join model *(Phase 3)*

| Option | Behaviour |
|---|---|
| **A. Open** | Anyone can join any guild instantly |
| **B. Approval** | Party requests, a guild officer approves |
| **C. Invite only** | Guild officers hand out codes |
| **D. Mixed** | Guild founder picks per guild (schema supports this — `guilds.join_policy`) |

**My recommendation: D**, defaulting to open. A "Blåvitt Supporter Guild" wants to be
open — the whole point is scale. A private guild of six office colleagues wants invite-only.

---

## Q6 — Guild catalogue

| Option | |
|---|---|
| **A. User-created only** | Anyone founds a guild, names it whatever |
| **B. Seeded club catalogue** | Real football clubs with crests + colours, pre-loaded |
| **C. Both** | Seeded clubs *plus* user-created community guilds |

**Recommendation: C.** Seeding real clubs gives instant identity and beautiful crests, but
"Malmö FF" is a trademark — worth a thought on whether to use official crests, generic
colour blocks, or user-uploaded ones. Which leagues to seed? (Allsvenskan, Premier League,
top 5 European?)

---

## Q7 — Transfer windows

Restrict guild-switching to fixed windows (January + summer), football-style?

**For:** delightful, thematically perfect, creates event moments.
**Against:** real friction on a social app when someone just wants to join their mates.

**Recommendation:** skip for v1, revisit as a seasonal event once there are enough guilds
for switching to matter.

---

## Q13 — Distribution

Web link only, TestFlight for friends, or full public App Store + Play Store?

Bear in mind the stores require a 17+ rating and an age gate for alcohol content, and
review adds days to every release. Largely follows from Q1.

---

## Q14 — Who else is following this repo?

Is this you alone for now, or are the friends in the party going to read these docs and
open issues? Changes how much context each document needs to carry.
