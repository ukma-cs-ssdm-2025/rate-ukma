# ADR-0022: Rate UKMA Syncs from UKMA Data Through Recorded Runs and Approved Changes

## Status

Proposed. Amends [ADR-0020](0020-planned-teachers-and-in-app-scheduler.md): the teacher sync records its changes and waits for approval instead of writing them directly.

## Date

2026-11-22

## Context

Rate UKMA's catalog (faculties, departments, courses, offerings, their terms and specialities) comes from `src/backend/scraper`, run by hand. [ADR-0011](0011-saz-data-service.md) moved САЗ crawling to UKMA Data and left Rate UKMA a sync importer to write. [ADR-0020](0020-planned-teachers-and-in-app-scheduler.md) added the in-app scheduler and the first sync, for teachers, which writes every difference it finds straight away and keeps no record of it.

- **The catalogs agree almost everywhere.** On 2026-11-21, 24,290 of Rate UKMA's 24,345 offerings existed in UKMA Data by САЗ code, in the same year; 5,101 of 5,492 courses mapped one-to-one and held 1,888 of 1,929 ratings.
- **Course groups differ in one way.** UKMA Data merges a course across a department handoff; Rate UKMA keeps a course per department. 190 UKMA Data courses span 381 Rate UKMA courses; with 9 split courses, 11 rated courses (41 ratings) are involved. Some are real handoffs, some different courses with a generic title.
- **Ratings, enrollments and plans hang on offerings.** Moving an offering moves them to another course page.
- **The owner wants to see every change before it lands**, teachers included, and to decide per kind of change, without a deploy, which ones may later apply by themselves.
- **UKMA Data may be down or serve partial data.** Rate UKMA must keep working and must not read a short answer as removals.

## Decision

Every sync from UKMA Data is one system of recorded runs, recorded changes and per-kind policies, shown on /data.

1. **Runs.** Each execution of a sync (source `teachers` or `catalog`) is a `SyncRun` with its start and finish, the change numbers it read from and up to and those its applies saved, its status, and counts per group. A failed run leaves the previous run's changes in place.
2. **Changes.** Each difference a run finds is a `SyncChange` with its group, kind, before → after and state: `proposed`, `applied`, `rejected` or `superseded`. A run's success supersedes the source's older proposed changes; an unapproved change comes back the next night if it still differs. A change whose row changed since the run is superseded as stale when an apply meets it. An offering's teacher link changes apply or retire as one unit: when one is stale or rejected, the rest of that offering's links are superseded too, and rejecting a new teacher rejects every offering's links that need that teacher.
3. **Policies.** Each kind of change has a policy, `needs_approval` or `auto`, stored in `SyncPolicy` and edited by superusers on /data without a deploy; every edit writes a `SyncPolicyChange` (who, when, old → new) in the same transaction. A missing row means `needs_approval`, so every kind, teachers included, starts there and no data migration seeds it. Kinds in group `mapping` and kinds that move ratings between courses can never be `auto`: the set is derived from the kind registry, and a database check constraint, the policy service, the policy API and the auto path each refuse it, with tests.
4. **Applying.** A superuser's approval and a policy's auto apply run the same code: only the current run's changes (a run over 48 h old after a confirm naming its age; never by policy past 36 h), under the source's advisory lock, in one transaction, after a stale pre-pass, with a `SyncApproval` row written first (user null for an auto apply). A change applies only when the rows it requires exist; otherwise it waits. A preview runs the same code and rolls back.
5. **Teacher sync.** `sync_offering_instructors` records `teacher_created`, `teacher_link_added` and `teacher_link_removed` changes instead of writing links. Since every kind starts at `needs_approval`, teacher changes wait on /data from its deploy on; it ships after the approve controls.
6. **Catalog sync.** A scheduled job, `build_catalog_proposals` (02:30 UTC, behind the waffle switch `catalog_sync_proposals`, which no migration creates: a missing switch is off, and `manage.py waffle_switch catalog_sync_proposals on --create` turns it on per environment), reads UKMA Data's whole catalog from change number 0 and records a run with five groups: link, new, change, mapping, removed. A short read fails the run.
7. **Identity.** Rate UKMA keeps its own rows and stores UKMA Data's ids on `CourseOffering`, `Course`, `Department` and `Faculty`. Several Rate UKMA courses may link to one UKMA Data course when staff keep them apart. Only a staff answer moves offerings between courses; answers are durable decisions with the premise they were made on, re-asked when the premise changes. Mapping rules: offerings by САЗ code; a course by the UKMA Data course holding most of its offerings, recomputed nightly, a changed result asked, not applied; the semester field is the last term; specialities are only added; rows Rate UKMA cannot store are skipped and counted at run time; nothing leaving САЗ is deleted (a `removed` change is acknowledged, never applied).
8. **Merges.** A merge moves every offering of a course under row locks and deletes the course only once it is empty, so no rating, enrollment or plan is lost. After a catalog apply the cache is cleared except sessions.
9. **Types.** UKMA Data's OpenAPI file is the only description of its API: Rate UKMA generates its pydantic models from it and CI fails when they are stale. Rate UKMA's own sync API uses ordinary serializers that reference those types.
10. **The scraper.** Its import refuses to run once any row is linked; the scraper itself stays until enrollments have their own sync.

