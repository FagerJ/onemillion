# Deploying

How the live app is put together, how a change reaches it, and the one-time setup that
lives in the Supabase and Google dashboards instead of this repo
([D43](DECISIONS.md#d43--the-app-runs-on-vercel-the-backend-on-a-hosted-supabase-project),
[D44](DECISIONS.md#d44--google-sign-in-joins-email-and-auth-email-goes-through-resend-amends-d31)).

## What runs where

| | Where | Notes |
|---|---|---|
| **The app** | Vercel project `onemillion`, team "Jonathan Fager's projects" — **https://onemillion-gray.vercel.app** | A static build of `app/`, configured by `app/vercel.json` |
| **The backend** | Supabase project `onemillion`, ref `bcyoiobsgtltrvpszyls`, eu-north-1 (Stockholm), free plan | Postgres, Auth, Realtime, `pg_cron` |
| **Email** | Resend, sending from `fager.tech` | Plugged into Supabase as custom SMTP |
| **Google sign-in** | A Google Cloud OAuth client | Supabase does the talking; the app only has a button |

## How a change goes live

**The app.** Push to `main` and Vercel builds and serves it in under a minute. Any other
branch gets a preview deployment of its own; preview links need a Vercel login, the
production address doesn't. Work on a branch, test it locally, merge to `main` — friends
run `main`.

The app needs two environment variables, set in the Vercel project for every environment:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://bcyoiobsgtltrvpszyls.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`) |

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

The first five migrations went in through the MCP and were renamed to their file versions
afterwards, so `supabase migration list` shows local and production in step. A schema
fingerprint — functions, policies, grants, triggers, constraints, indexes, cron jobs,
publication — matched the local database section for section.

## One-time setup in the dashboards

These hold secrets or live outside the repo, so they're done by hand, in this order. The
first one has to happen before anyone signs up.

### 1. Where links may land — Supabase → Authentication → URL Configuration

- **Site URL:** `https://onemillion-gray.vercel.app`
- **Redirect URLs** — add both:
  - `https://onemillion-gray.vercel.app/**`
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

The local stack sends the same files (`supabase/config.toml`), so what lands in Mailpit is
what friends get.

### 4. Google sign-in

In the [Google Cloud console](https://console.cloud.google.com), in a project of its own
("One Million Beers"):

1. **Google Auth Platform → Branding:** app name `One Million Beers`, a support email, and
   `bcyoiobsgtltrvpszyls.supabase.co` under authorised domains.
2. **Audience:** External, then **Publish app**. It only asks for name and email, so Google
   needs no review; left in Testing, only listed test users get in.
3. **Clients → Create client:** type *Web application*.
   - Authorised JavaScript origins: `https://onemillion-gray.vercel.app`
   - Authorised redirect URIs: `https://bcyoiobsgtltrvpszyls.supabase.co/auth/v1/callback`
4. Copy the client ID and secret into **Supabase → Authentication → Sign In / Providers →
   Google**, and switch it on.

The app asks Supabase which providers are on, so **Continue with Google** appears by
itself — no deploy needed.

### 5. Optional — a nicer address

`onemillion.fager.tech` would take one DNS record: `fager.tech` is already on this Vercel
team, but its DNS is at Simply.com, so the CNAME Vercel asks for goes there. Then swap the
new address into steps 1 and 4. Do it before friends sign in: a login belongs to one
address and doesn't carry over to another.

## Free-plan limits worth knowing

- **Supabase pauses a free project after 7 days without use.** Restoring it from the
  dashboard takes a few minutes and loses nothing. A weekly night out keeps it awake.
- The free plan allows two active projects. Matro and Bryggans Bryggeri are paused, so
  waking either one means pausing another or upgrading.
- Vercel's Hobby plan is for personal, non-commercial use — a group of friends is fine.

## Keeping an eye on production

- **Advisors** (Supabase → Advisors): the 13 "SECURITY DEFINER function executable"
  warnings are intended — they are D39's membership functions and RLS helpers, which
  signed-in users are meant to call. Anything else is news.
- **The scheduled jobs:** `select jobname, status, start_time from cron.job_run_details
  order by start_time desc limit 10;` in the SQL editor. `close-stale-sessions` runs every
  5 minutes, `purge-lonely-sessions` at 04:17 UTC.
- **Logs:** Supabase → Logs for the database and auth; the deployment page on Vercel for
  builds.
