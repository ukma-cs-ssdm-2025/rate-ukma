#!/usr/bin/env bash
# shellcheck disable=SC2029
#
# Copy live's database to staging without any personal data.
#
# Runs on your machine and reaches both hosts over ssh:
#   live:    pg_dump -> throwaway postgres container (no volume) -> anonymise.sql
#   staging: restore into rateukma_new, compare counts, keep staging's superusers,
#            swap rateukma_new in for rateukma, health-check, clear the cache.
#
# Raw personal data never leaves the live host: the anonymised dump is the only
# thing streamed to staging. A failure before the swap leaves staging's database
# untouched; a failed health check renames the old database back.
#
# Run it only when the owner asks. Staging is the only possible target.

set -euo pipefail

# Variables in ssh command strings are deliberately expanded here, before the
# command goes to the remote shell; they are not remote shell variables.

readonly LIVE_PG_CONTAINER="${LIVE_PG_CONTAINER:-rate_ukma_postgres}"
readonly STAGING_PG_CONTAINER="${STAGING_PG_CONTAINER:-rate_ukma_postgres}"
readonly LIVE_DB="${LIVE_DB:-rateukma}"
readonly ANON_DB="rateukma_anon"
readonly NEW_DB="rateukma_new"
readonly PREV_DB="rateukma_prev"
readonly PROJECT_DIR="${PROJECT_DIR:-/opt/rateukma/src}"
readonly STATIC_ROOT="${STATIC_ROOT:-/opt/rateukma/static}"
readonly MIN_FREE_KB="${MIN_FREE_KB:-2097152}"
readonly MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
readonly HEALTHCHECK_TIMEOUT="${HEALTHCHECK_TIMEOUT:-5}"

LIVE_HOST=""
STAGING_HOST=""
ASSUME_YES=0
ANON_CONTAINER=""
STAGING_TMP=""
SWAP_STARTED=0

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ANON_SQL="$SCRIPT_DIR/anonymise.sql"

