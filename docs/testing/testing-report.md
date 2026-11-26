# Testing report: ІНП planner

Manual pass of the ІНП scenario (US-5.1, US-5.2, US-5.9, US-5.10a, US-5.10b), the bugs it found and a reflection on AI-written tests. Strategy and autotests: [testing-strategy-planner.md](testing-strategy-planner.md).

Where: a local stack with the real backend and a seeded SQLite database (student of «Інженерія програмного забезпечення», programme start 2025, `fe_personal_plan` on), desktop 1440 px and phone 390 px. Bug 1 was also measured on staging with a read-only query.

## 1. Smoke checklist

1. Open `/plan`.
   - **Check:** taken and mandatory courses sit in their year and semester, with no ✕.
   - **Check:** past years have no «Додати дисципліну».
   - **Check:** the final year's summer says there is no summer semester.
2. In a later year, click «Додати дисципліну».
   - **Check:** the subtitle names the course, year and semester the pick goes to.
   - **Check:** the type filter starts at «Проф.-орієнтовані»; switching to «Вільного вибору» shows only electives for this speciality. **Failed, bug 1.**
   - **Check:** search narrows the list; «Скинути фільтри» brings the defaults back.
   - **Check:** changing the semester filter changes the semester the pick goes to.
3. Click «Додати» on two courses one after the other.
   - **Check:** both leave the catalog list and both appear in the plan. **Failed when the first save answered last, bug 2.**
4. Add a course «Як запасну».
   - **Check:** it shows as a backup and the credit totals do not change; «Основні» hides it.
5. Promote the backup, then remove it with ✕.
   - **Check:** totals move by its credits each time; after a reload the plan is the same.
6. Open a course page with the flag on.
   - **Check:** a planned course says «У вашому ІНП» with its year and semester; the add dialog there works as in step 2.
7. Repeat steps 1–3 at 390 px.
   - **Check:** the dialog fits the screen and its buttons are reachable.

## 2. Bugs

### Bug 1: the type filter used a course's type from any year

- **Symptom:** in «Додати дисципліну», a course could appear under «Проф.-орієнтовані» while it is an elective this year, and be missing from «Вільного вибору». Example: «Комп'ютерні мережі» was professional for ІПЗ in 2024 and is an elective in 2026.
- **Impact:** the student files the course under the wrong kind, so the ≥ 54 and ≤ 25 limits are counted wrong. On staging, for autumn 2026, 147 of the 830 speciality and course pairs the filter returned (18%) were not professional that year.
- **Why it happened:** a course's type is stored per offering (one year and semester), not on the course. `CourseRepository._apply_speciality_filters` checked the year and semester on the offerings, but checked the type in a separate subquery over all of the course's offerings. The two conditions were never tied to the same offering, so «offered this autumn» and «professional once, in 2024» together passed as «professional this autumn».
- **Fix:** the type subquery now reads only the course's offerings in the filtered year and semester (`_speciality_links_in_filtered_semesters`), for both the include rule (`type_kind`) and the exclude rule behind «Вільного вибору».
- **Test:** `test_type_kind_reads_the_offering_in_the_filtered_semester` (red on main, green with the fix) and `test_type_kind_matches_a_spring_offering_in_the_filtered_year`.

### Bug 2: a quickly added second course vanished from the plan

- **Symptom:** after adding two courses in a row, the plan showed only the first, and the second was back in the catalog with «Додати». A reload showed both.
- **Impact:** the student thinks the second pick was lost and adds it again or gives up; the database is right, the screen is wrong.
- **Why it happened:** each «Додати» sends its own `PUT`, and the server answers with the whole plan. `usePlanActions` wrote every answer into the cached plan in the order the answers arrived, not the order the requests were sent. When the first request is slower, its answer (a plan with one course) arrives last and overwrites the newer plan with both.
- **Reproduction:** delay the first `PUT` by 1.5 s in the browser, add «Архітектура програмних систем», then «Хмарні обчислення» 200 ms later.
- **Fix:** each save gets a number when it starts, and only the answer to the latest save is written to the cache. A failed save reloads the plan from the server.
- **Test:** `usePlanActions.test.tsx` answers two saves in reverse order and expects the newest plan (red on main, green with the fix).

## 3. AI-written tests: where they were weak

- **#855:** a generated Playwright assertion passed on a page that never rendered, and the shots suite it lived in is not run in CI, so nothing caught it.
- **#846:** a check passed on state the retention window had already deleted, so it could not fail.
- **#944, the counter-example:** the teacher sync tests compare the new flow's result with what the old direct sync wrote for the same fixture. The expected value comes from an independent source, not from the code under test, so the test can fail.
- **This pass:** neither bug was caught by the existing tests, because both sit between two parts that were tested apart (two filter conditions; two requests and a cache). Both new tests were run against the old code first and turned red. A test we have not seen fail is not trusted.
