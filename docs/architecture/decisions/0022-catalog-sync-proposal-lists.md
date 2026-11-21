# ADR-0022: Rate UKMA Takes Its Catalog from UKMA Data Through Approved Nightly Proposal Lists

## Status

Proposed

## Date

2026-11-22

## Context

Rate UKMA's catalog (faculties, departments, courses, offerings, their terms and specialities) comes from `src/backend/scraper`, run by hand. [ADR-0011](0011-saz-data-service.md) moved САЗ crawling to UKMA Data and left Rate UKMA a sync importer to write. [ADR-0020](0020-planned-teachers-and-in-app-scheduler.md) added the in-app scheduler and the first sync, for teachers.

- **The catalogs agree almost everywhere.** On 2026-11-21, 24,290 of Rate UKMA's 24,345 offerings existed in UKMA Data by САЗ code, in the same year; 5,101 of 5,492 courses mapped one-to-one and held 1,888 of 1,929 ratings.
- **Course groups differ in one way.** UKMA Data merges a course across a department handoff; Rate UKMA keeps a course per department. 190 UKMA Data courses span 381 Rate UKMA courses; with 9 split courses, 11 rated courses (41 ratings) are involved. Some are real handoffs, some different courses with a generic title.
- **Ratings, enrollments and plans hang on offerings.** Moving an offering moves them to another course page.
- **The owner wants to see every change before it lands**, and later let the safe ones apply themselves.
- **UKMA Data may be down or serve partial data.** Rate UKMA must keep working and must not read a short answer as removals.

## Decision

We will sync the catalog through a nightly **proposal list** that a superuser applies group by group.

1. A scheduled job, `build_catalog_proposals` (02:30 UTC, behind the waffle switch `catalog_sync_proposals`), reads UKMA Data's whole catalog from change number 0, compares it with Rate UKMA's, and saves a list in five groups: link, new, change, mapping, removed. It writes only proposal tables. A failed or short read leaves the previous list in place.
2. Each night's list replaces the last. A superuser applies the groups in order on /data, each after a preview, each in one transaction under the builder's advisory lock, each with an approval row. An item whose row changed since the build is skipped as stale. A list older than 48 h cannot be applied.
3. Rate UKMA keeps its own rows and stores UKMA Data's ids on `CourseOffering`, `Course`, `Department` and `Faculty`. Several Rate UKMA courses may link to one UKMA Data course when staff keep them apart. Only a staff answer moves offerings between courses. Answers are durable decisions with the premise they were made on; when the premise changes, the question is asked again.
4. Mapping rules: offerings by САЗ code; a course by the UKMA Data course holding most of its offerings, recomputed nightly, a changed result asked, not applied; the semester field is the last term; specialities are only added; rows Rate UKMA cannot store are skipped and counted at build time; nothing leaving САЗ is deleted.
5. A merge moves every offering of a course under row locks and deletes the course only once it is empty, so no rating, enrollment or plan is lost.
6. After an apply the cache is cleared except sessions; the saved change numbers move to the heads the list was built from.
7. The old scraper's import refuses to run once any row is linked. The scraper itself stays until enrollments have their own sync.
8. Later, offering additions and offering field changes that touch no rating or plan may apply on their own after five clean nights. Mapping questions and removals always need a person.

Open for the owner: D1 keeping courses apart against spec rule 9; D3 bulk keep-apart for unrated questions; D4 never removing specialities; D5 deleting a course emptied by a merge; D8 the auto-apply limits.

## Consequences

- ✅ No catalog change reaches students without a person, until auto-apply is turned on.
- ✅ Rate UKMA keeps working when UKMA Data is down: pages read Rate UKMA's own tables; only the list stops refreshing.
- ✅ Re-running is safe: the list compares two states, so applied items vanish and unapproved ones come back.
- ✅ Most of the 268 offerings the teacher sync skipped arrive through group `new`.
- ⚠️ A full read every night (~35 requests) instead of the incremental read in spec rule 5.
- ⚠️ Mapping questions need a person; 199 on the first night.
- ⚠️ Rate UKMA's course groups may differ from UKMA Data's on purpose.
- ❌ Specialities UKMA Data does not know stay in Rate UKMA unchecked until UKMA Data learns them.
- ❌ The scraper cannot be deleted until enrollments have their own sync.

## Considered Alternatives

1. **Apply every change at once, like the teacher sync.** Rejected: a merge moves ratings between course pages, and the owner wants to see changes first.
2. **Read only rows above the saved change number.** Rejected: with groups applied separately, moving the number after a partial apply loses the rest, and not moving it is a full read anyway.
3. **Take UKMA Data's course groups as they are.** Rejected: 11 rated courses would merge, some of them different courses.
4. **Decide mapping questions in UKMA Data's review cases.** Rejected for now: UKMA Data opened no `course_match` case, and a merge there merges for every reader; keeping two courses apart is Rate UKMA's choice.
