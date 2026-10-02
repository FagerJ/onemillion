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
| **Node 20+** | Expo | [nodejs.org](https://nodejs.org) or `brew install node` |
| **Docker Desktop** | runs the local Supabase stack | [docker.com](https://docker.com) |
| **Supabase CLI** | migrations, local Postgres + Auth + Realtime | `brew install supabase/tap/supabase` |
| **Claude Code** | picks up `CLAUDE.md` automatically | `npm install -g @anthropic-ai/claude-code` |

## 3. Start the local Supabase stack

The repo has `supabase/migrations/` but no `config.toml` yet, so initialise once:

```bash
supabase init     # creates supabase/config.toml next to the existing migrations
supabase start    # boots Postgres, Auth, Realtime, Storage in Docker
supabase db reset # applies every migration from scratch
```

`supabase start` prints the local API URL and keys — those go in `.env` for the Expo app
(`.gitignore` already covers `.env`).

The local stack provides `auth.users` and the `anon` / `authenticated` roles, which is why
this is better than the bare-Postgres fallback below.

**Note:** RLS is currently enabled on every table with **no policies**, which denies all
access through the `anon` and `authenticated` roles. That's deliberate — the schema fails
closed. Until the policy migration is written, queries from a client will return nothing.

## 4. Run the tests

With Docker:

```bash
supabase db reset                                    # migrations
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
  -f supabase/tests/schema_test.sql                  # assertions
```

Without Docker, the fallback runner builds a throwaway Postgres cluster and stubs the
Supabase-provided pieces:

```bash
./supabase/tests/run.sh
./supabase/tests/run.sh --fresh    # rebuild the cluster first
```

It needs Postgres server binaries (`brew install postgresql@16`, or
`apt install postgresql-16`) and runs the cluster as an unprivileged user, because Postgres
refuses to run as root.

Either way you should see:

```
NOTICE:  ALL SCHEMA TESTS PASSED
```

## 5. Point Claude Code at it

```bash
claude
```

`CLAUDE.md` loads automatically, so it starts oriented. If you want to be explicit:

> Read CLAUDE.md and docs/QUESTIONS.md. We're at the start of v0 — the schema is written
> and tested, RLS policies and the Expo app are next.

## 6. What's next

In order, from `docs/ROADMAP.md`:

1. **`F5` RLS policies** — party-scoped, with the `is_party_member` SECURITY DEFINER helper.
   Doesn't depend on any open question. Needs a test that connects as a non-owner role,
   since the current tests run as the table owner and bypass RLS entirely.
2. **`C4` counter roll-ups** — `party_stats`, `global_stats`, `profile_stats` triggers.
3. **`G1'`/`G4`/`G5`** milestones + the combo engine.
4. **`F3`/`C1`–`C11`** the Expo app.

Answers in `docs/QUESTIONS.md` affect steps 2 and 3 (streak units, party cap, GDPR
nullability, timezone, week start, beer-type vocabulary). Step 1 can start now.

## A hosted project, eventually

Local is right for development, but your friends need a real one on their phones. When you
get there:

```bash
supabase projects create one-million-beers --region eu-north-1
supabase link --project-ref <ref>
supabase db push
```

No hosted project exists yet, and nothing has been applied to one.
