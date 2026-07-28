# Open questions

Answer inline, or just reply with e.g. *"Q1: Expo. Q2: option B. Q7: skip it."*

Blocking questions are marked 🔴 — Phase 0 can't start without them.

---

## ✅ Answered — see [DECISIONS.md](DECISIONS.md)

| ID | Question | Outcome |
|---|---|---|
| Q1 | Client stack | **Expo (React Native) + web export** → D11 |
| Q2 | What is "one beer"? | **Tap = 1, volume optional metadata** → D12 |
| Q4 | v1 scope | **Core loop + game layer** → D13 |
| Q11 | Do achievement points do anything? | **They rank the guild league table** → D14 |
| Q12 | Feed scope | **Crew feed default, no global firehose** → D15 |
| Q5 | Multiple crews per person? | **Schema yes, v1 UI single crew** → D17 |
| Q8 | Retroactive logging | **Today + yesterday, 24h edits, no revokes** → D16 |
| Q9 | Where does the combo ladder stop? | **Party-scoped, no kill language** → D18/D20 |
| Q10 | OVER 9000 | **Both — DBZ at 9.001, midi-chlorians at 20.000** → D21 |
| Q16 | Who counts as the second person? | **An app user who joined via code. No guests** → D22 |
| Q17 | Does the other person confirm? | **Joining *is* the confirmation** → D22 |

---

## 🔴 Q18 — Who logs the beers?

[D22](DECISIONS.md#d22--a-party-is-a-live-joinable-session-with-an-invite-code) says
everyone in the party has the app and joined it themselves. So who taps `+`?

| Option | Behaviour | Trade-off |
|---|---|---|
| **A. Everyone logs their own** | Each person taps `+` on their own phone | Most accurate, zero disputes, and the party tally climbing live on everyone's screen is a genuinely great shared moment. But everyone has to actually open the app during the night |
| **B. Host tallies for the table** | One person runs the `+`/`−` steppers for everyone — the original mockup | Lowest friction in the moment, one person's problem. But it's proxy logging, which D22 was partly meant to eliminate |
| **C. Hybrid** | Anyone can log for anyone; you can always correct your own count | Forgiving, matches how rounds actually work (you buy a round for four). Slightly more UI |

**Recommendation: C.** Rounds are inherently bought *for* people, so pure self-logging
fights the actual behaviour. Letting anyone add and everyone correct keeps the mockup's
fast tally UI while preserving the "it's my count" principle. A is the purist option and I
could be argued into it.

---

## 🔴 Q19 — When does a party close?

The join code stays live while a party is `open`, and combos finalise on close.

| Option | |
|---|---|
| **A. Host closes it manually** | Explicit, but people forget and go to bed |
| **B. Auto-close after N hours idle** | Forgiving. What's N — 3h? 6h? |
| **C. Auto-close at a fixed hour** | Everything closes at 06:00 local. Simple and matches how nights actually end |
| **D. Manual + auto-close backstop** | Host *can* close; anything still open at 06:00 closes itself |

**Recommendation: D**, with a 06:00 local backstop.

---

## 🔴 Q20 — Do your own crew mates need the code?

Your crew is already a persistent, mutual group. Making them type a code every time is
friction with no security benefit — but skipping it means two different join paths.

| Option | |
|---|---|
| **A. Crew mates are one-tap; outsiders use the code** | Fastest. Keeps the mockup's friend chips for your crew |
| **B. Everyone uses the code, always** | One path, perfectly consistent, provably consenting every time |

**Recommendation: A**, *if* the tapped crew mate still gets a push they can decline.
Crew membership already proves mutual consent; a per-night code adds nothing except taps.

---

## Q15 — Are the party-combo thresholds right?

BRACE 2 · HAT-TRICK 3 · HEATING UP 5 · ON FIRE 8 · BOOMSHAKALAKA 12 · SCREAMER 16 ·
WORLDIE 20 · RAMPAGE 25 — all **party totals**, not per-person.

Tuned for parties of 3-6. If crews turn out to be mostly pairs, everything above ON FIRE
is unreachable. Cheap to retune post-launch since achievements are data ([D7](DECISIONS.md#d7--achievements-are-data-not-code)).

---

## Q3 — Guild join model *(Phase 3)*

| Option | Behaviour |
|---|---|
| **A. Open** | Anyone can join any guild instantly |
| **B. Approval** | Crew requests, a guild officer approves |
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

Is this you alone for now, or are the friends in the crew going to read these docs and
open issues? Changes how much context each document needs to carry.