usage() {
  cat <<'USAGE'
Usage: copy-live-to-staging.sh --live-host HOST --staging-host HOST [--yes]

Copies live's catalog and ratings to staging, anonymising every person and the
text they wrote. The live database is never modified.

  --live-host HOST     ssh alias of the live host (rate-ukma-live)
  --staging-host HOST  ssh alias of the staging host (rate-ukma-staging)
  --yes, -y            do not ask for confirmation
USAGE
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

step() {
  printf '\n==> %s\n' "$*"
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$ANON_CONTAINER" ]]; then
    ssh "$LIVE_HOST" "sudo docker rm -f -v '$ANON_CONTAINER' >/dev/null 2>&1" || true
  fi
  if [[ -n "$STAGING_TMP" ]]; then
    if [[ "$SWAP_STARTED" -eq 0 ]]; then
      ssh "$STAGING_HOST" "sudo docker exec '$STAGING_PG_CONTAINER' dropdb -U postgres --if-exists '$NEW_DB' >/dev/null 2>&1" || true
    fi
    ssh "$STAGING_HOST" "sudo docker exec '$STAGING_PG_CONTAINER' rm -f /tmp/rateukma-superusers.csv /tmp/rateukma-socialaccounts.csv /tmp/rateukma-emailaddresses.csv >/dev/null 2>&1" || true
    ssh "$STAGING_HOST" "sudo rm -rf '$STAGING_TMP'" || true
  fi
  exit "$status"
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live-host)
      [[ $# -ge 2 ]] || die "--live-host needs a value"
      LIVE_HOST="$2"
      shift 2
      ;;
    --staging-host)
      [[ $# -ge 2 ]] || die "--staging-host needs a value"
      STAGING_HOST="$2"
      shift 2
      ;;
    --yes | -y)
      ASSUME_YES=1
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1 (see --help)"
      ;;
  esac
done

[[ -n "$LIVE_HOST" ]] || die "--live-host is required (see --help)"
[[ -n "$STAGING_HOST" ]] || die "--staging-host is required (see --help)"
[[ -f "$ANON_SQL" ]] || die "missing $ANON_SQL"
[[ "$LIVE_HOST" != "$STAGING_HOST" ]] || die "--live-host and --staging-host must differ"

# The swap renames the target's database, so prove each host is what it claims
# to be from its own rendered .env before anything else runs.
host_environment() {
  ssh "$1" "sudo grep -m1 '^VITE_ENVIRONMENT=' '$PROJECT_DIR/.env'" | cut -d= -f2
}
[[ "$(host_environment "$STAGING_HOST")" == "staging" ]] \
  || die "$STAGING_HOST is not staging (VITE_ENVIRONMENT in $PROJECT_DIR/.env); refusing to swap its database"
[[ "$(host_environment "$LIVE_HOST")" == "live" ]] \
  || die "$LIVE_HOST is not live (VITE_ENVIRONMENT in $PROJECT_DIR/.env)"

cat <<PLAN
This will:
  1. check free disk on $LIVE_HOST and start a throwaway postgres:15 container
     there (no host volume, --rm);
  2. stream a pg_dump of $LIVE_HOST's $LIVE_DB straight into that container as
     $ANON_DB, so no dump file is written to a host;
  3. run anonymise.sql there and print the live-side row counts;
  4. stream the anonymised dump to $STAGING_HOST and restore it into $NEW_DB;
  5. compare row counts, re-create $STAGING_HOST's own superusers in the copy;
  6. stop backend and scheduler, rename $LIVE_DB -> $PREV_DB and $NEW_DB ->
     $LIVE_DB, start them and health-check the backend;
  7. roll back the rename if the health check fails;
  8. clear staging's cache, keeping sessions.

$LIVE_HOST's database is never modified. Staging is down for a few minutes.
PLAN

if [[ "$ASSUME_YES" -ne 1 ]]; then
  printf "\nType 'yes' to continue: "
  read -r answer || die "aborted (no input)"
  [[ "$answer" == "yes" ]] || die "aborted"
fi

ANON_CONTAINER="rateukma-anon-$(date +%Y%m%d%H%M%S)-$$"

step "Checking free disk on $LIVE_HOST"
docker_root=$(ssh "$LIVE_HOST" "sudo docker info --format '{{.DockerRootDir}}'")
free_kb=$(ssh "$LIVE_HOST" "df -Pk '$docker_root' | awk 'NR==2 {print \$4}'")
[[ "$free_kb" =~ ^[0-9]+$ ]] || die "could not read free disk space on $LIVE_HOST"
if (( free_kb < MIN_FREE_KB )); then
  die "not enough free disk on $LIVE_HOST: ${free_kb} KB free, need ${MIN_FREE_KB} KB"
fi
printf '    %s KB free at %s\n' "$free_kb" "$docker_root"

step "Starting throwaway postgres on $LIVE_HOST ($ANON_CONTAINER)"
anon_password=$(openssl rand -hex 16)
ssh "$LIVE_HOST" "sudo docker run --rm -d --name '$ANON_CONTAINER' -e POSTGRES_PASSWORD='$anon_password' postgres:15 >/dev/null"

# The postgres image declares an anonymous volume for its data directory.
# Nothing else is allowed: no bind mount, no named volume.
host_binds=$(ssh "$LIVE_HOST" "sudo docker inspect -f '{{json .HostConfig.Binds}}' '$ANON_CONTAINER'")
case "$host_binds" in
  "null" | "[]") ;;
  *) die "throwaway container $ANON_CONTAINER has a host bind: $host_binds" ;;
esac

mounts=$(ssh "$LIVE_HOST" "sudo docker inspect -f '{{range .Mounts}}{{.Type}}:{{.Destination}} {{end}}' '$ANON_CONTAINER'")
case "$mounts" in
  "" | "volume:/var/lib/postgresql/data ") ;;
  *) die "throwaway container $ANON_CONTAINER has an unexpected mount: $mounts" ;;
esac

ready=0
for _ in $(seq 1 60); do
  if ssh "$LIVE_HOST" "sudo docker exec '$ANON_CONTAINER' pg_isready -U postgres -d postgres" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
