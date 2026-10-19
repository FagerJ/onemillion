# Decision log

Lightweight ADRs. Each decision records what was chosen, why, and what it costs.
Superseded decisions are kept, struck through — the history is the point.

Entries before D45 call the group of friends a **party**; since D45 it's a **crew**. The old
entries keep their words, because they're history.

---

### D36 — Single-attendee sessions are purged after 7 days
**Decided** (owner, A7). A session that never got a second attendee is deleted once it is
closed and more than 7 days old. Runs alongside the auto-close job (`C10`) — built as the
nightly `purge-lonely-sessions` job in
[D41](#d41--sessions-close-on-schedule-and-last-night-can-still-be-logged-today).

*Why:* [D30](#d30--the-party-rule-is-enforced-on-beers-not-on-sessions) lets a session hold
one person while friends arrive, so abandoned ones accumulate. They are clutter in the feed
and in every query that walks sessions.

*Cost:* the only hard delete in the design. Safe because such a session cannot hold a beer:
the `beers` trigger refuses any beer in a session with fewer than two attendees. A session
with two or more attendees and zero beers is **kept** — it is the record of who showed up
(`ACE` needs it).

---

### D53 — Email sign-in carries a 6-digit code as well as the link
**Decided.** The sign-in and sign-up emails add "Or type this code in the app", with the
code from Supabase (`{{ .Token }}`). The "Check your inbox" panel takes it (`verifyOtp`,
type `email`, which covers both). On an iPhone home-screen app, a line explains why.
Password reset stays a link: you reset in Safari, then sign in with the new password.

*Why:* on iPhone, a link tapped in Mail opens in Safari, which keeps its own sign-in apart
from the home-screen app, so a magic link signs Safari in and not the app. A code typed into
the app works everywhere: in the iPhone app, or on a laptop with the email on a phone.

*Cost:*
- Two templates to paste into the dashboard again (DEPLOY.md § 3). Until then production's
  emails carry no code, and the field waits for one that never comes; the link still works.
- The dashboard's "Email OTP length" must match: the field takes 6 to 10 digits.
- A code in an email can be read aloud or forwarded: the same trust as the link.

---

### D52 — Install offers: a one-time banner on Home, a card on Me, a link on Welcome for iPhone
**Decided.** Chrome's install event is caught before the app draws, and its own mini-bar is
held back. Where one tap can install (Chrome, Edge and Samsung on Android, Chrome and Edge on
a computer), Install opens the browser's dialog; on iPhone and iPad, "Show me how" opens a
sheet with the three steps through Safari's Share menu. **Home** shows a slim banner once,
dismissed for good in that browser, and never during a live night. **Me** keeps a card for
as long as the app isn't installed. **Welcome** has a link for iPhone users, because a
home-screen app on iPhone keeps its own sign-in apart from Safari's: install first, sign in
once. An installed app asks the browser to keep its storage (`navigator.storage.persist()`).

*Why:* Home is where everyone lands, and once is the right amount of nudging; Me is where it
stays. A live night is for logging. iPhone has no install API, so steps are the only route,
and D38 wants iPhone users to install, because Safari clears a site's storage after weeks
unused.

*Cost:*
- One more card and one more drawer.
- Dismissing the banner counts per browser.
- Nothing shows where there is no way to install (Firefox, in-app browsers on Android, an
  app already installed). Safari can't tell whether the app is already on the home screen,
  so the banner may show once more there.

---

### D51 — The worker never touches Supabase, and opening offline waits on the splash
**Decided.** The worker ignores anything that isn't a GET to its own address: Supabase's
API, Auth and Storage, Google, everything else. Realtime is a WebSocket, which workers never
see. Nothing is cached at runtime. Opening with no signal therefore gives the app but no
data, so three things keep it from landing on the wrong screen:
- **Gates:** "couldn't ask" (no data yet) is a splash, never "you have no profile" or "you
  have no crew". Only an actual empty answer sends you to setup.
- **Sign-in:** an expired login that can't be refreshed for lack of signal keeps you on the
  splash instead of signing you out; the library refreshes it once there is signal.
- **Splash:** says "No signal. Holding your seat." when offline, or after 8 seconds of
  nothing coming back.

*Why:* caching API answers in the worker would carry one person's crew across a sign-out
(the app clears its cache on sign-out for that reason), and it is the offline queue's job,
not the worker's. Before this, a failed profile request sent you to profile setup; with an
app that opens offline, that would have been everyone's first offline experience.

*Cost:*
- Until the offline queue keeps the app's data on the phone, opening offline shows the
  splash, not your crew.
- A weak connection takes 8 seconds to say "No signal".
- An expired login opened offline comes back up to a minute after signal returns: the auth
  library waits that long before retrying a refresh that failed.

---

### D50 — The app opens from its cache; a new version takes over at once and asks before reloading
**Decided.** Every page load is answered from the cache, so the app opens at once with or
without signal. The browser checks for a new worker on launch, and the app also asks every
time it comes back on screen (at most every 10 minutes) and hourly while open. A new worker
precaches its build in the background, takes over straight away (`skipWaiting`,
`clients.claim`) and deletes the old cache. The page then shows a toast, "Fresh version on
tap · Reload"; it never reloads by itself.

*Why:* the pub has bad signal. A network-first app waits out a weak connection on every
launch, and the offline queue needs the app to open with none. Taking over at once means the
next launch is the new build; a waiting worker could keep an installed app on the old one for
days, because a phone rarely closes it. Reloading by itself could drop a tap mid-round, so
until taps are durable, reloading is the user's tap.

*Cost:*
- A deploy reaches a phone on the launch after the one that found it, or when they tap
  Reload: **phones run one build behind for one launch**. So a migration must keep working
  with the previous app build for a release: add things, don't rename or drop what the live
  app calls. That is a new rule for every migration from here on.
- A page that was already open can't fetch an old file after the takeover. Today that is only
  rare font subsets, which fall back to a system font. A missing `/assets/` file is now a real
  404 rather than the app's page served as JavaScript.

---

### D49 — A hand-written service worker, not vite-plugin-pwa
**Decided.** `app/sw/sw.ts` is a plain worker of about 70 lines with no imports. A plugin in
`app/vite.config.ts` runs after each build: it lists `dist/`, checks the manifest and icon
sizes, strips the worker's TypeScript with Vite's own `transformWithOxc`, and writes
`dist/sw.js` with this build's file list and a version hash on its first line. The build
fails if any of that is wrong. `app/tsconfig.sw.json` type-checks the worker against the
WebWorker library. `VITE_SW_OFF=1` builds a kill switch instead (`app/sw/off.ts`), which
clears every cache, unregisters itself and reloads open windows.

*Why:* the worker needs three behaviours: precache the build, answer navigations with the
app's one page, stay out of everything else. vite-plugin-pwa supports Vite 8, but it brings
Workbox's build tool and with it Babel, a second Rollup and a dozen more packages, for
features this worker doesn't use. Its biggest extra, Background Sync, doesn't exist on
iPhone, so the offline queue can't lean on it anyway. Seventy lines read line by line, with
build checks that were each broken once on purpose, match how this repo treats its SQL.

*Cost:* service-worker correctness is ours. A bad worker can pin phones to an old build.
Five things guard against that: `sw.js` is served `no-cache`; the worker is registered with
`updateViaCache: 'none'`; the app checks for a new one every time it comes back on screen;
`/?sw-reset` clears one phone; `VITE_SW_OFF=1` and a redeploy clear every phone.

---

### D48 — The app installs to the home screen, and its mark is the pint
**Decided** (owner, 2026-10-19: "Go for 1,2,3,4,5!", the installable app first). The app has
a web manifest (`app/public/manifest.webmanifest`): `id` and `start_url` `/`, standalone,
portrait, cellar `#0d0905` for the theme and the splash, name "One Million Beers", short
name "1M Beers". The icon is PintGauge's nonic pint, nearly full, on stout under the pub
lamp: a rounded tile for the favicon and the 192/512 icons, and a full-bleed version for
Android's maskable icon and the iPhone's apple-touch icon, which each platform cuts to its
own shape. `app/scripts/make-icons.ps1` renders the PNGs from `app/design/*.svg` with
headless Edge, and they are committed. Two screenshots fill Chrome's install sheet.

*Why:* Android shows its install prompt only with 192 and 512 icons and a maskable one
(without that, the icon sits on a white disc); iPhone wants a PNG apple-touch icon. `id`
fixes the app's identity, so `start_url` can change later without a second install. People
are bottle caps; the app is the pint everyone fills together, so a cap would read as a person.

*Cost:*
- The PNGs are binaries regenerated by a Windows-only script; Vercel builds on Linux and
  never renders them.
- The manifest's strings sit outside i18next (D37). Swedish later means a second manifest
  or English there.
- An icon on an iPhone home screen never changes until it is added again, so the owner
  approves it before friends install.
- The screenshots go stale as the screens change.

---

### D47 — Polls on the news site: anyone can vote, through two functions
**Decided** (owner, 2026-10-11: "build a poll on the website for how guilds should work and
for what domain name we should use"). A question on the news site can carry a poll. Votes
live in Supabase (`polls`, `poll_votes`), and a signed-out visitor can call exactly two
functions: `cast_vote()` and `poll_results()`. No account needed: you give a name, pick an
option, and say why if you like. Your browser keeps a random voter id, which is what lets you
change your vote; the results show choices, names and comments, never the ids. A poll is a
row in `polls`, added by a migration, plus a post naming the same id and option keys.

*Why:* half the crew hasn't signed up, and the site is public — a poll behind a sign-in would
get few answers, and the shared doc needs a Claude account to open at all. Two narrow
functions keep D39's rule that the tables are shut: nobody reads or writes them directly.

*Cost:*
- The first thing a signed-out visitor can do anywhere (D39 gave `anon` nothing). It is
  bounded: two functions, open polls only, known options only, 500 votes a poll, names up to
  30 characters and comments up to 280.
- One vote per browser, not per person: a cleared browser or a second phone votes again.
  Fine among friends, not a referendum; a stray vote is one line of SQL to delete.
- Names and comments are public, on a public page.
- A poll's options live in two places, the migration and the post. The database refuses a
  key it doesn't know, so a mismatch fails loudly instead of counting wrong.

---

### D46 — The app moves to onemillion.fager.tech, and a news site sits beside it
**Decided** (owner, 2026-10-11: "Start a website on a separate subdomain … where I can post
these questions, post some release notes", choosing `fager.tech` subdomains over buying
`onemillionbeers.beer`). The app's address is **onemillion.fager.tech**; the generated
`onemillion-gray.vercel.app` still answers. A second Vercel project, `onemillion-news`,
builds `site/` and serves it at **news.onemillion.fager.tech**: release notes and questions
for the crew, each a Markdown file in `site/src/content/`. DNS stays at Simply.com, one
CNAME per subdomain.

*Why:* a subdomain needs a domain we control, and `fager.tech` is already on the Vercel team
at no extra cost (`onemillionbeers.beer` was $1,99, then $28,13 a year). Release notes and
questions want a page anyone can open without signing in, which the app deliberately is not
(D39). Astro turns Markdown into plain pages with no JavaScript, so posting is adding a file.

*Cost:*
- Two DNS records to keep at Simply, and the app's address now rides on `fager.tech`
  staying registered.
- A login belongs to an address: anyone who signed in on the old one signs in again. Two
  accounts existed when it moved.
- Supabase's Site URL, its redirect list and the Google client must all name the new address.
- The news site is public. A static page can't take votes, so answers go to the shared doc
  or the crew chat.
- Every push to `main` builds both projects, even when only one folder changed.

---

### D45 — The group of friends is a Crew *(renames D25's Party)*
**Decided** (owner, 2026-10-10: "Party is probably wrong, so it should probably be crew",
then "Rename Party->Crew"). The group of friends is a **crew** everywhere: on screen, in the
routes (`/crew`, `/setup/crew`), in the code, and in the database — `crews`,
`crew_members`, `crew_stats`, `crew_id`, `create_crew()`, `join_crew()`, `crew_summary()`
and the rest, renamed in place by `20261010120000_crew.sql`. A night out is still a
*session* in the code and a *night* on screen. D19's Party Rule is now the **Crew Rule**.
"Party" isn't used for anything.

*Why:* "party" reads as the night out rather than the people — the same confusion that sent
D22–D24 wrong — and a crew is what a group of friends calls itself. With nothing on
production but two sign-ups, renaming everything cost one migration; once crews and nights
exist it would mean renaming under live data with every phone needing the new app at once.
D25 said such a rename was "cheap now, expensive after the first migration" — this is the
last cheap moment.

*Cost:*
- One large migration. Postgres can't rename a function's parameters, so every function and
  policy that touches a crew was dropped and created again under the new names. Those
  definitions now live in the crew migration, not in the files that first created them.
- Older ADRs and QUESTIONS.md still say "party" — they're history, and this entry is the
  bridge between the two words.
- An old link to `/party` lands on the home screen.

---

### D44 — Google sign-in joins email, and auth email goes through Resend *(amends D31)*
**Decided** (owner, 2026-10-09: "set up the email and social login", reusing what already
works for Matro). Sign-in is email and password, magic link, and **Continue with Google**.
New accounts confirm their email before they can sign in — Supabase's default, which the
local stack now matches. All auth email goes out through Resend, as custom SMTP, from a
`fager.tech` address, using the branded templates in `supabase/templates/`. A forgotten
password is reset by an emailed link that lands on `/new-password`.

The Google button only appears when Supabase reports the provider switched on
(`/auth/v1/settings`), so the app never offers a sign-in that can't work, and turning
Google on or off needs no deploy.

*Why:* without a real mail server Supabase only emails the project's own team, so nobody
else could confirm an account or receive a link. Resend and the verified `fager.tech`
domain already work for Matro. Google is one tap on an Android phone — the platform v0 is
for ([D38](#d38--v0-ships-to-android-as-an-installable-app-and-to-iphones-as-a-web-app)) —
where typing an email and a password at the bar is exactly the friction D31 worried about.
Apple sign-in still waits: it needs the paid developer account D38 avoids.

*Cost:*
- Sign-up gains a step: open the inbox, tap the link. In return a mistyped address can't
  create an account nobody can get back into.
- The dashboard side — SMTP, templates, the Google client, redirect URLs — lives outside
  the repo. [DEPLOY.md](DEPLOY.md) records it, but nothing checks that it still matches.
- Google's sign-in screen names `bcyoiobsgtltrvpszyls.supabase.co` rather than the app
  unless Google verifies the branding; a custom auth domain is a paid Supabase add-on.
- Leans on Resend's free tier (100 emails a day) and on `fager.tech` staying verified.

---

### D43 — The app runs on Vercel, the backend on a hosted Supabase project
**Decided** (owner, 2026-10-09: "make sure this gets deployed on Vercel"). `main` deploys to
the Vercel project `onemillion` — **https://onemillion-gray.vercel.app** — as a static
build, every route rewritten to `index.html` (`app/vercel.json`). The backend is the
Supabase project `onemillion` (`bcyoiobsgtltrvpszyls`, eu-north-1, free plan), which has run
every migration so far. Other branches get preview deployments that talk to the same
database. Setup and day-to-day: [DEPLOY.md](DEPLOY.md).

*Why:* the owner's Vercel team already hosts Matro and fager.tech, so there was nothing new
to learn or pay for, and a Vite build is plain static files. Stockholm is the nearest
Supabase region (`F2`). HTTPS is also what Android needs before it will install the app
(D38, D42).

*Cost:*
- The migrations are **append-only** from here, because production has run them. A schema
  change is a new migration, applied to production before the app code that needs it is
  merged.
- Previews share production's data — there is one database. Fine for one group of friends;
  a staging project would take the free plan's second slot.
- The free plan pauses the database after 7 days without use, and a paused project has to be
  restored by hand before anyone can log a beer.
- Hobby-plan deploys want commits authored by the account owner, so this clone commits
  under the owner's identity.
- The address is a generated `onemillion-gray.vercel.app` until a custom domain is set up —
  one DNS record ([D46](#d46--the-app-moves-to-onemillionfagertech-and-a-news-site-sits-beside-it)).

---

### D42 — The client is a React web app with Tailwind and shadcn/ui *(supersedes D11)*
**Decided** (owner, 2026-10-07). The app is React + TypeScript on Vite, styled with
Tailwind and shadcn/ui (Radix underneath), in `app/`. It talks to Supabase directly —
reads under RLS, writes as D39 allows — and runs in any browser. Android installs it from
Chrome as an app; iPhones add it to the home screen. A native store build later wraps the
same code (Capacitor) rather than rewriting it.

Design: evolve the original mockup rather than start over (owner's choice). Stout-black and
gold, Anton for scoreboard numbers, Space Grotesk for the rest, dark only. Its own motifs:
everyone is a **bottle cap**; the milestone gauge is a **pint** that fills toward the next
rung; the million sits on **split-flap scoreboard tiles**; a night has a broadcast **LIVE**
bug with a match clock; the leaderboard is **the table**. Copy goes through i18next (D37).

*Why:* the owner asked for Tailwind and shadcn/ui and "React or something similar", and
shadcn only exists for the web. D11 picked Expo for native builds, but D38 already put v0
on the web and Android-by-link — a web app covers both, and installs on Android without a
store.

*Cost:* no native-only features in v0 (widgets, background push). An Android install from
Chrome needs HTTPS, so it only works once the app is hosted; on the local Wi-Fi it's a web
page. The bundle is ~300 KB gzipped before any code splitting. D38's "download link" APK
becomes a Capacitor build, if it's wanted at all.

---

### D41 — Sessions close on schedule, and last night can still be logged today
**Decided.** Session lifecycle (`C10`), in
`supabase/migrations/20261006140000_session_lifecycle.sql`:

- A `pg_cron` job closes overdue sessions every 5 minutes, stamping `closed_at` with the
  scheduled `closes_at` rather than the moment the job ran.
- Opening a new night closes the party's stale one first, so a party is never stuck behind
  a job that hasn't run (only one session per party may be open).
- Past `closes_at`, beers and new attendees are refused even before the job gets there.
- A nightly job deletes single-attendee sessions a week after they closed (D36).
- `closes_at` counts from the **later of the start and the moment the session was opened**.
  A live night still closes at 09:00 the next morning; a night logged after the fact stays
  open until 09:00 the morning after it was opened.
- D16 is enforced for the app: a session starts no earlier than yesterday (in its own
  timezone) and not in the future, and a beer's time falls between its session's start and
  now.
- Whoever starts a night can add party-mates to it in the same request as themselves.

*Why:* D32 and D16 collided. A session for last night, opened at lunchtime, would have
been closed on arrival, so D16's "log today or yesterday" couldn't work. Counting from the
opening fixes that without changing live nights. The safety net matters because one missed
job would otherwise block the party's next night.

*Cost:* an offline tap (`C8`) that syncs after closing time is refused like any late beer —
the offline queue has to decide what to tell the user. A night logged after the fact can
stay open up to 27 hours after it was opened. Cron runs in UTC; the purge is at 04:17 UTC.

*Verified:* `supabase/tests/lifecycle_test.sql` — closing time without the job, the safety
net, the job's timing, which sessions the purge takes and keeps, the D16 window for
sessions and beers, and that only the database runs the jobs. Each rule was broken on
purpose to confirm a test fails.

---

### D40 — Totals are kept by triggers; weekly figures are computed on read
**Decided.** Counters (`C4`), in `supabase/migrations/20261006130000_stats.sql`:

- `global_stats`, `party_stats` and `profile_stats` hold live totals, voids excluded. An
  `AFTER` trigger on `beers` keeps them in the same transaction as the beer, and
  `recompute_stats()` rebuilds all three from `beers`.
- Beers this week and streaks are computed when asked, by `profile_summary()` and
  `party_summary()` — one call per dashboard.
- A **streak week** is a Monday-start week in which you were at a session holding at least
  one live beer. The designated driver keeps their streak; a night whose beers were all
  voided doesn't count. A streak survives until a whole week passes without a session.
- The global total is visible to everyone signed in, party numbers to members, and a
  person's numbers to them and their party-mates.

*Why:* totals are what milestones cross and what every dashboard shows, so they must be
exact and cheap to read. Weekly figures change when time passes, not only when beers land.
Storing them would need a `pg_cron` job to break streaks on Monday morning, kept in step with
voids; computed on read they are simply right.

*Cost:* supersedes ARCHITECTURE §5's "weekly figures are rolled by `pg_cron`". A summary
walks the person's or party's sessions — trivial for a friend group for years, worth
revisiting at guild scale. Every beer write updates the single `global_stats` row, so beer
writes queue behind each other (fine to hundreds a second; shard the row if guilds ever get
there). A person's total includes their other parties, so party-mates see that in aggregate.

*Verified:* `supabase/tests/stats_test.sql` covers single beers, rounds, voids, un-voids,
deletes and beers born voided across all three scopes; that a fresh recompute matches the
triggers; eight weeks of nights with known streaks, the designated driver included; and who
may read what. Each was broken on purpose to confirm a test fails.

---

### D39 — Access rules: read tables directly, change membership through functions
**Decided.** Row level security (`F5`), in `supabase/migrations/20261006120000_rls.sql`:

- Clients **read** tables directly. You see your parties, their members (past ones
  included), their sessions and beers, and your own beers even after leaving.
- Clients **write** directly only where the row itself says who may: your own profile,
  starting a session, checking yourself in (or adding a party-mate once you're there, or
  to a night you started), logging a beer in your own name, voiding one within 24 hours,
  skipping rounds, and a captain renaming the party.
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

*Amended by [D42](#d42--the-client-is-a-react-web-app-with-tailwind-and-shadcnui-supersedes-d11)
(2026-10-07):* there is no Expo build. Android installs the web app from Chrome as an
installable app (it needs the hosted, HTTPS version); a download-link APK, if still wanted,
would be a Capacitor wrapper of the same code.

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

*Amended by [D41](#d41--sessions-close-on-schedule-and-last-night-can-still-be-logged-today):*
the clock starts at the later of the start and the moment the session was opened, so a
night logged after the fact (D16) isn't closed on arrival.

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

*Amended by [D44](#d44--google-sign-in-joins-email-and-auth-email-goes-through-resend-amends-d31)
(2026-10-09):* Google sign-in is in; Apple stays deferred. The reset-password flow is built.

---

### D30 — The Party Rule is enforced on `beers`, not on `sessions`
**Decided.** The "at least two people" check is a `BEFORE INSERT` trigger on `beers`,
which refuses any beer whose session has fewer than two attendees. `sessions` itself
carries no minimum.

*Why:* [ARCHITECTURE §3.4](ARCHITECTURE.md#34-the-crew-rule--enforced-in-the-database)
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

### ~~D11 — Client is Expo (React Native) with web export~~
**Superseded by [D42](#d42--the-client-is-a-react-web-app-with-tailwind-and-shadcnui-supersedes-d11)** — a React web app with Tailwind and shadcn/ui; native later via Capacitor.

One codebase to iOS, Android and web via react-native-web.

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
[ARCHITECTURE §3.4](ARCHITECTURE.md#34-the-crew-rule--enforced-in-the-database).

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

*Amended by [D45](#d45--the-group-of-friends-is-a-crew-renames-d25s-party) (2026-10-10):*
the group of friends is a **Crew** now. Session stays the night; Guild stays many crews.

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
