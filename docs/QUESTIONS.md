# Questions — your answer sheet

**This file is for you to edit.** Fill in the `**Answer:**` lines, save, and either commit
it or just tell me you're done. Anything you leave blank, I'll take my recommendation on.

Nothing here blocks you from having a working app — I can build v0 on the recommendations
alone. The ones marked 🔴 change the database, so they're cheapest to settle before the
first migration runs. Everything else can change any time.

---

# A · v0 — the version for you and your mates

The goal: smallest thing that is genuinely *fun* end to end, with no decision that damages
guilds later. See [ROADMAP.md](ROADMAP.md#phase-v0--the-lads-build) for the full cut list.

### A1 — Does the "no solo logging" rule apply from day one? 🔴

The Party Rule (a session needs two attendees) is the app's identity. But for five friends
it means a beer at home alone on a Tuesday can't be logged, which may just read as broken.

Important: **strict → relaxed is a one-line change. Relaxed → strict is impossible**, because
you'd already have solo beers in the data with nothing to attach them to. So the safe
direction is to ship strict.

- **A.** Strict from day one — a session needs two people *(recommended)*
- **B.** Allow solo sessions in v0, tighten later *(not really reversible — see above)*
- **C.** Strict, but add a "drinking alone" flag that doesn't count toward the million

**Answer:** _______

---

### A2 — Which sign-in for v0?

- **A.** Magic link only — email a link, no passwords, no developer accounts, cheapest to build *(recommended)*
- **B.** Google as well — one tap for most people, a bit more setup
- **C.** Apple too — needed eventually for the App Store, but needs the $99/yr account now

**Answer:** _______

---

### A3 — How do your friends get it in v0?

- **A.** A web link they add to their home screen — live the day it's done, no stores, no review *(recommended)*
- **B.** TestFlight — feels like a real app, but needs the Apple account and an invite each
- **C.** Both

Nothing here is a one-way door. The client is Expo either way, so native builds stay
available ([D11](DECISIONS.md#d11--client-is-expo-react-native-with-web-export)).

**Answer:** _______

---

### A4 — How many of you are there, and how much do you actually drink?

Not idle curiosity — it sets the combo thresholds and the first few milestone rungs. A
party of four doing three each on a Friday should hit something good; a party of twelve
shouldn't hit everything at once.

**Roughly how many friends:** _______

**A typical session — how many beers between you:** _______

**Rough beers per person per week:** _______

---

### A5 — What's the party called?

Goes in the seed data so the app isn't empty on first run.

**Answer:** _______

---

### A6 — Anything in the v0 cut list you want pulled back in?

Cut from v0 and deferred: guilds, the achievements grid, photos, venues, beer type/ABV,
push notifications, the offline queue, announcer sounds, easter-egg rungs, streaks, the
public counter page, widgets.

Kept in v0: party + invite code, sessions, `+` / `+ ROUND` / `−`, live tally on every
phone, combo toasts, milestone ring + the 1M bar, a simple leaderboard, a feed of past
sessions.

**Pull back in:** _______

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

**Answer:** _______

---

### B2 (was Q22) — What stops a huge party farming combos?

Combo thresholds assume 3–6 people. Nothing currently caps party size. A party of 200 where
everyone attends one session and somebody taps `+ ROUND` yields 200 beers instantly —
WORLDIE and RAMPAGE unlocked, no rule broken, no beers invented.

Probably irrelevant for your mates, but it's a cheap column now and a nasty retrofit later.

- **A.** Cap party size *(recommended)* — **what number?** _______ (I'd suggest 30)
- **B.** Scale thresholds by attendee count, e.g. RAMPAGE = 3× attendees
- **C.** Cap how many people one `+ ROUND` can cover
- **D.** Nothing — big parties are legitimately impressive

**Answer:** _______

---

### B3 (was Q23) — Account deletion vs. a counter that must never fall

EU users and EU hosting, so GDPR erasure is a legal requirement. But if deleting an account
removes their beers, **the global counter goes down** and milestones people already
celebrated become lies.

- **A.** Anonymise the profile, keep the beer rows. The counter never decreases *(recommended)*
- **B.** Hard delete everything
- **C.** Anonymise, but ask at the deletion screen so the choice is explicit

Decides whether `beers.profile_id` can be nullable, which is why it's here and not later.

**Answer:** _______

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

**Answer:** _______

---

### B5 (was Q26) — Three small ones

**Whose timezone closes a session at 06:00?** Recommend the session creator's, stored on the
session row at start. (Not derivable later if you don't store it.)

**Answer:** _______

**When does a week start?** Recommend Monday.

**Answer:** _______

**Is `beer_type` free text or a fixed list?** Free text is easy but makes `RARE_DROP` and
`PERFECT_HAT_TRICK` unreliable, because typos fragment the data. Recommend a short curated
list (lager, IPA, stout, pilsner, wheat, sour, …) plus free text, with only the curated
values feeding achievements.

**Answer:** _______

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

**Answer:** _______

---

### C2 — Any badges you want that aren't in the catalogue?

[ACHIEVEMENTS.md](ACHIEVEMENTS.md) has about 60. Inside jokes, your own pub names, running
gags, somebody's reputation — this is the stuff that makes it actually funny for your group,
and I can't invent it.

**Answer:**

```
e.g.  THE BERGMAN      — Jonas orders a round and vanishes for 40 minutes
      KUNGSPORTSAVENYN — a session at four different venues in one night
```

---

### C3 — Which of the gaming/football references land, and which don't?

The voice is NBA Jam announcer crossed with a football commentator. If any of it feels
forced, say so — it's seed data, not architecture.

**Answer:** _______

---

# D · Guild questions — not needed until you decide to go further

These are all safely deferred. The nullable `guild_id` columns are in from day one, so
answering these later costs nothing.

### D1 (was Q3) — How do you join a guild?

Open to anyone / crew requests and an officer approves / invite-only / the guild founder
picks per guild.

**Recommended:** founder picks, defaulting to open. A Blåvitt supporter guild wants scale;
six colleagues want it private.

**Answer:** _______

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

**Answer:** _______
