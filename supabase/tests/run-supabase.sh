#!/usr/bin/env bash
# Rebuild the local Supabase database from the migrations, then run the
# behavioural tests against it inside a transaction that is rolled back.
#
#   ./supabase/tests/run-supabase.sh             # reset + test
#   ./supabase/tests/run-supabase.sh --no-reset  # test the current database
#
# Needs Docker running and `supabase start` done once. Works in Git Bash on
# Windows as well as macOS and Linux — unlike run.sh, which is Linux-only.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

# Docker Desktop on Windows isn't on PATH in shells started before it was installed.
if ! command -v docker >/dev/null 2>&1 && [[ -d "/c/Program Files/Docker/Docker/resources/bin" ]]; then
  export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
fi

SUPABASE="supabase"
command -v supabase >/dev/null 2>&1 || SUPABASE="npx -y supabase"

if [[ "${1:-}" != "--no-reset" ]]; then
  $SUPABASE db reset
fi

DB="supabase_db_$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)"

for t in supabase/tests/*_test.sql; do
  echo "→ $(basename "$t")"
  { echo 'begin;'; cat "$t"; echo 'rollback;'; } \
    | docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q -f -
done
