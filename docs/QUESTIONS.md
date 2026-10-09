# Questions — your answer sheet

**This file is for you to edit.** Fill in the `**Answer:**` lines, save, and either commit
it or just tell me you're done. Anything you leave blank, I'll take my recommendation on.

Nothing here blocks you from having a working app — I can build v0 on the recommendations
alone. The ones marked 🔴 change the database, so they're cheapest to settle before the
first migration runs. Everything else can change any time.

---

# ✅ Round 2 — follow-ups from your answers

Your section B answers are built into the schema and tested (D31–D36 in
[DECISIONS.md](DECISIONS.md)). Six small things came out of the rest.

### F1 — Big parties: "A, B and D together" (from B2)

**A** is in: parties cap at 50. But **B** and **D** pull against each other. **D** says a
big party hitting 100 is legitimately impressive. **B** says a big party should need *more*
beers for the same badge, which means each person drinking more. That works against the
rule the whole design is built on: the way to a big badge is bringing a friend, not
drinking more.

- **A.** Cap at 50 + fixed totals 10 / 25 / 50 / 100 — big nights are big *(recommended)*
- **B.** Fixed totals, plus a second ladder for "everyone at the table had N"
- **C.** Thresholds grow with headcount

**Answer:** No objection — taking A: cap 50, fixed totals 10 / 25 / 50 / 100. *(2026-10-06)*

### F2 — Combo names for the four rungs (from C1 + C3)

C3 was about the **badge names**. In the first chat you asked for gaming + European football
references and no "kill" words, which gave us: BRACE, HAT-TRICK, HEATING UP, ON FIRE,
BOOMSHAKALAKA, SCREAMER, WORLDIE, RAMPAGE. You've now asked for four rungs, so four names:

| Session total | Suggested |
|---|---|
| 10 | ON FIRE |
| 25 | BOOMSHAKALAKA |
| 50 | WORLDIE |
| 100 | RAMPAGE |

**Answer:** No objection — taking the suggestion. Renaming later is free. *(2026-10-06)*

### F3 — Venues (from A6)

You pulled venues into v0. How should they work?

- **A.** Each party keeps its own list of pubs. A session has a *current* pub, and every beer
  remembers where it was drunk, so a pub crawl is recorded *(recommended)*
- **B.** One shared list for everyone in the app (needs duplicate-cleaning, or a maps API)
- **C.** Just type the pub name on the session (what the schema has today)

**Answer:** Later — venues are out of v0 again. *(2026-10-06)*

### F4 — Android without the Play Store (from A3)

TestFlight for iPhone needs the Apple Developer account ($99/yr). For Android, a web app
works, but Expo can also build a real installable Android app for free and share it as a
download link. No Play Store needed.

- **A.** Real Android app via a download link *(recommended — same app as the iPhones)*
- **B.** Web app for Android, as you said

**Answer:** A — a real installable app. And no App Store / TestFlight yet: test on web and Android first. *(2026-10-06)*

### F5 — D1 got cut off

"The captain of a …" — finish the thought whenever. It's guild stuff, so no rush.

### F6 — Which language is the app in?

Nothing decides it yet, and it touches every screen.

- **A.** English, built so Swedish can be added later *(recommended — the badge voice,
  BOOMSHAKALAKA / WORLDIE / HAT-TRICK, is English football commentary)*
- **B.** Swedish, with the badge names left in English
- **C.** Both from day one, following the phone's language

**Answer:** A — English, built so it is easy to translate later. *(2026-10-06)*

---

# A · v0 — the version for you and your mates

