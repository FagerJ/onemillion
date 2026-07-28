# Open questions

Answer inline, or just reply with e.g. *"Q1: Expo. Q2: option B. Q7: skip it."*

Blocking questions are marked 🔴 — Phase 0 can't start without them.

---

## 🔴 Q1 — Client stack

Both ship to phones; the difference is distribution friction vs. native capability.

| Option | Gets you | Costs |
|---|---|---|
| **A. Expo (React Native) + web export** | iOS, Android *and* web from one codebase. Native feel matching the iOS-styled mockups. Real push. Home-screen widget showing the counter. | react-native-web setup is fiddlier; $99/yr Apple account for native builds |
| **B. Next.js PWA (web only)** | Fastest to ship. Share a URL, friends add to home screen. Push works on iOS 16.4+ once installed. No stores, no review. | No widget, no share-sheet; "add to home screen" needs explaining |
| **C. Expo, native-only first** | Cleanest native experience, no web compromises | Every friend needs a TestFlight invite to try it |

**My recommendation: A.** Push notifications are the retention mechanic here, and a
home-screen widget showing the counter tick up is exactly the kind of dumb-brilliant thing
this deserves. But if you want it in friends' hands *this week*, B is the honest answer.

---

## 🔴 Q2 — What is "one beer"?

This defines the meaning of the entire number, so it's worth getting right.

| Option | Rule | Trade-off |
|---|---|---|
| **A. One tap = one beer** | Volume irrelevant. A 33cl lager and a 50cl IPA both = 1. | Purest, simplest, funniest. A million *beers*, not a million litres. Unfair to whoever drinks halves. |
| **B. Normalised to 50cl** | 33cl = 0,66. Pint = 1,13. | "Fair", but now the counter shows 428.391,4 which kills the scoreboard aesthetic. |
| **C. Tap = 1, but record volume** | Counter counts taps. Volume stored for stats and achievements only. | Keeps the number clean; still enables Route One, Tiki-Taka, litres-drunk stats. |

**My recommendation: C.** You get the integer scoreboard *and* the data. Volume becomes an
optional detail, never a required one — critical, because the logger has to stay a
two-second interaction.

---

## 🔴 Q3 — Guild join model

| Option | Behaviour |
|---|---|
| **A. Open** | Anyone can join any guild instantly |
| **B. Approval** | Crew requests, a guild officer approves |
| **C. Invite only** | Guild officers hand out codes |
| **D. Mixed** | Guild founder picks per guild (schema supports this — `guilds.join_policy`) |

**My recommendation: D**, defaulting to open. A "Blåvitt Supporter Guild" wants to be
open — the whole point is scale. A private guild of six offices wants invite-only.

---

## 🔴 Q4 — What's in v1?

From [ROADMAP.md](ROADMAP.md#suggested-cut-lines):

| Option | Contents | Feel |
|---|---|---|
| **A. Core loop** | Phase 0 + C1-C5, C8 | Works. Not yet fun. |
| **B. Core + game layer** | A + G1, G2, G4, G5 | Shouts at you. This is the product. |
| **C. Core + game + guilds** | B + all Phase 3 | Matches the full pitch |

**My recommendation: B**, then Phase 3 immediately after. Guilds only get interesting once
there are several crews using it, so shipping B to your friends first generates the very
thing guilds need.

---

## Q5 — Multiple crews per person?

Can I be in both "The Thirsty Five" and "Work Lads"?

The schema supports it, and beer attribution stays unambiguous (each beer belongs to one
session → one crew → one guild). The real question is UX: a crew switcher adds a
navigation layer to every screen.

**Recommendation:** allow it in the schema, ship v1 with a single active crew, add the
switcher when someone asks.

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

## Q8 — Retroactive logging and editing

- How far back can you log? (Yesterday? Last week? Unlimited?)
- Can you edit or delete a logged session?
- If you delete, do counters decrement — and do already-unlocked achievements revoke?

**Recommendation:** log up to 7 days back; edits allowed for 24h; deletes decrement
counters but **never revoke achievements**. Revoking a badge someone celebrated feels
awful, and permitting it opens a griefing vector.

---

## Q9 — Where does the multikill ladder stop?

Currently drafted to WICKED SICK at 15 beers in a session. That's a heavy night, and
there's a fair question about whether the app should still be cheering.

| Option | |
|---|---|
| **A.** Cap at MONSTER KILL (6) |
| **B.** Cap at GODLIKE (12) |
| **C.** Full ladder to WICKED SICK (15) |
| **D.** Full ladder, but top rungs count across a whole evening rather than one session |

**Recommendation: B.** The ladder stays satisfying, and the app stops applauding somewhere
short of the genuinely grim end.

---

## Q10 — OVER 9000

The line is Vegeta's, from Dragon Ball Z — not Star Wars. Options: (a) DBZ treatment —
scouter, exploding numbers; (b) Star Wars visual as a knowing mashup; (c) two separate
badges. Worth settling before any art gets made, since the two look nothing alike.

---

## Q11 — Do achievement points do anything?

| Option | |
|---|---|
| **A. Nothing** | Badges are their own reward |
| **B. Crew XP / levels** | A second progression axis alongside beers |
| **C. Points order the guild league table** | Rewards variety and consistency over raw volume |

**Recommendation: C**, and I'd argue it's the single most important lever in the app. If
the guild table ranks on raw beers, the optimal strategy is "drink more". If it ranks on
achievement points, the optimal strategy is "drink varied, log consistently, bring
friends" — a far better game *and* a far better incentive.

---

## Q12 — Feed scope

Crew-only (private), guild-wide (busy, social), or a global firehose (chaotic, fun)?

**Recommendation:** crew feed as the default tab, guild feed as a second tab in Phase 3.
No global firehose — it's noise, and it's a moderation problem.

---

## Q13 — Distribution

Web link only, TestFlight for friends, or full public App Store + Play Store?

Bear in mind the stores require a 17+ rating and an age gate for alcohol content, and
review adds days to every release. Largely follows from Q1.

---

## Q14 — Who else is following this repo?

Is this you alone for now, or are the friends in the crew going to read these docs and
open issues? Changes how much context each document needs to carry.