(( ready == 1 )) || die "throwaway postgres did not become ready"

ssh "$LIVE_HOST" "sudo docker exec '$ANON_CONTAINER' createdb -U postgres '$ANON_DB'"

step "Copying $LIVE_DB into $ANON_DB on the live host (nothing leaves it)"
ssh "$LIVE_HOST" bash -s -- "$LIVE_PG_CONTAINER" "$ANON_CONTAINER" "$LIVE_DB" "$ANON_DB" <<'REMOTE'
set -euo pipefail
live_pg=$1
anon=$2
source_db=$3
target_db=$4
sudo docker exec "$live_pg" pg_dump -U postgres -d "$source_db" -Fc \
  | sudo docker exec -i "$anon" pg_restore -U postgres -d "$target_db" --no-owner --no-privileges
REMOTE

step "Anonymising the throwaway copy"
ssh "$LIVE_HOST" \
  "sudo docker exec -i '$ANON_CONTAINER' psql -U postgres -d '$ANON_DB' -v ON_ERROR_STOP=1" \
  <"$ANON_SQL"

step "Reading row counts from the anonymised live copy"
live_counts=$(ssh "$LIVE_HOST" bash -s -- "$ANON_CONTAINER" "$ANON_DB" <<'REMOTE'
set -euo pipefail
sudo docker exec "$1" psql -U postgres -d "$2" -tAc "
SELECT 'users=' || (SELECT count(*) FROM auth_user)
    || ',students=' || (SELECT count(*) FROM rating_app_student)
    || ',instructors=' || (SELECT count(*) FROM rating_app_instructor)
    || ',courses=' || (SELECT count(*) FROM rating_app_course)
    || ',offerings=' || (SELECT count(*) FROM rating_app_courseoffering)
    || ',ratings=' || (SELECT count(*) FROM rating_app_rating)
    || ',comments=' || (SELECT count(*) FROM rating_app_comment)"
REMOTE
)
printf '    %s\n' "$live_counts"

STAGING_TMP="/tmp/rateukma-staging-copy-$(date +%Y%m%d%H%M%S)-$$"

step "Exporting $STAGING_HOST's own superusers and creating $NEW_DB"
ssh "$STAGING_HOST" bash -s -- "$STAGING_PG_CONTAINER" "$STAGING_TMP" "$LIVE_DB" "$NEW_DB" <<'REMOTE'
set -euo pipefail
umask 077
pg=$1
tmp=$2
db=$3
new_db=$4

install -d -m 700 "$tmp"

copy_out() {
  local file=$1 query=$2
  sudo docker exec "$pg" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 \
    -c "COPY ($query) TO STDOUT WITH (FORMAT csv)" >"$file"
}

copy_out "$tmp/superusers.csv" \
  "SELECT id, password, last_login, is_superuser, is_staff, is_active, username, first_name, last_name, email, date_joined FROM auth_user WHERE is_superuser ORDER BY id"
copy_out "$tmp/socialaccounts.csv" \
  "SELECT id, provider, uid, last_login, date_joined, extra_data, user_id FROM socialaccount_socialaccount WHERE user_id IN (SELECT id FROM auth_user WHERE is_superuser) ORDER BY id"
copy_out "$tmp/emailaddresses.csv" \
  "SELECT id, email, verified, \"primary\", user_id FROM account_emailaddress WHERE user_id IN (SELECT id FROM auth_user WHERE is_superuser) ORDER BY id"

# docker cp lands the files as root; postgres must be able to read them.
chmod 644 "$tmp"/superusers.csv "$tmp"/socialaccounts.csv "$tmp"/emailaddresses.csv

sudo docker exec "$pg" dropdb -U postgres --if-exists "$new_db"
sudo docker exec "$pg" createdb -U postgres "$new_db"
REMOTE
printf '    exported to %s on %s\n' "$STAGING_TMP" "$STAGING_HOST"

