# Deploying

How the live app is put together, how a change reaches it, and the one-time setup that
lives in the Supabase and Google dashboards instead of this repo
([D43](DECISIONS.md#d43--the-app-runs-on-vercel-the-backend-on-a-hosted-supabase-project),
[D44](DECISIONS.md#d44--google-sign-in-joins-email-and-auth-email-goes-through-resend-amends-d31),
[D46](DECISIONS.md#d46--the-app-moves-to-onemillionfagertech-and-a-news-site-sits-beside-it)).

## What runs where

| | Where | Notes |
|---|---|---|
| **The app** | Vercel project `onemillion`, team "Jonathan Fager's projects" — **https://onemillion.fager.tech** (`onemillion-gray.vercel.app` still answers) | A static build of `app/`, configured by `app/vercel.json` |
| **The news site** | Vercel project `onemillion-news` — **https://news.onemillion.fager.tech** | Release notes and questions, built from `site/` (Astro); see `site/CLAUDE.md` for posting |
| **The backend** | Supabase project `onemillion`, ref `bcyoiobsgtltrvpszyls`, eu-north-1 (Stockholm), free plan | Postgres, Auth, Realtime, `pg_cron` |
| **Email** | Resend, sending from `fager.tech` | Plugged into Supabase as custom SMTP |
| **Google sign-in** | A Google Cloud OAuth client | Supabase does the talking; the app only has a button |

## How a change goes live

**The app and the news site.** Push to `main` and Vercel builds and serves both in under a
minute — each project builds on every push, whichever folder changed. Any other
branch gets a preview deployment of its own; preview links need a Vercel login, the
production address doesn't. Work on a branch, test it locally, merge to `main` — friends
run `main`.

The app needs two environment variables, set in the Vercel project for every environment:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://bcyoiobsgtltrvpszyls.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`) |

The news site's polls (D47) need the same two values under other names, set in the
`onemillion-news` project: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Both are public by design — they ship inside the app, and row-level security is what
guards the data. Vite bakes them in at build time, so changing one takes a redeploy. A
build without them refuses to run rather than deploying a blank page.

On the Hobby plan, Vercel can refuse to deploy a commit whose author isn't the account's
GitHub identity — it did for Matro. This clone commits as
`Jonathan Fager <jonathanfager@proton.me>` (repo-local git config). A deployment stuck in
`BLOCKED` means a commit by someone else; re-author it.

**The database.** Production has run every migration in `supabase/migrations/`, so they are
**append-only** now: a change is a new file, never an edit.

1. Write the migration, then `./supabase/tests/run-supabase.sh` — a fresh database from
   every migration, then every test.
2. Apply it to production, before merging app code that needs it. Either:
   - ask Claude Code — it applies the file with the Supabase MCP (`apply_migration`), then
     renames the recorded version to the file's timestamp, because the MCP records its own;
   - or use the CLI: `npx supabase login`, `npx supabase link --project-ref
     bcyoiobsgtltrvpszyls`, `npx supabase db push`.
3. If the tables the app sees changed, regenerate `app/src/lib/database.types.ts`.

Every migration so far went in through the MCP and was renamed to its file version
afterwards, so `supabase migration list` shows local and production in step. To check a
deploy, run `supabase/fingerprint.sql` on both — locally with `docker exec -i
supabase_db_onemillion psql -U postgres < supabase/fingerprint.sql`, in production through the
MCP or the SQL editor. It hashes the schema section by section (functions, policies, views,
triggers, constraints, indexes, columns, grants, RLS, cron jobs, publication, the badge
catalogue, the milestone ladder); every line must match. It last did on 2026-10-21, after
the milestones, achievements and late-taps migrations.

## How a deploy reaches a phone

The app installs to the home screen and opens from its own cache, so it works with no signal
([D48](DECISIONS.md#d48--the-app-installs-to-the-home-screen-and-its-mark-is-the-pint)–[D52](DECISIONS.md#d52--install-offers-a-one-time-banner-on-home-a-card-on-me-a-link-on-welcome-for-iphone)).
A service worker (`app/sw/sw.ts`, built into `dist/sw.js`) keeps this build's files and
answers every page load with them. It never touches Supabase.

- **A deploy lands on the next launch.** A phone checks for a new worker on launch, the
  first time the app comes back on screen, and after that at most every 10 minutes and hourly
  while it's open. The new one downloads the build in the background and takes over; the app
  then shows "Fresh version on tap · Reload". Tapping Reload switches at once; otherwise the
  next launch is the new build.
- **So phones run older builds for a while** — not just the previous one: a phone that
  hasn't opened the app in weeks still has the build it last saw, until it next opens with
  signal. A migration must keep working with the builds before it: add tables, columns and
  functions; don't rename, drop or change the signature of anything an app build calls. When
  something must go, keep the old name working for some weeks first. Migration first, app
  second, as before.
- **Never roll back past the worker.** Vercel's Instant Rollback (or a revert) to a deployment
  from before `app/sw/` existed serves no `sw.js`, so installed phones keep their cached build
  and can no longer be reached — not even by the kill switch. Roll forward instead: revert
  the app change and keep `app/sw/`, the plugin and `vercel.json`, or deploy with
  `VITE_SW_OFF=1`.
- **Headers** (`app/vercel.json`): `sw.js` and `manifest.webmanifest` are `no-cache`, so a
  phone always sees the newest worker; `/assets/*` are immutable; icons and screenshots keep
  a day. A missing `/assets/` file is a real 404, not the app's page.
- **One phone stuck on a bad build:** in the app, **Me → Reset the app** (at the bottom,
  under the build). In a browser, or the installed app on Android,
  `https://onemillion.fager.tech/?sw-reset` does the same. Both remove the worker and its
  cache and reload from the network. A link can't reach an iPhone home-screen app — it opens
  in Safari, which keeps its own storage — so if that app can't even reach Me, remove its
  icon (that deletes its data), add it again from Safari, and sign in with the emailed code.
- **Every phone stuck:** set `VITE_SW_OFF=1` in the Vercel project and redeploy. That ships a
  worker that clears every cache, unregisters itself and reloads open windows. Remove the
  variable and redeploy to bring the worker back.
- **Which build is a phone running?** The bottom of Me shows "Build" and the commit.

The build checks the manifest, the icon sizes and that every file `index.html` names is
cached, and fails if anything is off. The icons are PNGs rendered by hand from
`app/design/*.svg` (`app/scripts/make-icons.ps1`, Windows) and committed.

## One-time setup in the dashboards

These hold secrets or live outside the repo, so they're done by hand, in this order. The
first one has to happen before anyone signs up.

### 0. The addresses — DNS at Simply.com

`fager.tech` is on the Vercel team, but its DNS lives at Simply.com, so each subdomain is
one record there. Vercel shows the domains as "Invalid Configuration" until these exist.

| Type | Name | Points to |
|---|---|---|
| CNAME | `onemillion` | `1f1695937a689901.vercel-dns-017.com.` |
| CNAME | `news.onemillion` | `1adce561a71bfcf5.vercel-dns-017.com.` |

The targets are the ones Vercel recommends for these two projects
(`cname.vercel-dns.com.` works too). HTTPS certificates follow by themselves within minutes.

### 1. Where links may land — Supabase → Authentication → URL Configuration

- **Site URL:** `https://onemillion.fager.tech`
- **Redirect URLs** — add all three:
  - `https://onemillion.fager.tech/**`
  - `https://onemillion-gray.vercel.app/**` (the old address still answers)
  - `https://onemillion-*-jonathan-fagers-projects-300ce6dd.vercel.app/**` (preview deployments)

Every email link and every Google round-trip comes back to the address that asked for it,
and Supabase only honours addresses on this list. Anything else falls back to the Site
URL, which on a new project is `http://localhost:3000` — a link that goes nowhere.

### 2. Email through Resend — Supabase → Authentication → Emails → SMTP Settings

Turn on custom SMTP:

| Field | Value |
|---|---|
| Sender email | any address at `fager.tech`, e.g. `onemillion@fager.tech` |
| Sender name | `One Million Beers` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key — resend.com → API Keys; sending access for `fager.tech` is enough |

Supabase's built-in mailer only delivers to the project team's own addresses, a few an
hour. Without Resend, a friend who signs up never gets the confirmation email. The sender
must be `@fager.tech`: that's the domain verified in Resend, and Resend refuses anything
else. The key lives in Supabase's dashboard and nowhere in this repo. Resend's free tier
sends 100 emails a day.

### 3. The emails themselves — Supabase → Authentication → Emails → Templates

For each template, set the subject and paste the whole file as the body:

| Template | Subject | Body |
|---|---|---|
| Confirm signup | `Confirm your email · One Million Beers` | [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html) |
| Magic link | `Your sign-in link · One Million Beers` | [`supabase/templates/magic_link.html`](../supabase/templates/magic_link.html) |
| Reset password | `Pick a new password · One Million Beers` | [`supabase/templates/recovery.html`](../supabase/templates/recovery.html) |
| Invite user | `You're invited · One Million Beers` | [`supabase/templates/invite.html`](../supabase/templates/invite.html) |
| Change email address | `Confirm your new email · One Million Beers` | [`supabase/templates/email_change.html`](../supabase/templates/email_change.html) |

The sign-up and magic-link emails carry a 6-digit code as well as the link
([D53](DECISIONS.md#d53--email-sign-in-carries-a-6-digit-code-as-well-as-the-link)): an
iPhone home-screen app can't receive a link, because it opens in Safari. A template pasted
before the code was added sends no code, so paste these two again whenever the files change.
Under **Sign In / Providers → Email**, "Email OTP length" must be between 6 and 10; the
default 6 is right.

The local stack sends the same files (`supabase/config.toml`), so what lands in Mailpit is
what friends get. Reauthentication is the one template left at Supabase's default: the app never
asks for it.

### 4. Google sign-in

In the [Google Cloud console](https://console.cloud.google.com), in a project of its own
("One Million Beers"):

1. **Google Auth Platform → Branding:** app name `One Million Beers`, a support email, and
   `bcyoiobsgtltrvpszyls.supabase.co` under authorised domains.
2. **Audience:** External, then **Publish app**. It only asks for name and email, so Google
   needs no review; left in Testing, only listed test users get in.
3. **Clients → Create client:** type *Web application*.
   - Authorised JavaScript origins: `https://onemillion.fager.tech` and `https://onemillion-gray.vercel.app`
   - Authorised redirect URIs: `https://bcyoiobsgtltrvpszyls.supabase.co/auth/v1/callback`
4. Copy the client ID and secret into **Supabase → Authentication → Sign In / Providers →
   Google**, and switch it on.

The app asks Supabase which providers are on, so **Continue with Google** appears by
itself — no deploy needed.

A login belongs to the address it was made on, so anyone who signed in at
`onemillion-gray.vercel.app` signs in once more at `onemillion.fager.tech`.

## Free-plan limits worth knowing

- **Supabase pauses a free project after 7 days without use.** Restoring it from the
  dashboard takes a few minutes and loses nothing. A weekly night out keeps it awake.
- The free plan allows two active projects. Matro and Bryggans Bryggeri are paused, so
  waking either one means pausing another or upgrading.
- Vercel's Hobby plan is for personal, non-commercial use — a group of friends is fine.

## Keeping an eye on production

- **Advisors** (Supabase → Advisors). Expected, and fine:
  - "SECURITY DEFINER function executable" for signed-in users: D39's membership functions
    and RLS helpers, the two poll functions, and the badge reads (`can_see_unlock`,
    `achievement_catalogue`, `profile_achievement_progress`, `crew_achievement_progress`;
    D66).
  - The same for signed-out visitors on `cast_vote` and `poll_results` only (D47).
  - "RLS enabled, no policy" on `polls` and `poll_votes`, reachable only through those two
    functions, and on `achievements`, the badge catalogue, read only through
    `achievement_catalogue()`.
  - "Leaked password protection disabled": checking new passwords against known leaks is a
    paid-plan feature.

  Anything else is news.
- **Polls** (D47), in the SQL editor:
  - the votes: `select choice, name, comment from poll_votes where poll_id = 'address';`
  - close a poll: `update polls set is_open = false where id = 'address';` (and mark the
    post `status: decided`, with the answer written in)
  - remove a stray vote: `delete from poll_votes where poll_id = 'address' and name = '…';`
- **The scheduled jobs:** `select jobname, status, start_time from cron.job_run_details
  order by start_time desc limit 10;` in the SQL editor. `close-stale-sessions` runs every
  5 minutes, `settle-drivers` every 10, `purge-lonely-sessions` at 04:17 UTC and
  `sweep-achievements` at 04:37 UTC. A badge evaluator that fails logs a warning
  ("achievements skipped …") instead of failing a beer: search the Postgres logs for it.
- **Logs:** Supabase → Logs for the database and auth; the deployment page on Vercel for
  builds.
