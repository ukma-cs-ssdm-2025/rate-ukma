# ADR-0023: Compute Product Metrics in Postgres Views in an `analytics` Schema

## Status

Proposed

## Date

2026-11-21

## Context

The product analytics spec ([docs/product/metrics.md](../../product/metrics.md)) defines the metrics
and says every analytics query reads anonymised views. No metric has to show an email, a
`student_id` or the text of a review.

The forces:

- **Analytics needs narrower access than the app.** The app connects to Postgres as the superuser.
  A dashboard, a script or an agent that reads the metrics should see only counts.
- **The right to rate is not stored.** Several metrics count only students who may rate a course.
  `RatingService.is_semester_open_for_rating` computes it from the semester and today's date. A
  query that derives it differently counts different people.
- **Backend tests run on SQLite with migrations off.** Views written in Postgres SQL and created by
  a migration never run there.

## Decision

We will compute the metrics in plain Postgres views in an `analytics` schema.

1. **Shape:** one view per metric, named after the spec. Views return only counts and shares. No
   column holds a user id, an email, a `student_id` or review text.
2. **Migrations:** migrations create the views, with the SQL written in the migration. A separate
   file edited later would change what old migrations run on a fresh database.
3. **The right to rate:** one SQL function returns the date a semester opens for rating, the first
   day of its midterm month as in `SemesterService.MIDTERM_MONTH`. This matches the backend's rule,
   because a past semester has always reached its midpoint.
4. **Time zone:** every date is a UTC date, as the backend decides the right to rate on the UTC
   date.
5. **Service accounts:** accounts that are not people are listed per environment in an
   `ExcludedAccount` table edited in the admin, and every view leaves them out. The end-to-end
   account's email is a secret, so it cannot be named in code.
6. **Tests:** the `test-backend` CI job gets a `postgres:15` service, the version on the server,
   and a pytest step that runs migrations and the view tests on it. Each view has a test. One test
   checks that the SQL function and `is_semester_open_for_rating` agree on boundary dates.

## Consequences

- ✅ A reader of the views sees no user id, email, `student_id` or review text.
- ✅ Every change to a definition is a migration and goes through a PR.
- ✅ Nothing to schedule or refresh. A view computes on every read.
- ⚠️ Postgres refuses to change the type of a column a view reads, even to raise a `CharField`'s
  `max_length`. Django drops columns and tables with `CASCADE`, so removing a field or a model
  silently drops the views that read it. In both cases the migration has to recreate the views.
  The Postgres CI step fails on either in the PR.
- ⚠️ The right-to-rate rule now lives in Python and in SQL. The agreement test catches drift only
  for the dates it covers.
- ⚠️ Days and months end at midnight UTC, two or three hours after midnight in Kyiv. A review
  written just after midnight on the 1st counts in the month before.
- ⚠️ Views see the data as it is now. A deleted review leaves nothing behind, so past figures can
  change.
- ⚠️ Retention by cohort counts only sign-ins recorded since the sign-in log
  ([ADR-0016](0016-sign-in-log.md)) was released, so it has little to show in the first months.
- ⚠️ Until a read-only role exists, the views are read with the app's superuser account, which
  can read the tables too. The role comes with the tool that reads the views.
- ❌ The local `pytest` run on SQLite skips the view tests. Running them needs a local Postgres.
- ❌ The backend CI run takes longer. It starts Postgres and applies every migration.

## Considered Alternatives

1. **Computing the metrics in Python with a management command that reuses the services.**
   - Rejection Reason: a dashboard or an agent would need the app's database access or its code
     to get a number, and the spec asks every analytics query to read anonymised views.
2. **Materialized views or snapshot tables.**
   - Rejection Reason: they need a refresh on a schedule and are stale between refreshes.
3. **A shared view for the current semester and the right to rate.**
   - Rejection Reason: the right to rate needs only the date a semester opens, which depends on
     the semester alone.
4. **Running every backend test on Postgres.**
   - Rejection Reason: slows every test to cover a few views.