step "Streaming the anonymised dump to $STAGING_HOST and restoring into $NEW_DB"
ssh "$LIVE_HOST" "sudo docker exec '$ANON_CONTAINER' pg_dump -U postgres -d '$ANON_DB' -Fc" \
  | ssh "$STAGING_HOST" "sudo docker exec -i '$STAGING_PG_CONTAINER' pg_restore -U postgres -d '$NEW_DB' --no-owner --no-privileges --exit-on-error"

step "Comparing row counts on $STAGING_HOST"
staging_counts=$(ssh "$STAGING_HOST" bash -s -- "$STAGING_PG_CONTAINER" "$NEW_DB" <<'REMOTE'
set -euo pipefail
sudo docker exec "$1" psql -U postgres -d "$2" -tAc "
SELECT 'users=' || (SELECT count(*) FROM auth_user)
    || ',students=' || (SELECT count(*) FROM rating_app_student)
    || ',instructors=' || (SELECT count(*) FROM rating_app_instructor)
    || ',courses=' || (SELECT count(*) FROM rating_app_course)
    || ',offerings=' || (SELECT count(*) FROM rating_app_courseoffering)
    || ',ratings=' || (SELECT count(*) FROM rating_app_rating)
    || ',comments=' || (SELECT count(*) FROM rating_app_comment)"
REMOTE
)
printf '    staging: %s\n' "$staging_counts"
[[ "$staging_counts" == "$live_counts" ]] \
  || die "row counts differ between the live copy and $NEW_DB; staging was not touched"

step "Re-creating $STAGING_HOST's superusers with new ids"
ssh "$STAGING_HOST" "sudo docker cp '$STAGING_TMP/superusers.csv' '$STAGING_PG_CONTAINER:/tmp/rateukma-superusers.csv' \
  && sudo docker cp '$STAGING_TMP/socialaccounts.csv' '$STAGING_PG_CONTAINER:/tmp/rateukma-socialaccounts.csv' \
  && sudo docker cp '$STAGING_TMP/emailaddresses.csv' '$STAGING_PG_CONTAINER:/tmp/rateukma-emailaddresses.csv'"

ssh "$STAGING_HOST" \
  "sudo docker exec -i '$STAGING_PG_CONTAINER' psql -U postgres -d '$NEW_DB' -v ON_ERROR_STOP=1" <<'SQL'
BEGIN;

CREATE TEMP TABLE exported_user (
    old_id integer PRIMARY KEY,
    password text NOT NULL,
    last_login timestamptz,
    is_superuser boolean NOT NULL,
    is_staff boolean NOT NULL,
    is_active boolean NOT NULL,
    username text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    date_joined timestamptz NOT NULL
);
COPY exported_user FROM '/tmp/rateukma-superusers.csv' WITH (FORMAT csv);

CREATE TEMP TABLE exported_social (
    old_id integer PRIMARY KEY,
    provider text NOT NULL,
    uid text NOT NULL,
    last_login timestamptz NOT NULL,
    date_joined timestamptz NOT NULL,
    extra_data jsonb NOT NULL,
    old_user_id integer NOT NULL
);
COPY exported_social FROM '/tmp/rateukma-socialaccounts.csv' WITH (FORMAT csv);

CREATE TEMP TABLE exported_email (
    old_id integer PRIMARY KEY,
    email text NOT NULL,
    verified boolean NOT NULL,
    "primary" boolean NOT NULL,
    old_user_id integer NOT NULL
);
COPY exported_email FROM '/tmp/rateukma-emailaddresses.csv' WITH (FORMAT csv);

CREATE TEMP TABLE user_map (old_id integer PRIMARY KEY, new_id integer NOT NULL);

WITH inserted AS (
    INSERT INTO auth_user (
        password, last_login, is_superuser, is_staff, is_active,
        username, first_name, last_name, email, date_joined
    )
    SELECT password, last_login, is_superuser, is_staff, is_active,
           username, first_name, last_name, email, date_joined
    FROM exported_user e
    WHERE NOT EXISTS (
        SELECT 1 FROM auth_user u
        WHERE u.username = e.username OR u.email = e.email
    )
    ORDER BY old_id
    RETURNING id, username, email
)
INSERT INTO user_map (old_id, new_id)
SELECT e.old_id, i.id
FROM inserted i
JOIN exported_user e ON e.username = i.username AND e.email = i.email;

