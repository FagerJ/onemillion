#!/usr/bin/env bash
# Apply the migrations to a throwaway Postgres and run the behavioural tests.
#
#   ./supabase/tests/run.sh
#
# Needs postgres server binaries (Debian/Ubuntu: postgresql-16). Creates a
# cluster under /var/lib/omb-pg, runs, and leaves it running for re-runs.
# Pass --fresh to rebuild the cluster from scratch.
set -euo pipefail

PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}
export PATH="$PGBIN:$PATH"
DATA=${DATA:-/var/lib/omb-pg}
PORT=${PORT:-5433}
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Postgres refuses to run as root, so the cluster is owned by a throwaway user.
RUNAS=postgres
id -u "$RUNAS" >/dev/null 2>&1 || RUNAS=pgtest
if ! id -u "$RUNAS" >/dev/null 2>&1; then
  useradd -M -s /bin/bash pgtest
  RUNAS=pgtest
fi

if [[ "${1:-}" == "--fresh" || ! -d "$DATA/base" ]]; then
  # Stop any cluster already running on this data dir, or initdb refuses and
  # the old postmaster keeps the socket.
  if [[ -f "$DATA/postmaster.pid" ]]; then
    su -s /bin/bash "$RUNAS" -c \
      "PATH=$PGBIN:\$PATH pg_ctl -D $DATA -m immediate -w -t 20 stop" >/dev/null 2>&1 || true
  fi
  rm -rf "$DATA"; mkdir -p "$DATA"
  chown "$RUNAS:$RUNAS" "$DATA"; chmod 700 "$DATA"
  su -s /bin/bash "$RUNAS" -c "PATH=$PGBIN:\$PATH initdb -D $DATA -U postgres -A trust" >/dev/null
fi

if ! pg_isready -h "$DATA" -p "$PORT" -q 2>/dev/null; then
  # listen_addresses='' means unix socket only: no TCP port to collide with a
  # stray postmaster left over from an earlier run.
  su -s /bin/bash "$RUNAS" -c \
    "PATH=$PGBIN:\$PATH pg_ctl -D $DATA -o \"-p $PORT -k $DATA -c listen_addresses=''\" -l $DATA/log start -w -t 20" >/dev/null
fi
chmod 711 "$DATA"   # let the invoking user reach the socket

export PGHOST="$DATA" PGPORT="$PORT" PGUSER=postgres
dropdb --if-exists omb >/dev/null 2>&1 || true
createdb omb

# Stub the pieces Supabase provides in a real project.
psql -v ON_ERROR_STOP=1 -q -d omb <<'SQL'
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
SQL

for m in "$REPO"/supabase/migrations/*.sql; do
  echo "→ $(basename "$m")"
  psql -v ON_ERROR_STOP=1 -q -d omb -f "$m"
done

echo "→ tests"
psql -v ON_ERROR_STOP=1 -q -d omb -f "$REPO/supabase/tests/schema_test.sql"