Open for the owner: D1 keeping courses apart against spec rule 9; D3 bulk keep-apart for unrated questions; D4 never removing specialities; D5 deleting a course emptied by a merge; D8 which kinds go `auto`, and when; D11 a rejected change returning the next night; D13 auto leaving a catalog change on rated rows for a person (teacher link changes are not held back, as the teacher sync always wrote links on rated offerings); D14 real teacher names on staging.

## Update 2026-11-22: Decisions Move to the Console

The /data approval UI is replaced by a console command. A superuser, usually through a Claude session, decides changes with `manage.py catalog_sync` (`status`, `show`, `apply`, `reject`, `answer`, `policy`). It calls the same services the removed endpoints called, so locks, the 48-hour stale check and the never-`auto` kinds hold as before. Every write command is a dry run unless `--yes` is given, and `--by <username>` records the superuser the decision belongs to.

/data becomes read-only: it shows what changed, what waits per group, what was applied by whom and when, the policies, and the count of open UKMA Data review cases. The write endpoints only that UI used are removed: policy update, approve, reject, change answer, keep-apart for unrated questions, preview, bulk question answers and the active-approval lookup. The preview tokens of item 4 are no longer issued; the console's dry run takes their place. Runbook: [catalog-sync-console.md](../../runbooks/catalog-sync-console.md).

Why: the approval screens took most of the sync's UI code and still needed a person to read every change, while a dry run in the console prints the same list, old → new, in one step that Claude can read back and explain.

## Update 2026-11-23: One Decision Service, Revert and a Journal

Decisions come back to /data, but through one service rather than the removed endpoints. `rating_app.sync.decisions` is the only entry for writes (`preview`, `apply`, `reject`, `revert`), and `rating_app.sync.journal.entries` is the only entry for history. The console and the new superuser API call them; an import test fails when a view or `management/commands/catalog_sync.py` imports `sync.apply` or `sync.revert` directly, so the two surfaces cannot drift.

