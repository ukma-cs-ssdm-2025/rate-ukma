# Staging Copy of Live Without Personal Data

Runbook for replacing staging's database with an anonymised copy of live (`scripts/staging/copy-live-to-staging.sh`). It exists so catalog approvals, mapping answers and the review page can be rehearsed on staging against live-sized data: the same faculties, courses, offerings, ratings, enrollments and plans, with every person and every word they wrote replaced.

Issue: [#768](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/768).

## When to Use

- Rehearsing a catalog change on staging and staging's own data no longer resembles live.
- Checking a rating-heavy change (a course merge, an offering move) against the real number of ratings.
- Not for backups: live stays the source of truth, and this never restores live from staging.

## Rules

- Run it only when the owner asks.
- Staging is the only possible target. The script has no live target and must not get one.
- Raw personal data must not leave the live host. The live dump goes straight into a throwaway container there; only the anonymised dump is streamed to staging.
- Do not merge to `main` while it runs: a deploy stops and starts the same services and can interrupt the swap.
- The copy replaces staging's data, sessions and non-superuser accounts. Staging's superusers keep working; everyone else signs in again.
- The previous staging database stays as `rateukma_prev` until you decide to drop it.

## Prerequisites

- SSH access to `rate-ukma-live` and `rate-ukma-staging`.
- Passwordless `sudo docker` on both hosts, and `jq` on the staging host (the health check uses it).
- At least 2 GB free where Docker stores data on the live host (`MIN_FREE_KB` overrides the check).
- A checkout of this repository with the script and `scripts/staging/anonymise.sql`.

## Command

```bash
scripts/staging/copy-live-to-staging.sh \
  --live-host rate-ukma-live \
  --staging-host rate-ukma-staging
```

The script prints the plan and asks for `yes`. `--yes` skips the question for a re-run you have already checked. Overridable variables and their defaults: `LIVE_PG_CONTAINER` and `STAGING_PG_CONTAINER` (`rate_ukma_postgres`), `LIVE_DB` (`rateukma`), `PROJECT_DIR` (`/opt/rateukma/src`), `STATIC_ROOT` (`/opt/rateukma/static`), `MAX_ATTEMPTS` (30), `HEALTHCHECK_TIMEOUT` (5).

## Steps

### 1. On the live host

1. Checks free disk where Docker stores its data.
2. Starts a throwaway `postgres:15` container named `rateukma-anon-<timestamp>-<pid>` with `--rm` and no host volume. The only mount is the image's anonymous data volume; the script stops if `docker inspect` shows a bind mount or anything else.
3. Streams `pg_dump -Fc` of live's `rateukma` straight into `pg_restore` in the throwaway container as `rateukma_anon`. No dump file is written to a host.
4. Runs `anonymise.sql` in `rateukma_anon`. It refuses to run unless the database is `rateukma_anon`.
5. Prints the row counts of the anonymised copy.

The container and its anonymous data volume are removed on any exit, success or failure (`docker rm -f -v`).

### 2. On the staging host

6. Exports staging's own superusers (`auth_user` rows with `is_superuser`, their `socialaccount_socialaccount` and `account_emailaddress` rows) to a mode-700 temporary directory.
7. Drops and re-creates `rateukma_new`, then restores the anonymised dump into it.
8. Compares `rateukma_new`'s counts with the live side's (`auth_user`, students, instructors, courses, offerings, ratings, comments). A mismatch stops the run before staging's own database is touched.
9. Re-creates the exported superusers in `rateukma_new` with new ids; their social accounts and email addresses point at the new ids. A superuser whose username or email already exists is skipped.
10. Stops `backend` and `scheduler` with `docker compose`.
11. In one psql session: terminates their connections, drops an older `rateukma_prev`, renames `rateukma` to `rateukma_prev` and `rateukma_new` to `rateukma`.
12. Starts `backend` and `scheduler` and health-checks the backend the way the deploy does: the `backend` container is running and the webapp's `index.html` exists, retried for `MAX_ATTEMPTS` × `HEALTHCHECK_TIMEOUT` seconds.
13. On a failed health check: stops the two services, renames `rateukma` back to `rateukma_new` and `rateukma_prev` back to `rateukma`, and starts them again.
14. After a successful swap, clears the Redis cache with `manage_cache --clear` (the command preserves session keys).

### 3. What is anonymised

- `auth_user`: username `user-<id>`, email `user-<id>@example.invalid`, empty names, unusable password (`!`); superuser, staff and active flags stay.
- Students and instructors: `Студент <n>` / `Викладач <n>` names and `student-<n>@example.invalid` / `teacher-<n>@example.invalid` emails. Student avatars are cleared.
- `rating_app_rating.comment`, `rating_app_comment.content`, `rating_app_feedpost.title` and `.body`: `Текст прихований на staging.` where the text was not empty; empty stays empty. The deprecated `rating_app_rating.instructor` text is cleared.
- Empty: `django_session`, `authtoken_token`, `socialaccount_socialtoken`, `socialaccount_socialaccount`, `account_emailaddress` (and its confirmations), `django_admin_log`, `reversion_version`, `reversion_revision`, `rating_app_signin`, `waffle_flag_users`.
- Notifications and feed events carry no name-bearing JSON; they keep their rows and point at the anonymised users.

Catalog tables, rating scores, votes, enrollments, planned courses and every count stay.

## Rollback

The script rolls back a failed health check itself. If staging looks wrong after a successful swap, restore the previous database by hand:

```bash
ssh rate-ukma-staging
cd /opt/rateukma/src
sudo docker compose --profile prod stop backend scheduler
sudo docker exec -i rate_ukma_postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('rateukma', 'rateukma_prev') AND pid <> pg_backend_pid();
ALTER DATABASE rateukma RENAME TO rateukma_new;
ALTER DATABASE rateukma_prev RENAME TO rateukma;
SQL
sudo docker compose --profile prod start backend scheduler
```

Then clear the cache, as the script does:

```bash
container=$(sudo docker compose --profile prod ps -q backend)
sudo docker exec "$container" uv run python manage.py manage_cache --clear
```

## After the Run

- Staging's superusers can sign in immediately; everyone else signs in again: old sessions stay in Redis but Django rejects them, because every copied password is unusable.
- The copy brings live's waffle flags and switches. Turn `catalog_sync_proposals` on after copying (`manage.py waffle_switch catalog_sync_proposals on --create`).
- Staging's nightly teacher sync re-creates real teachers from UKMA Data and links them to offerings; that is expected with staging's read-only key.
- `rateukma_prev` holds staging's old data. Drop it (`DROP DATABASE rateukma_prev`) once the copy is accepted; drop `rateukma_new` after a failed health check if you no longer need it.
- If a run was killed without its cleanup (`kill -9`, a dropped ssh session, a sleeping laptop), the throwaway container on the live host still holds raw live data until its 3-hour timeout. Remove it at once: `sudo docker ps -a --filter name=rateukma-anon-`, then `sudo docker rm -f -v <name>`.
- The temporary directory on staging (`/tmp/rateukma-staging-copy-*`) and the files copied into the postgres container are removed by the script; remove them by hand if a run was killed with `kill -9`.
- Check the row counts the script printed against live before the run if you expect a specific number of ratings or courses.
