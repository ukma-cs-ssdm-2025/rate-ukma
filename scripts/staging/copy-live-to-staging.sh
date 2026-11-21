#!/usr/bin/env bash
# shellcheck disable=SC2029
#
# Copy live's database to staging without any personal data.
#
# Runs on your machine and reaches both hosts over ssh:
#   live:    pg_dump -> throwaway postgres container (no volume) -> anonymise.sql
#   staging: restore into rateukma_new, compare counts, keep staging's superusers,
#            the E2E test account (--keep-email) and staging's feature flags,
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
KEEP_EMAILS=()
NO_KEEP_EMAIL=0

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ANON_SQL="$SCRIPT_DIR/anonymise.sql"

usage() {
  cat <<'USAGE'
Usage: copy-live-to-staging.sh --live-host HOST --staging-host HOST
                               (--keep-email ADDRESS ... | --no-keep-email) [--yes]

Copies live's catalog and ratings to staging, anonymising every person and the
text they wrote. The live database is never modified.

  --live-host HOST     ssh alias of the live host (rate-ukma-live)
  --staging-host HOST  ssh alias of the staging host (rate-ukma-staging)
  --keep-email ADDRESS keep this staging account as it is: its user, logins,
                       student record, enrolments and plans (repeatable; pass
                       the E2E account, CORPORATE_EMAIL, so staging E2E stays green)
  --no-keep-email      copy without keeping any account but staging's superusers
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
    ssh "$STAGING_HOST" "sudo docker exec '$STAGING_PG_CONTAINER' sh -c 'rm -f /tmp/rateukma-*.csv' >/dev/null 2>&1" || true
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
    --keep-email)
      [[ $# -ge 2 && -n "$2" ]] || die "--keep-email needs an address"
      KEEP_EMAILS+=("$(printf '%s' "$2" | tr '[:upper:]' '[:lower:]')")
      shift 2
      ;;
    --no-keep-email)
      NO_KEEP_EMAIL=1
      shift
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
if (( ${#KEEP_EMAILS[@]} == 0 && NO_KEEP_EMAIL == 0 )); then
  die "pass --keep-email with the E2E account's address (CORPORATE_EMAIL), or --no-keep-email"
fi

# Addresses are never printed whole.
mask_email() {
  local local_part=${1%%@*}
  printf '%s***@%s' "${local_part:0:1}" "${1#*@}"
}

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
  5. compare row counts, re-create $STAGING_HOST's own superusers and kept
     accounts (${#KEEP_EMAILS[@]}) in the copy, with their student records, enrolments
     and plans, and replace the copy's feature flags with $STAGING_HOST's;
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
# timeout ends postgres after 3 hours even if this script dies without running
# its trap (kill -9, a dropped ssh session); --rm then removes the container
# and its anonymous volume, so raw live data cannot outlive a lost run.
ssh "$LIVE_HOST" "sudo docker run --rm -d --name '$ANON_CONTAINER' -e POSTGRES_PASSWORD='$anon_password' --entrypoint timeout postgres:15 -s INT 3h docker-entrypoint.sh postgres >/dev/null"

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

# TCP, not the socket: during first-start init the image runs a temporary
# server on the socket only, then restarts it.
ready=0
for _ in $(seq 1 60); do
  if ssh "$LIVE_HOST" "sudo docker exec '$ANON_CONTAINER' pg_isready -h 127.0.0.1 -U postgres -d postgres" >/dev/null 2>&1; then
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

step "Exporting $STAGING_HOST's superusers, kept accounts and feature flags; creating $NEW_DB"
# The kept addresses travel over ssh stdin into a 600 file, never as arguments.
printf '%s\n' ${KEEP_EMAILS[@]+"${KEEP_EMAILS[@]}"} \
  | ssh "$STAGING_HOST" "umask 077 && install -d -m 700 '$STAGING_TMP' && cat >'$STAGING_TMP/keep-emails.csv'"
ssh "$STAGING_HOST" bash -s -- "$STAGING_PG_CONTAINER" "$STAGING_TMP" "$LIVE_DB" "$NEW_DB" <<'REMOTE'
main() {
set -euo pipefail
umask 077
pg=$1
tmp=$2
db=$3
new_db=$4

chmod 644 "$tmp/keep-emails.csv"
sudo docker cp "$tmp/keep-emails.csv" "$pg:/tmp/rateukma-keep-emails.csv"

# A user is kept when it is a superuser or one of its addresses was passed
# with --keep-email. by_email marks the second kind: they must keep a rateable
# enrolment for the E2E suite.
kept_users="SELECT u.id, (lower(u.email) IN (SELECT e FROM keep) OR EXISTS (SELECT 1 FROM account_emailaddress a WHERE a.user_id = u.id AND lower(a.email) IN (SELECT e FROM keep))) AS by_email FROM auth_user u"
kept_ids="SELECT id FROM ($kept_users) k WHERE by_email OR id IN (SELECT id FROM auth_user WHERE is_superuser)"

copy_out() {
  local file=$1 query=$2
  sudo docker exec "$pg" psql -q -U postgres -d "$db" -v ON_ERROR_STOP=1 \
    -c "CREATE TEMP TABLE keep (e text)" \
    -c "COPY keep FROM '/tmp/rateukma-keep-emails.csv'" \
    -c "COPY ($query) TO STDOUT WITH (FORMAT csv)" </dev/null >"$file"
}

copy_out "$tmp/users.csv" \
  "SELECT u.id, password, last_login, is_superuser, is_staff, is_active, username, first_name, last_name, email, date_joined, k.by_email FROM auth_user u JOIN ($kept_users) k ON k.id = u.id WHERE u.id IN ($kept_ids) ORDER BY u.id"
copy_out "$tmp/socialaccounts.csv" \
  "SELECT id, provider, uid, last_login, date_joined, extra_data, user_id FROM socialaccount_socialaccount WHERE user_id IN ($kept_ids) ORDER BY id"
copy_out "$tmp/emailaddresses.csv" \
  "SELECT id, email, verified, \"primary\", user_id FROM account_emailaddress WHERE user_id IN ($kept_ids) ORDER BY id"
copy_out "$tmp/students.csv" \
  "SELECT s.id, s.first_name, s.patronymic, s.last_name, s.education_level, s.email, s.user_id, sp.name, s.program_start_academic_year_start FROM rating_app_student s JOIN rating_app_speciality sp ON sp.id = s.speciality_id WHERE s.user_id IN ($kept_ids) ORDER BY s.user_id"
copy_out "$tmp/enrollments.csv" \
  "SELECT e.student_id, o.code, e.status, e.enrolled_at FROM rating_app_enrollment e JOIN rating_app_courseoffering o ON o.id = e.offering_id WHERE e.student_id IN (SELECT id FROM rating_app_student WHERE user_id IN ($kept_ids)) ORDER BY 1, 2"
copy_out "$tmp/plans.csv" \
  "SELECT p.student_id, o.code, p.academic_year_start, p.term, p.slot, p.updated_at FROM rating_app_plannedcourse p JOIN rating_app_courseoffering o ON o.id = p.offering_id WHERE p.student_id IN (SELECT id FROM rating_app_student WHERE user_id IN ($kept_ids)) ORDER BY 1, 2"
copy_out "$tmp/flags.csv" \
  "SELECT name, everyone, percent, testing, superusers, staff, authenticated, languages, rollout, note, created, modified FROM waffle_flag ORDER BY name"
copy_out "$tmp/flag-groups.csv" \
  "SELECT f.name, g.name FROM waffle_flag_groups fg JOIN waffle_flag f ON f.id = fg.flag_id JOIN auth_group g ON g.id = fg.group_id ORDER BY 1, 2"
copy_out "$tmp/flag-users.csv" \
  "SELECT f.name, fu.user_id FROM waffle_flag_users fu JOIN waffle_flag f ON f.id = fu.flag_id WHERE fu.user_id IN ($kept_ids) ORDER BY 1, 2"
copy_out "$tmp/switches.csv" \
  "SELECT name, active, note, created, modified FROM waffle_switch ORDER BY name"
copy_out "$tmp/samples.csv" \
  "SELECT name, percent, note, created, modified FROM waffle_sample ORDER BY name"

# docker cp lands the files as root; postgres must be able to read them.
chmod 644 "$tmp"/*.csv

sudo docker exec "$pg" dropdb -U postgres --if-exists "$new_db"
sudo docker exec "$pg" createdb -U postgres "$new_db"
}
main "$@"
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

step "Re-creating $STAGING_HOST's superusers and kept accounts, keeping its feature flags"
ssh "$STAGING_HOST" "for f in '$STAGING_TMP'/*.csv; do sudo docker cp \"\$f\" '$STAGING_PG_CONTAINER:/tmp/rateukma-'\"\$(basename \"\$f\")\" || exit 1; done"

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
    date_joined timestamptz NOT NULL,
    by_email boolean NOT NULL
);
COPY exported_user FROM '/tmp/rateukma-users.csv' WITH (FORMAT csv);

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

CREATE TEMP TABLE exported_student (
    old_id uuid PRIMARY KEY,
    first_name text NOT NULL,
    patronymic text NOT NULL,
    last_name text NOT NULL,
    education_level text NOT NULL,
    email text NOT NULL,
    old_user_id integer NOT NULL,
    speciality_name text NOT NULL,
    program_start_academic_year_start integer
);
COPY exported_student FROM '/tmp/rateukma-students.csv' WITH (FORMAT csv);

CREATE TEMP TABLE exported_enrollment (
    old_student_id uuid NOT NULL,
    code text NOT NULL,
    status text NOT NULL,
    enrolled_at timestamptz NOT NULL
);
COPY exported_enrollment FROM '/tmp/rateukma-enrollments.csv' WITH (FORMAT csv);

CREATE TEMP TABLE exported_plan (
    old_student_id uuid NOT NULL,
    code text NOT NULL,
    academic_year_start smallint NOT NULL,
    term text NOT NULL,
    slot text NOT NULL,
    updated_at timestamptz NOT NULL
);
COPY exported_plan FROM '/tmp/rateukma-plans.csv' WITH (FORMAT csv);

CREATE TEMP TABLE exported_flag (
    name text PRIMARY KEY,
    everyone boolean,
    percent numeric,
    testing boolean NOT NULL,
    superusers boolean NOT NULL,
    staff boolean NOT NULL,
    authenticated boolean NOT NULL,
    languages text NOT NULL,
    rollout boolean NOT NULL,
    note text NOT NULL,
    created timestamptz NOT NULL,
    modified timestamptz NOT NULL
);
COPY exported_flag FROM '/tmp/rateukma-flags.csv' WITH (FORMAT csv);
CREATE TEMP TABLE exported_flag_group (flag_name text NOT NULL, group_name text NOT NULL);
COPY exported_flag_group FROM '/tmp/rateukma-flag-groups.csv' WITH (FORMAT csv);
CREATE TEMP TABLE exported_flag_user (flag_name text NOT NULL, old_user_id integer NOT NULL);
COPY exported_flag_user FROM '/tmp/rateukma-flag-users.csv' WITH (FORMAT csv);
CREATE TEMP TABLE exported_switch (
    name text PRIMARY KEY, active boolean NOT NULL, note text NOT NULL,
    created timestamptz NOT NULL, modified timestamptz NOT NULL
);
COPY exported_switch FROM '/tmp/rateukma-switches.csv' WITH (FORMAT csv);
CREATE TEMP TABLE exported_sample (
    name text PRIMARY KEY, percent numeric NOT NULL, note text NOT NULL,
    created timestamptz NOT NULL, modified timestamptz NOT NULL
);
COPY exported_sample FROM '/tmp/rateukma-samples.csv' WITH (FORMAT csv);

-- Users: new ids, so they cannot collide with live's anonymised users.
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

-- Student records, with new ids, their speciality matched by name.
CREATE TEMP TABLE student_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL);
INSERT INTO student_map SELECT old_id, gen_random_uuid() FROM exported_student;

DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(DISTINCT s.speciality_name, ', ') INTO missing
    FROM exported_student s
    WHERE NOT EXISTS (SELECT 1 FROM rating_app_speciality sp WHERE sp.name = s.speciality_name);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'kept students have specialities the copy lacks: %', missing;
    END IF;
END
$$;

INSERT INTO rating_app_student (
    id, first_name, patronymic, last_name, education_level, email, avatar,
    user_id, speciality_id, program_start_academic_year_start
)
SELECT sm.new_id, s.first_name, s.patronymic, s.last_name, s.education_level, s.email, NULL,
       um.new_id, (SELECT sp.id FROM rating_app_speciality sp WHERE sp.name = s.speciality_name LIMIT 1),
       s.program_start_academic_year_start
FROM exported_student s
JOIN student_map sm ON sm.old_id = s.old_id
JOIN user_map um ON um.old_id = s.old_user_id;

-- Enrolments and plans, on the copy's offering with the same САЗ code.
INSERT INTO rating_app_enrollment (id, student_id, offering_id, status, enrolled_at)
SELECT gen_random_uuid(), sm.new_id, o.id, e.status, e.enrolled_at
FROM exported_enrollment e
JOIN student_map sm ON sm.old_id = e.old_student_id
JOIN rating_app_courseoffering o ON o.code = e.code
ON CONFLICT DO NOTHING;

INSERT INTO rating_app_plannedcourse (id, student_id, offering_id, academic_year_start, term, slot, updated_at)
SELECT gen_random_uuid(), sm.new_id, o.id, p.academic_year_start, p.term, p.slot, p.updated_at
FROM exported_plan p
JOIN student_map sm ON sm.old_id = p.old_student_id
JOIN rating_app_courseoffering o ON o.code = p.code
ON CONFLICT DO NOTHING;

-- Feature flags: staging's own, never live's.
DELETE FROM waffle_flag_groups;
DELETE FROM waffle_flag_users;
DELETE FROM waffle_flag;
DELETE FROM waffle_switch;
DELETE FROM waffle_sample;
INSERT INTO waffle_flag (name, everyone, percent, testing, superusers, staff, authenticated,
                         languages, rollout, note, created, modified)
SELECT name, everyone, percent, testing, superusers, staff, authenticated,
       languages, rollout, note, created, modified
FROM exported_flag;
INSERT INTO waffle_flag_groups (flag_id, group_id)
SELECT f.id, g.id
FROM exported_flag_group x
JOIN waffle_flag f ON f.name = x.flag_name
JOIN auth_group g ON g.name = x.group_name;
INSERT INTO waffle_flag_users (flag_id, user_id)
SELECT f.id, m.new_id
FROM exported_flag_user x
JOIN waffle_flag f ON f.name = x.flag_name
JOIN user_map m ON m.old_id = x.old_user_id;
INSERT INTO waffle_switch (name, active, note, created, modified)
SELECT name, active, note, created, modified FROM exported_switch;
INSERT INTO waffle_sample (name, percent, note, created, modified)
SELECT name, percent, note, created, modified FROM exported_sample;

-- The E2E suite rates courses from «Мої оцінки»: openFirstCourseToRate(n)
-- picks the n-th card with «Оцінити», and the comments spec passes its worker
-- index (up to 2 with CI's retries). A card needs an attended enrolment
-- (ENROLLED or FORCED) in a semester open for rating; an earlier calendar year
-- is always open. Every account kept by address needs three.
DO $$
DECLARE short integer;
BEGIN
    SELECT count(*) INTO short
    FROM exported_user u
    WHERE u.by_email
      AND (
        SELECT count(DISTINCT e.offering_id)
        FROM user_map um
        JOIN rating_app_student st ON st.user_id = um.new_id
        JOIN rating_app_enrollment e ON e.student_id = st.id
        JOIN rating_app_courseoffering o ON o.id = e.offering_id
        JOIN rating_app_semester sem ON sem.id = o.semester_id
        WHERE um.old_id = u.old_id
          AND e.status IN ('ENROLLED', 'FORCED')
          AND sem.year < extract(year FROM now())
      ) < 3;
    IF short > 0 THEN
        RAISE EXCEPTION '% kept account(s) would have fewer than 3 rateable enrolments; staging was not touched', short;
    END IF;
END
$$;

SELECT (SELECT count(*) FROM exported_user) AS exported_users,
       (SELECT count(*) FROM user_map) AS recreated_users,
       (SELECT count(*) FROM exported_student) AS students,
       (SELECT count(*) FROM exported_enrollment) AS exported_enrolments,
       (SELECT count(*) FROM rating_app_enrollment WHERE student_id IN (SELECT new_id FROM student_map)) AS recreated_enrolments,
       (SELECT count(*) FROM exported_plan) AS exported_plans,
       (SELECT count(*) FROM rating_app_plannedcourse WHERE student_id IN (SELECT new_id FROM student_map)) AS recreated_plans,
       (SELECT count(*) FROM waffle_flag) AS flags,
       (SELECT count(*) FROM waffle_switch) AS switches;

-- What the E2E specs need from the catalog (plan: E4-E8).
SELECT (SELECT count(*) FROM rating_app_instructor) AS instructors,
       (SELECT count(DISTINCT o.course_id) FROM rating_app_rating r
          JOIN rating_app_courseoffering o ON o.id = r.course_offering_id) AS rated_courses,
       (SELECT count(*) FROM rating_app_course WHERE title ILIKE '%програм%') AS q_program,
       (SELECT count(*) FROM rating_app_course WHERE title ILIKE '%математ%') AS q_math,
       (SELECT count(*) FROM rating_app_course WHERE title ILIKE '%об`єкт%') AS q_object,
       (SELECT count(*) FROM rating_app_faculty) AS faculties,
       (SELECT max(n) FROM (SELECT count(*) AS n FROM rating_app_department GROUP BY faculty_id) d) AS max_departments_per_faculty,
       (SELECT count(*) FROM rating_app_speciality) AS specialities;

COMMIT;
SQL

step "Stopping backend and scheduler, swapping the databases, starting them"
SWAP_STARTED=1
ssh "$STAGING_HOST" bash -s -- \
  "$STAGING_PG_CONTAINER" "$LIVE_DB" "$NEW_DB" "$PREV_DB" \
  "$PROJECT_DIR" "$STATIC_ROOT" "$MAX_ATTEMPTS" "$HEALTHCHECK_TIMEOUT" <<'REMOTE'
# Wrapped in main so bash reads the whole script before running it: a command
# that reads stdin cannot swallow the rest of it.
main() {
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
cleanup() {
  local status=$?
  # On any failure, leave staging serving whichever database it now has
  # rather than stopped.
  if (( status != 0 && services_stopped == 1 )); then
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

step "Starting backend and scheduler"
compose start backend scheduler

health_check() {
  local attempt=1 state
  while (( attempt <= max_attempts )); do
    state=$(compose ps -a --format json \
      | jq -rs 'flatten | map(select(.Service == "backend")) | first | .State // "missing"')
    # "running" alone proves nothing: the container reads running before its
    # entrypoint migrates. migrate --check passes only once the swapped
    # database is reachable and fully migrated.
    if [[ "$state" == "running" ]] && [[ -f "$static_root/index.html" ]] \
      && compose exec -T backend uv run python manage.py migrate --check </dev/null >/dev/null 2>&1; then
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
}
main "$@"
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