- **Preview and apply.** A preview runs the same apply code in a rolled-back transaction and issues the existing `SyncPreview` token. Apply sends the token back; a selection whose size, run or user changed is refused as `selection_changed` («Список змінився. Перегляньте ще раз.»). A `client_key` retry returns the first result instead of «немає змін».
- **Timing margin.** The biggest group is all four link kinds, about 29 460 changes. A dry run applying them took 16.1 s on a local copy of the staging database (after #954; before it, course links failed). Staging ran the failing dry run about 1.8 times slower than local, which puts a full link apply on staging at about 29 s. nginx gives `/api/` 60 s and cuts the connection without stopping gunicorn, so a request must finish well under it. The UI applies at most 5 000 changes per request (lowest change ids first) and reports the rest; the console keeps no cap. An apply passed a deadline checks the clock between handler batches: past 40 s it raises, rolls the whole transaction back and refuses as `deadline_exceeded`. With a deadline it also sets `SET LOCAL statement_timeout = '30s'`, so one slow statement cannot outlive the request.
- **Revert.** A revert is a new `SyncApproval` with action `revert` and a `reverts` foreign key to the original; its changes keep their original `approval` foreign key, so history still counts them under the decision that applied them, and move to the new state `reverted`. It always starts as a dry run listing every blocker in Ukrainian, is all-or-nothing, and takes the same source advisory lock as apply. It writes only the keys each change wrote, from `before`. Revertible: `link_*`, `relink_course`, `change_*`, `move_offering`. Not reverted: `new_*` («Лише вручну: нові записи вже можуть мати оцінки»), `merge_courses` and `place_offering` («Лише вручну, з резервної копії бази»); `removed_*` wrote nothing, so there is nothing to undo. Blockers are: the record no longer holds what the apply wrote (the same comparison as `is_stale`, departments by id); a later, not-reverted applied decision touched the same record or has a change requiring one here; the kind is currently `auto`, so the nightly job would apply it again; and a `move_offering` that merged study plans away, whose count the move handler records in the approval's counts. A reverted relink or move also supersedes its live mapping answer, or the builder would propose it again.
- **Auto applies leave the request.** A human approve no longer runs `apply_by_policy`; auto kinds apply only in the nightly `build_catalog_proposals`, so a click does not inherit the auto path's time.
- **Journal.** `journal.entries(limit, before)` merges approvals (apply, reject, revert; by a person or by the nightly job), policy changes and mapping answers, newest first, each with who, when, counts, outcome and whether it can be reverted with the reason. `catalog_sync log` and the /data «Журнал» read it.

## Consequences

- ✅ No change reaches Rate UKMA without a person until a superuser sets its kind to `auto`, and every policy change is audited.
- ✅ Every sync, teachers included, leaves a record: what each run proposed, who applied or rejected what, and what applied by itself.
- ✅ Rate UKMA keeps working when UKMA Data is down: pages read Rate UKMA's own tables; only new runs stop.
- ✅ Re-running is safe: each run compares two states, so applied changes vanish and unapproved ones come back.
- ✅ Most of the 268 offerings the teacher sync skipped arrive through the catalog's group `new`.
- ⚠️ Teacher links stop updating by themselves: from the deploy of the teacher change on, a superuser approves them, until their kinds are set to `auto`.
- ⚠️ A full catalog read every night (~35 requests) instead of the incremental read in spec rule 5.
- ⚠️ Mapping questions need a person; 199 on the first night.
- ⚠️ Rate UKMA's course groups may differ from UKMA Data's on purpose.
- ❌ Specialities UKMA Data does not know stay in Rate UKMA unchecked until UKMA Data learns them.
- ❌ The scraper cannot be deleted until enrollments have their own sync.

## Considered Alternatives

1. **Apply every change at once, as the teacher sync did.** Rejected: a merge moves ratings between course pages, and the owner wants to see changes first.
2. **A separate model and page per source.** Rejected: two review flows to learn and maintain; the owner wants one place for every sync.
3. **Policies in settings or switches.** Rejected: a change needs a deploy and leaves no audit of who changed what.
4. **Read only rows above the saved change number.** Rejected: with changes applied separately, moving the number after a partial apply loses the rest, and not moving it is a full read anyway.
5. **Take UKMA Data's course groups as they are.** Rejected: 11 rated courses would merge, some of them different courses.
6. **Decide mapping questions in UKMA Data's review cases.** Rejected for now: UKMA Data opened no `course_match` case, and a merge there merges for every reader; keeping two courses apart is Rate UKMA's choice.

## Update 2026-11-23: UKMA Data Decisions from /data

UKMA Data's review cases and course merges change data every reader of UKMA Data sees. Rate UKMA proxies them for superusers and lets the key's scopes decide where the buttons work.

- **One key.** The decision calls (`POST /v1/review-cases/{id}/decide`, `POST /v1/courses/{id}/merge`, `POST /v1/courses/{id}/unmerge`) use the same `UKMA_DATA_API_KEY` as the lists. A second, decide-only key was considered and dropped: live's key already holds `review:decide`, so a separate key would add a secret without narrowing what a leaked live key can do. Staging's key has only `review:read`, and it must never get `review:decide`.
- **The scope guard.** The /data buttons are enabled when the status endpoint's `scopes` include `review:decide`. Every decision endpoint reads the key's scopes (`GET /v1/key`) before calling UKMA Data; without `review:decide` the answer is 403 `ukma_data_forbidden` with «Тут лише перегляд: рішення змінюють спільні дані САЗ». So live has working buttons and staging does not. Superuser-only permission stays on the view as before. A case or course id goes into UKMA Data's URL path, so the routes and `into` accept only `[A-Za-z0-9_-]{1,64}` and answer 404 or 400 before any call; UKMA Data's ids (`rev_…`, `crs_…`) fit.
- **UKMA Data's answers.** 204 is done. 404 is «UKMA Data не знає такої справи або курсу»; 409 is a refusal with a Ukrainian detail per reason (`same_course`, `course_merged`, `target_merged`, `level_mismatch`, `not_merged`, `not_student_match`, `not_open`); an unavailable service keeps the 502 answer the read endpoints use, also when it fails while the key's scopes are read. There is no parser dry run and no Rate UKMA preview, so the confirm names the case or both courses instead.
- **`UkmaDataDecision` is Rate UKMA's audit.** UKMA Data's own log keeps only the key id, so Rate UKMA writes who (user), what (action, target id, related id), how it ended (done, refused, failed) and the reason or error for every attempt that reached the service. The row is written before the call, as `failed` with `no_answer`, and settled after it, so a decision UKMA Data took is never left without who sent it. `journal.entries` merges these rows into «Журнал» and `catalog_sync log` as «Рішення в UKMA Data» — «об'єднано», «роз'єднано» or «та сама людина» — refused and failed ones included with their error. A merge is undone by an unmerge, which is another decision, not a silent row edit.

## Update 2026-11-24: Review by Step, in Words

The owner found the group screens hard to read: raw payloads, САЗ code lists, and a dry run of up to 5 000 changes on every open. /data now reviews by what a student would notice.

- **Steps.** «Чекають рішення» shows the summary's steps in apply order: exact links, links to check, new records, changes without ratings, changes with ratings, questions, removed. Each opens a table of its changes.
- **Words, not payloads.** Each change carries `view` (`rating_app.sync.view`): its title, department, semester and only the fields a student sees, old and new, with terms and exam types in Ukrainian. Ids, САЗ codes and JSON stay out of the row.
- **Narrow selections.** `preview`, `apply` and `reject` take `rated`, `match`, `changed_field` and `exclude_ids` with `group`, resolved by the same `selection.filter_ids` as the console; `pending` returns `changed_fields` counts for the field filter.
- **Dry run on demand.** Opening a step lists rows from `pending`; the dry run runs only when the person presses «Застосувати».
