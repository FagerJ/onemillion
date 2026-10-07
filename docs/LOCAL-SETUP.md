# Local setup

Everything so far was built in a cloud session. This is how to pick it up on your own
machine. Nothing needs recreating — it's all in git.

## 1. Get the code

```bash
git clone https://github.com/FagerJ/onemillion.git
cd onemillion
git checkout claude/million-beers-architecture-inbc70
```

`main` has only the initial commit. All the work is on that branch.

Already have a clone?

```bash
git fetch origin
git checkout claude/million-beers-architecture-inbc70
```

## 2. Install the tools

| Tool | Why | Install |
|---|---|---|
| **Node 20+** | the app (`app/`, Vite) | [nodejs.org](https://nodejs.org) or `brew install node` |
| **Docker Desktop** | runs the local Supabase stack | [docker.com](https://docker.com) |
| **Supabase CLI** | migrations, local Postgres + Auth + Realtime | `brew install supabase/tap/supabase` |
| **Claude Code** | picks up `CLAUDE.md` automatically | `npm install -g @anthropic-ai/claude-code` |

### On Windows

What it took on the owner's Windows 11 machine:

1. In a terminal opened **as Administrator**: `wsl --install --no-distribution`, then
   restart. Docker Desktop needs WSL2 but not a Linux distribution of its own.
2. `winget install Docker.DockerDesktop`, open it, accept the agreement, wait for
   "Engine running".
3. No Supabase CLI install — `npx supabase …` fetches it on first use.
4. Run the scripts from **Git Bash**. Shells opened before Docker was installed don't have
   `docker` on PATH; the test script falls back to Docker's install folder.

## 3. Start the local Supabase stack

`supabase/config.toml` is committed, so there is nothing to initialise:

```bash
npx supabase start    # boots Postgres, Auth, Realtime, Storage in Docker (first run downloads several GB of images)
npx supabase db reset # applies every migration from scratch
```

`supabase start` prints the local API URL and keys — those go in `app/.env.local`
(see "Run the app" below; Git ignores it).

The local stack provides `auth.users` and the `anon` / `authenticated` roles, which is why
this is better than the bare-Postgres fallback below.

**Note:** signed-out visitors (`anon`) can't read or write anything — there is no public
surface yet. Signed-in users see their own parties only, and change membership through the
functions in `20261006120000_rls.sql` ([D39](DECISIONS.md#d39--access-rules-read-tables-directly-change-membership-through-functions)).

## 4. Run the tests

With Docker (any OS, including Git Bash on Windows):

```bash
./supabase/tests/run-supabase.sh             # db reset, then every *_test.sql
./supabase/tests/run-supabase.sh --no-reset  # just the tests
```

It runs `psql` inside the database container, so nothing needs installing on the host, and
wraps each test file in `begin … rollback` so the dev database stays clean.

Without Docker, on **Linux only**, the fallback runner builds a throwaway Postgres cluster
and stubs the Supabase-provided pieces:

```bash
./supabase/tests/run.sh
./supabase/tests/run.sh --fresh    # rebuild the cluster first
```

It needs Postgres server binaries (`brew install postgresql@16`, or
`apt install postgresql-16`) and runs the cluster as an unprivileged user, because Postgres
refuses to run as root.

Either way you should see:

```
→ lifecycle_test.sql
NOTICE:  ALL LIFECYCLE TESTS PASSED
→ rls_test.sql
NOTICE:  ALL RLS TESTS PASSED
→ schema_test.sql
NOTICE:  ALL SCHEMA TESTS PASSED
→ stats_test.sql
NOTICE:  ALL STATS TESTS PASSED
```

## 4½. Run the app

The app lives in `app/` (React + Vite + Tailwind + shadcn/ui, [D42](DECISIONS.md#d42--the-client-is-a-react-web-app-with-tailwind-and-shadcnui-supersedes-d11)).
It needs the local Supabase stack running (step 3) and an `app/.env.local` pointing at it.
Write that file once from `supabase status`:

```bash
npx supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)=' | sed -e 's/^API_URL=/VITE_SUPABASE_URL=/' -e 's/^PUBLISHABLE_KEY=/VITE_SUPABASE_PUBLISHABLE_KEY=/' > app/.env.local
```

Then install and start it:

```bash
npm --prefix app install
npm --prefix app run dev
```

Open **http://localhost:5173**. Sign in with any demo account from
`supabase/seed.sql` (the password is in its header), or create your own account and join
the demo party with the code `SKAL42`.

**On your phone:** same Wi-Fi as the PC, open `http://<the PC's IP>:5173` (Vite prints it
as "Network"). The app points itself at the PC's database automatically. The first time,
Windows asks whether Node.js may accept connections — allow it for private networks.
Installing it as an app needs HTTPS, which comes with hosting; locally it runs as a web page.

**Emails** (magic links, password resets) don't leave the PC: they land in Mailpit at
http://127.0.0.1:54324.

`npm --prefix app run build` type-checks and builds; `npx --prefix app oxlint app/src`
lints.

## 5. Point Claude Code at it

```bash
claude
```

`CLAUDE.md` loads automatically, so it starts oriented. If you want to be explicit:

> Read CLAUDE.md. We're building v0 — the schema and RLS are written and tested; counters,
> the app runs; the game layer is next.

## 6. What's next

In order, from `docs/ROADMAP.md`. Every question these depend on is answered.

1. ~~**`F5` RLS policies**~~ — done ([D39](DECISIONS.md#d39--access-rules-read-tables-directly-change-membership-through-functions)).
2. ~~**`C4` counter roll-ups**~~ — done ([D40](DECISIONS.md#d40--totals-are-kept-by-triggers-weekly-figures-are-computed-on-read)).
3. ~~**`C10` session lifecycle jobs**~~ — done ([D41](DECISIONS.md#d41--sessions-close-on-schedule-and-last-night-can-still-be-logged-today)).
4. **`C9`/`C12`/`G1`/`G4`/`G5`** milestones, the achievement engine and combos.
5. ~~**`F3`/`C1`–`C11`** the app~~ — first version running ([D42](DECISIONS.md#d42--the-client-is-a-react-web-app-with-tailwind-and-shadcnui-supersedes-d11)). Still to come: the offline queue (`C8`).

## A hosted project, eventually

Local is right for development, but your friends need a real one on their phones. When you
get there:

```bash
supabase projects create one-million-beers --region eu-north-1
supabase link --project-ref <ref>
supabase db push
```

No hosted project exists yet, and nothing has been applied to one.
