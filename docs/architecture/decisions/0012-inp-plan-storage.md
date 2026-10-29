# ADR-0012: ІНП Plan Stored in the Backend as One Record per Planned Course

## Status

Proposed

## Date

2026-10-29

## Context

The first version of the personal plan (ІНП) planner (#807, behind a feature flag, [ADR-0009](./0009-feature-flags.md)) keeps each student's picks in the browser, together with a copy of each course's credits and hours. That is enough to try the UI, but not for the MVP stories.

**Forces:**

- **One plan on every device.** US-5.1, US-5.2, US-5.9 and US-5.10 describe a plan the student builds over weeks and checks before registration in САЗ. A plan kept in one browser is lost or missing elsewhere.
- **The system writes to the plan too.** The first time the plan opens, it must already hold the courses the student took and the mandatory courses of their programme (BR-04).
- **Rules that must never break.** The same course cannot appear twice (PR-02). A taken or mandatory course cannot be removed or marked as backup (PR-01). A multi-semester course is added and removed as a whole (BR-02, BR-08).
- **Course data changes.** Credits and hours come from САЗ through the daily sync ([ADR-0011](./0011-saz-data-service.md)), so any copy kept in the plan goes stale (TA-07).
- **Limits warn, never block.** Credit and hour limits (BR-09 to BR-12) only produce warnings (BR-14, PR-04).

## Decision

We will store the ІНП in the backend as one plan per student, made of one record per planned course that refers to the course in our catalog. Each record keeps only the student's choices: the year of study, main or backup, and whether the course was added by the student or by the system. Everything derived from course data, such as credits, hours, totals and limit warnings, is calculated by the backend when the plan is read and is never stored.

## Consequences

* ✅ The plan is the same on every device and survives a cleared browser.
* ✅ The no-duplicates and locked-course rules are enforced on the server, not trusted to the client.
* ✅ A change in САЗ data shows up in the plan on the next read, with nothing to update.
* ✅ Limit checks have one source of truth, in the backend.
* ⚠️ Pre-filling taken and mandatory courses is only as complete as the synced САЗ data.
* ❌ The ІНП track has to build the storage and API, and switch the frontend over to them.
* ❌ Picks already saved in browsers need a one-time upload, or they are dropped.

## Considered Alternatives

1. **Keep the plan in the browser.**
   - Pros: no backend work; works offline.
   - Cons: one device only; copied course data goes stale; rules are enforced only in the client; the backend cannot pre-fill the plan.
   - Rejection Reason: fails the "one plan on every device" and "the system writes to the plan" forces.

2. **Store the whole plan as one document per student.**
   - Pros: one read and one write per plan; close to the current frontend shape.
   - Cons: no link to catalog courses, so a course changed by the sync can silently break the plan; rules move into application code; two open tabs can overwrite each other.
   - Rejection Reason: moves the rules and data freshness into fragile application code.
