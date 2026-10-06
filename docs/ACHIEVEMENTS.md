# Achievement catalogue

Status: **draft for curation.** This is deliberately over-supplied — cut the ones that
don't land. Every entry maps to a rule type in
[ARCHITECTURE.md §6.1](ARCHITECTURE.md#61-rule-vocabulary).

> ### 🍻 The Party Rule
> **You cannot log a beer alone.** Every session needs at least two attendees, each a real
> account that joined your party with its invite code
> ([D19](DECISIONS.md#d19--no-solo-logging),
> [D22a](DECISIONS.md#d22a--joining-a-party-requires-an-invite-code-supersedes-d22)).
> There are no achievements for drinking by yourself, because there is no such thing as a
> logged beer drunk by yourself.

Design rules:
- The announcer voice is **arcade sports** (NBA Jam) crossed with **a European football
  commentator**. Loud, absurd, affectionate — and never violent. No kill-streak language.
- **Combos are awarded to everyone at the session, not to the individual.** See
  [D20](DECISIONS.md#d20--combos-are-session-scoped).
- Combos fire *during* a session as toasts. Everything else lands after.
- Secret achievements are hidden until unlocked. Ratio of about 1 in 6.

---

## 1. The Combo ladder — beers in a session, counted across everyone there

Escalating live toasts. The count is the **session total across everyone present**, and
the badge goes to **every attendee**. Bringing a fifth person is a better route to
BOOMSHAKALAKA than ordering a fifth beer.

| Code | Title | Session total | Flavor |
|---|---|---|---|
| `BRACE` | BRACE | 2 | "Two on the board." |
| `HAT_TRICK` | HAT-TRICK | 3 | "He's got the match ball!" |
| `HEATING_UP` | HEATING UP | 5 | "He's heating up!" |
| `ON_FIRE` | ON FIRE | 8 | "HE'S ON FIRE!" |
| `BOOMSHAKALAKA` | BOOMSHAKALAKA | 12 | "BOOMSHAKALAKA!" |
| `SCREAMER` | SCREAMER | 16 | "Oh, that is a SCREAMER!" |
| `WORLDIE` | WORLDIE | 20 | "That is an absolute worldie." |
| `RAMPAGE` | RAMPAGE | 25 | "The away end has lost its mind." |

Thresholds are set for **session totals**, so they read very differently from per-person
numbers: BOOMSHAKALAKA at 12 is four people having three each — a good Friday, not a
worrying one. RAMPAGE at 25 is a proper occasion with eight people, not one person in
trouble.

> **Q15 — owner's answer: too low.** With 10+ people doing ~40 beers a night, this ladder
> would empty in an hour. The owner wants four rungs at session totals **10 / 25 / 50 / 100**.
> Which names go on those four, and whether they scale with headcount (B2), is a follow-up
> in [QUESTIONS.md](QUESTIONS.md). The table above is kept until that's settled.

### Per-person cap

There is deliberately **no per-person combo ladder**. An individual drinking a lot earns
nothing extra; the table drinking together earns everything. This is the main lever
keeping the game pointed at socialising rather than volume.

---

## 2. Football — European

The other half of the voice. Deliberately Europe-flavoured: relegation, the treble,
Fergie time, the Invincibles.

### Session shape

| Code | Title | Trigger |
|---|---|---|
| `HAT_TRICK` | Hat-trick | 3 beers in a session |
| `PERFECT_HAT_TRICK` | Perfect Hat-trick | 3 beers, 3 *different* types, one session |
| `FULL_NINETY` | The Full Ninety | Session lasting 90+ minutes |
| `EXTRA_TIME` | Extra Time | Session past 120 minutes |
| `PENALTIES` | Penalties | Session past 150 minutes |
| `FERGIE_TIME` | Fergie Time | Beer logged 23:45–00:00 |
| `INJURY_TIME` | Injury Time | Beer logged after 00:00 |
| `SUPER_SUB` | Super Sub | Join a session already in progress |
| `ROUTE_ONE` | Route One | A single beer of 568ml+ (a proper pint) |
| `TIKI_TAKA` | Tiki-Taka | 5+ beers in a session, all ≤330ml |
| `PARKED_THE_BUS` | Parked the Bus | Session over 3h with ≤2 beers |

### Squad & season

| Code | Title | Trigger |
|---|---|---|
| `ACE` | ACE | Every member of your party turns up to one session |
| `SQUAD_ROTATION` | Squad Rotation | Drink with 5 different people in a week |
| `CLASS_OF_92` | Class of '92 | Be a founding member of a party that reaches 1.000 |
| `THE_INVINCIBLES` | The Invincibles | Party logs every day for a month |
| `CAPTAINS_ARMBAND` | Captain's Armband | Top of your party leaderboard for 4 straight weeks |
| `GOLDEN_BOOT` | Golden Boot | Top scorer in your guild for a season |
| `THE_TREBLE` | The Treble | Three milestones in one week |
| `CLEAN_SHEET` | Clean Sheet | A full week with zero logged — rest counts |
| `EL_CLASICO` | El Clásico | Session with your closest rival on the leaderboard |
| `DERBY_DAY` | Derby Day | Log during a fixture between two rival guilds |
| `AWAY_GOAL` | Away Goal | Log in a city that isn't your home city |
| `GROUNDHOPPER` | Groundhopper | 10 distinct venues |
| `BOSMAN` | Bosman | Transfer your party to a new guild |
| `RELEGATION_BATTLE` | Relegation Battle | Bottom 3 of your guild table |
| `GOLDEN_GOAL` | Golden Goal | Log the beer that crosses a milestone |

### Numeric easter eggs

| Code | Title | Trigger |
|---|---|---|
| `FORMATION` | 4-4-2 | Your 442nd beer |
| `SIXTY_SIX` | Nineteen Sixty-Six | Party's 1.966th beer |
| `NINETY_NINE` | The Treble Season | Party's 1.999th beer |
| `FULL_TIME` | Full Time | Your 90th beer |
| `SIX_SEVEN` | The Kids Think This Is Fun | Your 67th beer *(owner, A4)* |
| `NICE` | hehehe | Your 69th beer *(owner, A4)* |
| `FIVE_HUNDRED` | I Would Drink 500 Beers | Your 500th beer *(owner, A4)* |
| `FIVE_HUNDRED_MORE` | And I Would Drink 500 More | Your 1.000th beer *(owner, A4)* |

---

## 3. Gaming

| Code | Title | Trigger |
|---|---|---|
| `OVER_9000` | IT'S OVER 9000 | Any scope crosses 9.001 — Vegeta's scouter, green readout, exploding numbers |
| `OFF_THE_CHART` | Off the Chart | Any scope crosses 20.000 — *"Even Master Yoda doesn't have a midi-chlorian count that high."* |
| `LEET` | 1337 | Your 1.337th beer |
| `KICK_OFF` | Kick-Off | First beer of a session |
| `ACHIEVEMENT_UNLOCKED` | Achievement Unlocked | Your first ever achievement |
| `LEVEL_UP` | Level Up | Any milestone rung |
| `RESPAWN` | Respawn | Log again after 30+ days away |
| `SPEEDRUN` | Speedrun | Party hits a milestone faster than any other party that month |
| `CRITICAL_HIT` | Critical Hit | A beer over 8% ABV |
| `LOOT_DROP` | Rare Drop | Log a beer type nobody in your guild has logged |
| `NEW_GAME_PLUS` | New Game+ | Party passes 10.000 |
| `FINAL_BOSS` | Final Boss | Log the 1.000.000th beer globally |
| `TOUCH_GRASS` | Touch Grass | *(secret)* Log 3 days running, then take a week off |
| `AFK` | AFK | *(secret)* 90 days without logging, then return |
| `THE_CAKE_IS_A_LIE` | The Cake Is a Lie | *(secret)* Log an alcohol-free beer at a milestone |
| `ROUND_FOR_THE_LADS` | Round for the Lads | Tap `+ ROUND` for 8 or more people at once |
| `GG_EZ` | GG EZ | *(secret)* Beat a rival party to a milestone by <10 beers |

### The two power-level badges

Both are "your number is absurdly high" jokes from different franchises, so they sit at
different rungs and get completely different art:

- **`OVER_9000` at 9.001** — Dragon Ball Z. Vegeta's scouter, green readout, the numbers
  spike and the lens cracks.
- **`OFF_THE_CHART` at 20.000** — Star Wars. *The Phantom Menace*, Qui-Gon takes Anakin's
  blood sample and Obi-Wan reads back *"over twenty thousand"* — higher than Yoda's.
  Blue holo-readout, medical scanner aesthetic.

---

## 4. Milestone badges

Auto-generated from the ladder — one per rung per scope, so they don't need hand-authoring.

| Rung | Party title | Guild title |
|---|---|---|
| 10 | Opening Round | — |
| 100 | Century | — |
| 500 | Half a Grand | — |
| 1.000 | 1K Legend | Promotion |
| 2.500 | 2.5K | — |
| 5.000 | Five Star | — |
| 10.000 | Ten Thousand Club | Continental |
| 100.000 | — | Six Figures |
| 500.000 | — | Halfway to Glory |
| 1.000.000 | — | **ONE MILLION BEERS** |

---

## 5. Points & prestige

Every achievement carries `points`. Open question (Q11) whether points do anything:

- **Nothing** — badges are their own reward, simplest.
- **Party XP / levels** — points aggregate into a party level, a second progression axis.
- **Guild table ranking** — points, not raw beers, order the guild league table. This
  rewards *variety and consistency* over sheer volume, which is a meaningfully healthier
  incentive than "whoever drinks most wins".

The third option is worth serious thought — it's the single biggest lever on what
behaviour the app actually encourages.
