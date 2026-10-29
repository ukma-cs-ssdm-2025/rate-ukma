# ADR-0012: ІНП Plan Stored as `PlanItem` Rows in the Backend

## Status

Proposed

## Date

2026-10-29

## Context

The personal plan (ІНП) planner from #807 sits behind `fe_personal_plan` ([ADR-0009](./0009-feature-flags.md)) and keeps each student's picks in `localStorage`. Every pick carries a copy of the course title, credits and weekly hours, and picks are filed by semester (`planStore.ts`). That is enough for click-through testing, but not for the MVP stories.

**Forces:**

- **One plan on every device.** US-5.1, US-5.2, US-5.9 and US-5.10 describe a plan the student builds over weeks and checks before registration in САЗ. A browser-only plan is lost when storage is cleared and missing on a second device.
- **The system writes to the plan too.** The first time the plan opens, it must already hold the taken courses (from САЗ enrollments) and the mandatory courses of the student's programme for every year (BR-04).
- **Rules that must never break.** The same course cannot appear twice in one plan (PR-02). A taken or mandatory course cannot be removed or marked as backup (PR-01). A multi-semester course is added to, and removed from, all of its semesters together (BR-02, BR-08).
- **Credits and hours come from САЗ and change.** A plan course uses the credits and hours of the latest academic year in САЗ (TA-07). That data arrives through the daily sync ([ADR-0011](./0011-saz-data-service.md)), so any copy stored in the plan goes stale.
- **Limits warn, never block.** The 58–62 credits per year, 24 h per week, 54 profession-oriented, 25 free-choice and 240 total checks (BR-09 to BR-12) only produce warnings (BR-14, PR-04), so they are calculated, not stored.
- **Analytics need server events.** US-E.6 counts "add to ІНП" and "mark as backup" per day, which is reliable only if the backend sees each action.

## Decision

We will store the ІНП in the backend as one `IndividualPlan` per `Student` and one `PlanItem` row per course in the plan, linked to `Course` by foreign key.

1. **`IndividualPlan`**: `id`, `student_id` (unique), `created_at`, `updated_at`.
2. **`PlanItem`**: `id`, `plan_id`, `course_id`, `study_year`, `role` (`MAIN` / `BACKUP`), `origin` (`TAKEN` / `MANDATORY` / `ADDED`), with a unique constraint on (`plan_id`, `course_id`).
   - One row per course per year. The semesters it lands in come from its `CourseOffering` terms, so a multi-semester course cannot be split.
3. **Rules live in the service layer**, behind Pydantic input models at the API boundary ([ADR-0005](./0005-api-data-validation.md)). The service refuses to remove or back up an item whose `origin` is `TAKEN` or `MANDATORY`. Limit breaches never refuse a write.
4. **Nothing calculated is stored.** Credits and hours per semester and year, programme totals and warnings are worked out by one backend service each time the plan is read, from the latest offering terms. They are returned by the REST API ([ADR-0004](./0004-api-format.md)).
5. **Pre-filling**: the first read of a missing plan creates it, together with `taken` items from `Enrollment` and `mandatory` items from the student's programme.

## Consequences

* ✅ PR-02 is enforced by the database, not by client code.
* ✅ BR-02 and BR-08 hold by construction: a course is one row per year, whatever number of semesters it spans.
* ✅ When the sync changes a course's credits or marks it "gone from САЗ", the next plan read shows it. No stored copy needs updating.
* ✅ US-E.6 events are recorded in the same service call as the change.
* ⚠️ Pre-filling (BR-04) is only as complete as the synced `Enrollment` and programme data.
* ⚠️ Two new tables, migrations and a set of plan endpoints for the ІНП track to build and test.
* ❌ The frontend must switch `usePlannedCourses` from `localStorage` to the API. Picks already saved in browsers need a one-time upload, or they are dropped.
* ❌ Today's per-semester storage becomes per-year rows, so the UI builds its semester view from offering terms.
* ❌ `planRules.ts` must only show what the API returns. Keeping a second copy of the limit checks in the frontend would let the two drift apart.

## Considered Alternatives

1. **Keep the plan in `localStorage`.**
   - Pros: no backend tables or endpoints, works offline, no server load per click.
   - Cons: one device only; lost when the browser is cleared; stored credits and titles go stale after a sync; PR-01 and PR-02 enforced only in the client; no server-side events for US-E.6.
   - Rejection Reason: fails the "one plan on every device" force and TA-07, and the backend cannot pre-fill a plan it never sees.

2. **One `IndividualPlan` row with a JSON column holding the whole plan.**
   - Pros: one read and one write per plan; the shape maps directly onto the current `StoredPlan`.
   - Cons: no foreign key to `Course`, so a course renamed or removed by the sync silently breaks the plan; PR-02 needs application code instead of a unique key; every click rewrites the whole document, so two open tabs can overwrite each other.
   - Rejection Reason: saves a table but moves the rules and data freshness into fragile application code, which is the exact problem the rows solve.