The goal: smallest thing that is genuinely *fun* end to end, with no decision that damages
guilds later. See [ROADMAP.md](ROADMAP.md#phase-v0--the-lads-build) for the full cut list.

### A7 — I had to make one call to get the schema working. Sanity-check it?

The Party Rule was specified as a check on **sessions** ("a session must have two
attendees"). That turns out to be impossible to implement as written: you create a session,
*then* people join, so a check at commit time means a session can never be created at all.

I moved the check to **beers** instead — the first beer requires two attendees, a session
can briefly hold one person while people arrive. Recorded as
[D30](DECISIONS.md#d30--the-party-rule-is-enforced-on-beers-not-on-sessions) and tested.

Side effect: an empty session can exist in the data. It holds no beers and counts for
nothing, but it exists.

- **A.** Fine, keep it *(recommended, and already built)*
- **B.** Also require two attendees before a session can even be started

**Answer:** A - thought, run a purge every now and then to clean the database from old "+7 days old single ateendee sessions?"

---

### A1 — Does the "no solo logging" rule apply from day one? 🔴

The Party Rule (a session needs two attendees) is the app's identity. But for five friends
it means a beer at home alone on a Tuesday can't be logged, which may just read as broken.

Important: **strict → relaxed is a one-line change. Relaxed → strict is impossible**, because
you'd already have solo beers in the data with nothing to attach them to. So the safe
direction is to ship strict.

- **A.** Strict from day one — a session needs two people *(recommended)*
- **B.** Allow solo sessions in v0, tighten later *(not really reversible — see above)*
- **C.** Strict, but add a "drinking alone" flag that doesn't count toward the million

**Answer:** A!

---

### A2 — Which sign-in for v0?

- **A.** Magic link only — email a link, no passwords, no developer accounts, cheapest to build *(recommended)*
- **B.** Google as well — one tap for most people, a bit more setup
- **C.** Apple too — needed eventually for the App Store, but needs the $99/yr account now

**Answer:** Sign up with email and password. Magic link also!!

---

### A3 — How do your friends get it in v0?

- **A.** A web link they add to their home screen — live the day it's done, no stores, no review *(recommended)*
- **B.** TestFlight — feels like a real app, but needs the Apple account and an invite each
- **C.** Both

Nothing here is a one-way door. The client is Expo either way, so native builds stay
available ([D11](DECISIONS.md#d11--client-is-expo-react-native-with-web-export)).

**Answer:** I don't know. I want it to be an app on iOS and Android. But testflight for Apple and then a web app for ANdroid for now?

---

### A4 — How many of you are there, and how much do you actually drink?

Not idle curiosity — it sets the combo thresholds and the first few milestone rungs. A
party of four doing three each on a Friday should hit something good; a party of twelve
shouldn't hit everything at once.

**Roughly how many friends:** _______

**A typical session — how many beers between you:** _______

**Rough beers per person per week:** _______

Hmm! Good question. We are 10+ in our group and maybe it's 40 beers for a night. But I think we should have a generic scale to this. 10 beers, 100 beers, 500 beers, 1000 beers 2500 beers etc. The ones that "feel right". And we could also add some fun an stupid milestones. 67 "The kids think this is fun" 69 "hehehe" "I would drink 500 beers" that references the 500 miles and "And I would drink 500 more" for the thousand? etc.

---

### A5 — What's the party called?

Goes in the seed data so the app isn't empty on first run.

**Answer:** My friendghroup? Onsdagar!

---

### A6 — Anything in the v0 cut list you want pulled back in?

Cut from v0 and deferred: guilds, the achievements grid, photos, venues, beer type/ABV,
push notifications, the offline queue, announcer sounds, easter-egg rungs, streaks, the
public counter page, widgets.

Kept in v0: party + invite code, sessions, `+` / `+ ROUND` / `−`, live tally on every
phone, combo toasts, milestone ring + the 1M bar, a simple leaderboard, a feed of past
sessions.

**Pull back in:** Achivements! Venues, Offline Queue, Streaks!

**Also cut:** _______

---

# B · Questions that touch the database 🔴

### B1 (was Q21) — The streak badge rewards drinking every day

`SESSION_STREAK` currently unlocks on a **7-day** streak. Since you can't log alone, that
badge rewards *drinking with someone every single day for a week*, then punishes you for
stopping. It runs against everything else the scoring system does
([D20](DECISIONS.md#d20--combos-are-session-scoped) rewards party size, not consumption).

- **A.** Count **weeks with a session**, not days — "12 weeks running" *(recommended)*
- **B.** Drop streaks entirely; `CLEAN_SHEET` already covers the rest side
- **C.** Keep daily streaks

Changes `profile_stats.current_streak_days` → `current_streak_weeks`.

**Answer:** A

---

### B2 (was Q22) — What stops a huge party farming combos?

Combo thresholds assume 3–6 people. Nothing currently caps party size. A party of 200 where
everyone attends one session and somebody taps `+ ROUND` yields 200 beers instantly —
WORLDIE and RAMPAGE unlocked, no rule broken, no beers invented.

Probably irrelevant for your mates, but it's a cheap column now and a nasty retrofit later.

- **A.** Cap party size *(recommended)* — **what number?** 50 (I'd suggest 30)
- **B.** Scale thresholds by attendee count, e.g. RAMPAGE = 3× attendees
- **C.** Cap how many people one `+ ROUND` can cover
- **D.** Nothing — big parties are legitimately impressive

**Answer:** A,B,D all together somehow?

---

### B3 (was Q23) — Account deletion vs. a counter that must never fall

EU users and EU hosting, so GDPR erasure is a legal requirement. But if deleting an account
removes their beers, **the global counter goes down** and milestones people already
celebrated become lies.

- **A.** Anonymise the profile, keep the beer rows. The counter never decreases *(recommended)*
- **B.** Hard delete everything
- **C.** Anonymise, but ask at the deletion screen so the choice is explicit

Decides whether `beers.profile_id` can be nullable, which is why it's here and not later.

**Answer:** A -

---

### B4 (was Q25) — Party captains, and leaving a party

`party_members.role` is `'captain' | 'member'` in the schema but the powers were never
specified.

- Can a captain rename the party? Remove a member? Join or leave a guild?
- One captain, or several?
- When someone leaves, their beers must stay in the party's history, or totals become
  rewritable — so `party_members` needs a `left_at` column rather than a delete.

**Recommended:** captain can rename, manage guild membership and remove members; the
founder is captain and can promote others; leaving sets `left_at` and keeps all history.

**Answer:** Agreed

---

### B5 (was Q26) — Three small ones

**Whose timezone closes a session at 06:00?** Recommend the session creator's, stored on the
session row at start. (Not derivable later if you don't store it.)

**Answer:** Close at 9 the morning after, the session creators

**When does a week start?** Recommend Monday.

**Answer:** Monday

**Is `beer_type` free text or a fixed list?** Free text is easy but makes `RARE_DROP` and
`PERFECT_HAT_TRICK` unreliable, because typos fragment the data. Recommend a short curated
list (lager, IPA, stout, pilsner, wheat, sour, …) plus free text, with only the curated
values feeding achievements.

**Answer:** Short curated List, no free text.

---

# C · The fun stuff — tune whenever

### C1 (was Q15) — Are the combo thresholds right?

All **session totals** across everyone present, not per person:

| Session total | Badge |
|---|---|
| 2 | BRACE |
| 3 | HAT-TRICK |
| 5 | HEATING UP |
| 8 | ON FIRE |
| 12 | BOOMSHAKALAKA |
| 16 | SCREAMER |
| 20 | WORLDIE |
| 25 | RAMPAGE |

Answer A4 and I'll retune these to your actual group. Cheap to change forever, since
achievements are data ([D7](DECISIONS.md#d7--achievements-are-data-not-code)).

**Answer:** Hmm! THees are not really good. As you said before, if it's a big group it screws this up! Let's have 10-25-50-100 combo instead. (The 67 and 69 thing we discuseed earlier comes as achivements anyway?)

---

### C2 — Any badges you want that aren't in the catalogue?

[ACHIEVEMENTS.md](ACHIEVEMENTS.md) has about 60. Inside jokes, your own pub names, running
gags, somebody's reputation — this is the stuff that makes it actually funny for your group,
and I can't invent it.

**Answer:** I'll look into achivements at a later stage!

```
e.g.  THE BERGMAN      — Jonas orders a round and vanishes for 40 minutes
      KUNGSPORTSAVENYN — a session at four different venues in one night
```

---

### C3 — Which of the gaming/football references land, and which don't?

The voice is NBA Jam announcer crossed with a football commentator. If any of it feels
forced, say so — it's seed data, not architecture.

**Answer:** I dont even know what we are talking about now.
---

# D · Guild questions — not needed until you decide to go further

These are all safely deferred. The nullable `guild_id` columns are in from day one, so
answering these later costs nothing.

### D1 (was Q3) — How do you join a guild?

Open to anyone / crew requests and an officer approves / invite-only / the guild founder
picks per guild.

**Recommended:** founder picks, defaulting to open. A Blåvitt supporter guild wants scale;
six colleagues want it private.

**Answer:** The captain of a 

---

### D2 (was Q6) — Real football clubs, user-created guilds, or both?

**Recommended:** both. Seeded clubs give instant identity and good crests — but "Malmö FF"
is a trademark, so there's a real question about official crests versus generic colour
blocks versus user uploads. And which leagues to seed: Allsvenskan? Premier League? Top five?

**Answer:** _______

---

### D3 (was Q24) — Does the guild league table have seasons?

All-time means the first big guild leads forever and nobody can catch up. Seasons fit the
football framing — promotion, relegation, silverware — and give newcomers a reason to start.

**Recommended:** seasons.

**Answer:** _______

---

### D4 (was Q7) — Transfer windows?

Restrict guild-switching to January and summer, football-style. Delightful, thematically
perfect, and real friction when someone just wants to join their mates.

**Recommended:** skip for now, revisit as a seasonal event.

**Answer:** _______

---

### D5 — Who joins a guild: the party, or the person? *(parked by you, 2026-10-05)*

The question that decides most of section D. Three models were mapped out:

- **Team** — a party joins one guild; everything it drinks counts there. Approved once,
  when the party joins. Weak spot: AIK fans in a party that joined Blåvitt drink for Blåvitt.
- **Supporter** — each person supports one guild; each beer counts for its drinker's guild,
  if a guild-mate is at the table. Approved once per person. One night can feed two guilds,
  but each beer only one. Weak spot: a lone fan in the group feeds nobody.
- **Matchday** — each session is declared for a guild and counts if 2+ members are there.
  Approved every night. Not recommended: a decision (and an argument) every night out.

In every model a beer counts for **at most one** guild — `beers.guild_id` is one column.
The crux: is a guild a club you *support* (→ supporter) or a league of friend groups
(→ team)? Claude's lean is supporter.

Nothing in v0 depends on this. The schema supports team and supporter as-is, because the
guild is stamped on each beer, not looked up.

**Answer:** _______

---

# E · Later

### E1 (was Q13) — Distribution when you go further

Web link / TestFlight / full App Store + Play Store. Stores need a 17+ rating and an age
gate for alcohol content, and review adds days to every release.

**Answer:** _______

---

### E2 (was Q14) — Who's reading this repo?

Just you, or will the party read the docs and open issues? Changes how much context each
document needs to carry.

**Answer:** _______

---

### E3 — Shall I open the branch as a pull request?

Everything so far sits on `claude/million-beers-architecture-inbc70`, unmerged, no PR. A PR
would let your friends read and comment before any code exists.

**Answer:** Merged straight into `main` instead, so the repo can be shared as-is. *(2026-10-09)*
