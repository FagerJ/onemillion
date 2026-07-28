# Achievement catalogue

Status: **draft for curation.** This is deliberately over-supplied — cut the ones that
don't land. Every entry maps to a rule type in
[ARCHITECTURE.md §6.1](ARCHITECTURE.md#61-rule-vocabulary).

Design rules:
- The announcer voice is **arcade FPS** (Unreal Tournament / Quake) crossed with **a
  European football commentator**. Loud, absurd, affectionate.
- Multikills fire *during* a session as toasts. Everything else lands after.
- Secret achievements are hidden until unlocked. Ratio of about 1 in 6.

---

## 1. Multikill ladder — beers in a single session

The arcade announcer stack. These fire live, escalating, in the same session.

| Code | Title | Trigger | Flavor |
|---|---|---|---|
| `DOUBLE_KILL` | DOUBLE KILL | 2 in a session | "Two down." |
| `TRIPLE_KILL` | TRIPLE KILL | 3 in a session | "TRIPLE KILL!" |
| `MULTI_KILL` | MULTI KILL | 4 in a session | "Unbelievable!" |
| `MEGA_KILL` | MEGA KILL | 5 in a session | "M-M-M-MEGA KILL!" |
| `MONSTER_KILL` | MONSTER KILL | 6 in a session | "MONSTER KILL!!" |
| `RAMPAGE` | RAMPAGE | 8 in a session | "He's on a RAMPAGE!" |
| `UNSTOPPABLE` | UNSTOPPABLE | 10 in a session | "UNSTOPPABLE!" |
| `GODLIKE` | GODLIKE | 12 in a session | "G-G-GODLIKE!" |
| `WICKED_SICK` | WICKED SICK | 15 in a session | "Wicked. Sick." |

> **Balance question (Q9):** where should this ladder stop? 15 beers in a session is a
> genuinely heavy night, and there's a real question about whether the app should be
> cheering by that point. Options: cap at MONSTER KILL (6), cap at GODLIKE (12), or run the
> full ladder. Related: should the top rungs count *across an evening* rather than
> *per session*?

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
| `ACE` | ACE | Every member of your crew in one session |
| `SQUAD_ROTATION` | Squad Rotation | Drink with 5 different people in a week |
| `CLASS_OF_92` | Class of '92 | Be a founding member of a crew that reaches 1.000 |
| `THE_INVINCIBLES` | The Invincibles | Crew logs every day for a month |
| `CAPTAINS_ARMBAND` | Captain's Armband | Top of your crew leaderboard for 4 straight weeks |
| `GOLDEN_BOOT` | Golden Boot | Top scorer in your guild for a season |
| `THE_TREBLE` | The Treble | Three milestones in one week |
| `CLEAN_SHEET` | Clean Sheet | A full week with zero logged — rest counts |
| `EL_CLASICO` | El Clásico | Session with your closest rival on the leaderboard |
| `DERBY_DAY` | Derby Day | Log during a fixture between two rival guilds |
| `AWAY_GOAL` | Away Goal | Log in a city that isn't your home city |
| `GROUNDHOPPER` | Groundhopper | 10 distinct venues |
| `BOSMAN` | Bosman | Transfer your crew to a new guild |
| `RELEGATION_BATTLE` | Relegation Battle | Bottom 3 of your guild table |
| `GOLDEN_GOAL` | Golden Goal | Log the beer that crosses a milestone |

### Numeric easter eggs

| Code | Title | Trigger |
|---|---|---|
| `FORMATION` | 4-4-2 | Your 442nd beer |
| `SIXTY_SIX` | Nineteen Sixty-Six | Crew's 1.966th beer |
| `NINETY_NINE` | The Treble Season | Crew's 1.999th beer |
| `FULL_TIME` | Full Time | Your 90th beer |

---

## 3. Gaming

| Code | Title | Trigger |
|---|---|---|
| `OVER_9000` | IT'S OVER 9000 | Any scope crosses 9.001 |
| `LEET` | 1337 | Your 1.337th beer |
| `FIRST_BLOOD` | First Blood | First beer of a session |
| `ACHIEVEMENT_UNLOCKED` | Achievement Unlocked | Your first ever achievement |
| `LEVEL_UP` | Level Up | Any milestone rung |
| `RESPAWN` | Respawn | Log again after 30+ days away |
| `SPEEDRUN` | Speedrun | Crew hits a milestone faster than any other crew that month |
| `CRITICAL_HIT` | Critical Hit | A beer over 8% ABV |
| `LOOT_DROP` | Rare Drop | Log a beer type nobody in your guild has logged |
| `NEW_GAME_PLUS` | New Game+ | Crew passes 10.000 |
| `FINAL_BOSS` | Final Boss | Log the 1.000.000th beer globally |
| `TOUCH_GRASS` | Touch Grass | *(secret)* Log 3 days running, then take a week off |
| `AFK` | AFK | *(secret)* 90 days without logging, then return |
| `THE_CAKE_IS_A_LIE` | The Cake Is a Lie | *(secret)* Log an alcohol-free beer at a milestone |
| `NO_SCOPE` | No Scope | *(secret)* Log a session in under 10 seconds |
| `GG_EZ` | GG EZ | *(secret)* Beat a rival crew to a milestone by <10 beers |

> **Q10 — OVER 9000:** the line is Vegeta's, from Dragon Ball Z, not Star Wars. Three ways
> to go: (a) keep it DBZ — scouter, exploding numbers, green glow; (b) do the Star Wars
> visual anyway as a knowing mashup; (c) split into two badges. Worth deciding before art
> is commissioned, because the two look nothing alike.

---

## 4. Milestone badges

Auto-generated from the ladder — one per rung per scope, so they don't need hand-authoring.

| Rung | Crew title | Guild title |
|---|---|---|
| 10 | Opening Round | — |
| 100 | Century | — |
| 500 | Half a Grand | — |
| 1.000 | 1K Legend | Promotion |
| 5.000 | Five Star | — |
| 10.000 | Ten Thousand Club | Continental |
| 100.000 | — | Six Figures |
| 500.000 | — | Halfway to Glory |
| 1.000.000 | — | **ONE MILLION BEERS** |

---

## 5. Points & prestige

Every achievement carries `points`. Open question (Q11) whether points do anything:

- **Nothing** — badges are their own reward, simplest.
- **Crew XP / levels** — points aggregate into a crew level, a second progression axis.
- **Guild table ranking** — points, not raw beers, order the guild league table. This
  rewards *variety and consistency* over sheer volume, which is a meaningfully healthier
  incentive than "whoever drinks most wins".

The third option is worth serious thought — it's the single biggest lever on what
behaviour the app actually encourages.
