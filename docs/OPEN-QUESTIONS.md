# Open questions

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