INSERT INTO socialaccount_socialaccount
    (provider, uid, last_login, date_joined, extra_data, user_id)
SELECT s.provider, s.uid, s.last_login, s.date_joined, s.extra_data, m.new_id
FROM exported_social s
JOIN user_map m ON m.old_id = s.old_user_id
ON CONFLICT (provider, uid) DO NOTHING;

INSERT INTO account_emailaddress (email, verified, "primary", user_id)
SELECT e.email, e.verified, e."primary", m.new_id
FROM exported_email e
JOIN user_map m ON m.old_id = e.old_user_id
ON CONFLICT DO NOTHING;

SELECT count(*) AS exported_superusers FROM exported_user;
SELECT count(*) AS recreated_superusers FROM user_map;

COMMIT;
SQL

step "Stopping backend and scheduler, swapping the databases, starting them"
SWAP_STARTED=1
ssh "$STAGING_HOST" bash -s -- \
  "$STAGING_PG_CONTAINER" "$LIVE_DB" "$NEW_DB" "$PREV_DB" \
  "$PROJECT_DIR" "$STATIC_ROOT" "$MAX_ATTEMPTS" "$HEALTHCHECK_TIMEOUT" <<'REMOTE'
set -euo pipefail
pg=$1
db=$2
new_db=$3
prev_db=$4
project=$5
static_root=$6
max_attempts=$7
healthcheck_timeout=$8

compose() {
  (
    cd "$project"
    sudo docker compose --profile prod "$@"
  )
}

step() {
  printf '\n==> %s\n' "$*"
}

services_stopped=0
swapped=0
cleanup() {
  local status=$?
  if (( status != 0 && swapped == 0 && services_stopped == 1 )); then
    compose start backend scheduler || true
  fi
  return "$status"
}
trap cleanup EXIT

step "Stopping backend and scheduler"
services_stopped=1
compose stop backend scheduler

step "Swapping $db -> $prev_db and $new_db -> $db"
sudo docker exec -i "$pg" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('$db', '$new_db', '$prev_db')
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$prev_db";
BEGIN;
ALTER DATABASE "$db" RENAME TO "$prev_db";
ALTER DATABASE "$new_db" RENAME TO "$db";
COMMIT;
SQL
swapped=1

step "Starting backend and scheduler"
compose start backend scheduler

health_check() {
  local attempt=1 state
  while (( attempt <= max_attempts )); do
    state=$(compose ps -a --format json \
      | jq -rs 'map(select(.Service == "backend")) | first | .State // "missing"')
    if [[ "$state" == "running" ]] && [[ -f "$static_root/index.html" ]]; then
      return 0
    fi
    echo "    health check $attempt/$max_attempts: backend is $state"
    sleep "$healthcheck_timeout"
    attempt=$((attempt + 1))
  done
  return 1
}

if health_check; then
  step "Services are healthy"
  exit 0
fi

step "Health check failed; renaming $prev_db back to $db"
compose stop backend scheduler
sudo docker exec -i "$pg" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('$db', '$prev_db')
  AND pid <> pg_backend_pid();
BEGIN;
ALTER DATABASE "$db" RENAME TO "$new_db";
ALTER DATABASE "$prev_db" RENAME TO "$db";
COMMIT;
SQL
compose start backend scheduler
exit 1
REMOTE

step "Clearing staging's cache, keeping sessions"
ssh "$STAGING_HOST" bash -s -- "$PROJECT_DIR" <<'REMOTE'
set -euo pipefail
project=$1
cd "$project"
container=$(sudo docker compose --profile prod ps -q backend)
if [[ -z "$container" ]]; then
  echo "warning: backend container not found; skipping cache clear" >&2
  exit 0
fi
sudo docker exec "$container" uv run python manage.py manage_cache --clear
REMOTE

step "Done: $STAGING_HOST now runs the anonymised live copy; the previous database is $PREV_DB"
