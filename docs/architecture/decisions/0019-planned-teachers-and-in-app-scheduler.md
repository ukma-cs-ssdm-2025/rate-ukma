# ADR-0019: Planned Teachers Come from UKMA Data, Mirrored Daily by an In-App Scheduler

## Status

Proposed

## Date

2026-11-21

## Context

The course page and the rating form want to show who teaches a course before anyone has rated it. Rate UKMA itself only knows the teachers students named in ratings.

- **UKMA Data has the plan.** It crawls smart.ukma daily and links its teachers to САЗ offerings by a matching rule (`src/parser/src/smart/matching.ts`). `GET /v1/offerings/instructors` serves each offering's teachers (names, email, role); the route needs `instructors:read`.
- **`CourseInstructor` already models it.** It links an `Instructor` to a `CourseOffering` with a role, and is empty on live: the old scraper never filled it. Issue #687 proposed removing it.
- **Rate UKMA has no scheduler.** There is no Celery, cron or other periodic runner; one-off jobs run as `manage.py` commands through `docker exec` from CI (`warmup` in `deploy.yml`).
- **A job must not run twice at once.** Two scheduler containers during a deploy, or a manual run beside the scheduled one, must not interleave writes.
- **A broken job must not take the site down.** The web deploy health-checks every service and rolls back when one is unhealthy.

## Decision

We will treat UKMA Data as the source of planned teachers and keep `CourseInstructor` as Rate UKMA's copy of them. `manage.py sync_offering_instructors` pages UKMA Data's offerings, keeps the current and previous academic year, finds each `CourseOffering` by its САЗ code and each `Instructor` by email (creating a missing one), and makes the offering's `CourseInstructor` rows exactly what UKMA Data lists. It is idempotent and writes one transaction per page. Without `instructors:read` it logs one event and exits 0.

We will run periodic jobs in the app, not outside it: a `scheduler` compose service runs the backend image with `manage.py run_scheduler`, a blocking stdlib loop over a registry of jobs (`rating_app/scheduler/jobs.py`, one line per job, each a management command at a Kyiv wall-clock time). The sync runs daily at 04:30 Europe/Kyiv. Each job takes a Postgres session advisory lock with its own fixed key on a connection of its own (`pg_try_advisory_lock`) and skips with one log line while another process holds it, so scheduled and manual runs never overlap. The loop stops cleanly on SIGTERM. Jobs never run inside gunicorn workers.

`deploy.sh` pulls and starts the scheduler with the rest of the stack but treats it as non-blocking: its state is reported after a deploy, and a failing scheduler cannot fail or roll back the web deploy.

This supersedes the removal proposed in #687.

## Consequences

- ✅ Teachers can show on a course before its first rating, behind `fe_course_instructors`.
- ✅ The data is read from one place and stays current within a day of UKMA Data.
- ✅ A new periodic job is one line in the registry plus a management command; no new infrastructure.
- ✅ The advisory lock makes scheduled, manual and duplicate runs safe without a lock table.
- ⚠️ One more long-running container on the live host, and its health is not gated by the deploy: someone must read its logs (`scheduler_job_failed`, `offering_instructors_synced`).
- ⚠️ A job missed while the scheduler is down runs at its next time, not on start.
- ⚠️ Teachers whose smart.ukma record has no email are skipped; matching ties UKMA Data cannot settle stay unlinked until its review cases exist.

## Considered Alternatives

1. **Drop `CourseInstructor` (#687) and call UKMA Data on each page view.**
    * Rejection Reason: puts UKMA Data on the request path and ties the course page's latency and uptime to it; the teachers also need joining with Rate UKMA's own `Instructor` rows for the rating form.
2. **A scheduled GitHub Actions workflow running the command over ssh, like `warmup`.**
    * Rejection Reason: keeps a production job in CI with deploy-level ssh access, depends on GitHub's best-effort cron timing, and needs a separate lock story for manual runs.
3. **A host crontab.**
    * Rejection Reason: lives outside the repository and the deploy, so nobody reviews or rolls it back.
4. **Celery beat, or APScheduler.**
    * Rejection Reason: neither is a dependency; one daily job does not justify a broker or a new library, and the stdlib loop plus advisory locks covers it.
