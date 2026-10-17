# САЗ edge cases

Every variation found in the САЗ pages that UKMA Data stores, with a count, up to five САЗ codes, an invented example and where the [schema](schema.md) or a parser rule handles it. It is the input for the parsers (#763, #766) and for course groups (#765).

## Sources

- The page snapshots of runs 4 to 14 in a local dev database, 2026-10-13: 634 catalog pages, 12,603 course pages and 12,306 students pages, one academic year per run from 2018-19 to 2026-27.
- Rate UKMA's scraper (`src/backend/scraper`) and its tests, for the quirks it already handles.
- The file Rate UKMA's importer loads (`scraper/state/courses.jsonl`, 24,255 codes, last written 2026-03-26), for the codes Rate UKMA holds. The local Rate UKMA database was empty, so the file stands in for it.

Counts are pages unless a case says entries (one student on one students page). Examples are invented: no real title, teacher, student or email appears here. The queries that produce every count are kept outside the repository with the survey notes.

## Main cases

| Case | Count | Handled by |
| --- | --- | --- |
| [A1](#a1-catalog-defaults-hide-masters-and-not-recommended-courses) Catalog defaults hide master's and "not recommended" courses | 10,602 of 21,188 Rate UKMA codes missing | crawler rule, before #763 |
| [A2](#a2-students-page-fails-with-http-500) Students page fails with HTTP 500 | 298 | `run_pages.http_status`, removal scopes |
| [A5](#a5-pages-change-with-the-signed-in-account) Pages change with the signed-in account | 12,603 | snapshot rule |
| [B1](#b1-teacher-row) Teacher row on the card | 4,912 | `offerings.saz_teachers` |
| [B6](#b6-offering-in-several-terms) Offering in several terms | 1,454 | `offering_terms` |
| [C1](#c1-parallel-sections) Parallel sections | 782 groups, 1,817 pages | course rule |
| [D1](#d1-cdoc-is-the-students-programme-record) `cdoc` is the student's programme record | 11,872 records | `student_programmes.saz_cdoc` |
| [D8](#d8-enrollment-status) Most entries say "не навчається" | 285,854 of 449,049 entries | `enrollments.is_student_active` |

## A. Crawl and snapshots

### A1. Catalog defaults hide master's and "not recommended" courses

- Count: all 634 catalog pages carry two filters the crawler did not ask for: level `Бакалавр` and `рекомендовано`. Rate UKMA holds 21,188 codes for 2018-19 to 2025-26, and 10,602 of them have no snapshot: 9,021 master's and 1,581 bachelor courses. Every stored course page says `Бакалавр`. For 2026-27, 1,507 of 3,055 are missing.
- Codes: 209470, 209487, 209505 (master's), 208933, 208935 (bachelor).
- Handled by: a crawler rule, proposed for #761. The catalog request must set every level and both `selected` values, but no other filter: Rate UKMA's scraper selects every option of every filter, and that drops the cases in [Rate UKMA codes](#rate-ukma-codes). Which request returns the whole year needs one check against САЗ before #763.

```html
<select name="filter[level][]"><option value="1" selected>Бакалавр</option><option value="2">Магістр</option></select>
<select name="filter[selected][]"><option value="1" selected>рекомендовано</option><option value="0">не рекомендовано</option></select>
```

### A2. Students page fails with HTTP 500

- Count: 298 students pages in runs 6 to 10 (2018-19: 60, 2019-20: 84, 2020-21: 88, 2021-22: 47, 2022-23: 19). Each course page loaded. During the #761 crawl, a refetch of four of them (208974, 242614, 258195, 275521) got 500 again, so САЗ fails on them every time.
- Codes: 208930, 224760, 241753, 258195, 275521.
- Handled by: `run_pages.http_status` and the removal scopes in [schema](schema.md#when-a-run-may-remove-rows). The offering is published, its enrollments are not.

```text
GET /course/900123/students -> 500
```

### A3. Course page fails while its students page loads

- Count: 1 (2026-27). A refetch during the #761 crawl got it, and a run now retries such a page once more at the end (#761).
- Codes: 364653.
- Handled by: a parser rule. A students list is parsed only after its offering exists.

### A4. Catalog pages carry the signed-in student's plan

- Count: 634 of 634. Each catalog page has a panel with the account owner's study plan and 14 links to `/course/<code>` outside the cards. 54 cards of those codes use `panel-info`.
- Codes: 362864, 362924, 364999, 365025, 365090.
- Handled by: the catalog parser reads only the card buttons (`COURSE_BUTTON`). The snapshot holds personal data, so it needs the "Read snapshots" scope.

```html
<a class="btn btn-block btn-default" href="/course/900123">  <!-- a card: read -->
<a href="/course/900456">                                  <!-- the plan panel: skipped -->
```

### A5. Pages change with the signed-in account

- Count: 12,603 of 12,603 course pages show the account owner's name in the navbar. 749 pages highlight the owner's own programme row with `class="success"`.
- Codes: 208930, 209013, 209014, 209020, 209023 (highlighted row).
- Handled by: a snapshot rule, proposed for #763. Before hashing, the worker drops the navbar and the `success` class. Otherwise a sign-in with another account changes the hash of every page, and every page is stored again.

```html
<li><a href="/profile"><span class="glyphicon glyphicon-user"></span> Зразок Олена Петрівна</a></li>
<tr class="success"><td>Комп`ютерні науки</td><td><span class="label label-default">Обов`язкова</span></td></tr>
```

### A6. Site parts that change on every САЗ release

- Count: 12,603 of 12,603 pages hold the footer year, the navbar list of individual plans (2023-24 to 2026-27) and 4 asset versions (`?v=1791652024` and 3 others).
- Codes: any.
- Handled by: the same snapshot rule as A5. The hash covers the page header and `#w0` only, so a new year or a САЗ deploy does not store every page again.

```html
<script src="/assets/92e1c474/js/app.js?v=1791652024"></script>
<p class="pull-left hidden-xs">© <a href="https://www.ukma.edu.ua/">National University of Kyiv-Mohyla Academy</a> 2026</p>
```

### A7. Empty students list

- Count: 1,953 lists are `[]`. On exactly these 1,953 the card has no enrollment block, and no non-empty list lacks it.
- Codes: 208946, 208949, 208954, 208967, 208968.
- Handled by: a parser rule. `[]` is a valid list with no enrollments, not a failure.

```json
[]
```

### A8. A САЗ code belongs to one year

- Count: 0 codes appear in two years; a code is never reused across years.
- Handled by: `offerings.saz_code` is unique. The academic year comes from the card.

## B. Course card

### B1. Teacher row

- Count: 4,912 of 12,603 cards have a `Викладач` row (2018-19: 16, 2024-25: 970). 1,677 list two or more people separated by commas, 73 use a semicolon and 88 add a role after a dash.
- Codes: 209146, 209485, 209495, 210479, 225129.
- Handled by: `offerings.saz_teachers` keeps the text as read. It is a hint for teacher matching (#767), not an instructor link, because it holds initials, not emails.

```html
<tr><th>Викладач</th><td>Зразок О. П., Приклад І. В.</td></tr>
```

### B2. Status label

- Count: `Курс відбувся` 9,999, `Курс не відбувся` 2,339, no status label 265 (236 of them in 2024-25 to 2026-27).
- Codes: 208941, 209770, 221441, 221452, 221608 (no label).
- Handled by: `offerings.status` with `held`, `not_held` and `unknown`.

```html
<span class="label label-success">Курс відбувся</span>
<span class="label label-default">Курс не відбувся</span>
```

### B3. Practical course label

- Count: 489 cards add `Практичний`.
- Codes: 209001, 209005, 209006, 209100, 209104.
- Handled by: `offerings.is_practical`.

```html
<span class="label label-warning">Практичний</span>
```

### B4. Credits and hours

- Count: 561 cards have half credits (`4.5 кред.`), 121 have 0 credits and 44 have 0 hours.
- Codes: 209153, 209181, 209305, 209635, 209925 (0 credits).
- Handled by: `offerings.credits` is `numeric(4,1)` and 0 is allowed. Rate UKMA's scraper drops a course with 0 credits and no terms; the parser keeps it.

```html
<span class="label label-default" title="0 кредитів">0 кред.</span>
<span class="label label-default" title="0 годин">0 год.</span>
```

### B5. Term credits do not add up to the card credits

- Count: 22 cards, for example 22.5 on the card and 11 across its terms.
- Codes: 208941, 209023, 209825, 210145, 221441.
- Handled by: both are stored, `offerings.credits` and `offering_terms.credits`, and neither is corrected.

### B6. Offering in several terms

- Count: 1,196 cards have 2 term rows and 258 have 3 (fall, spring and summer).
- Codes: 208930, 208950, 209013 (2 terms); 209023, 209740 (3 terms).
- Handled by: one `offering_terms` row per term (rule 7). Rate UKMA picks its own semester when it syncs; its importer takes the latest term.

```html
<tr><th>Семестри</th><td><span class="label label-default">Семестр 5</span> <span class="label label-default">Семестр 6</span></td></tr>
<tr><th>Осінь</th><td>...</td></tr>
<tr><th>Весна</th><td>...</td></tr>
```

### B7. Card without terms

- Count: 96 cards have no `Деталі по семестрах` block (81 of them in 2019-20). 1 card has the block and term rows but no `Семестри` row.
- Codes: 209486, 209890, 210410, 210483 (no block); 247004 (no `Семестри` row).
- Handled by: an offering with no `offering_terms` rows is valid and published.

### B8. One term row covers semesters of several study years

- Count: 141 cards list more `Семестр N` labels than term rows, for example `Семестр 5` and `Семестр 7` with one `Осінь` row. 142 cards list semesters of two or more study years.
- Codes: 209023, 209027, 209041, 209047, 209050.
- Handled by: `offering_terms.semesters` is an array. Odd semesters are fall, even are spring and `Nд` is summer, and this matched on every card.

```html
<span class="label label-default">Семестр 5</span> <span class="label label-default">Семестр 7</span>
<tr><th>Осінь</th><td>...</td></tr>
```

### B9. Summer term

- Count: 3,026 cards have a `Семестр Nд` label and exactly these 3,026 have a `Літо` row.
- Codes: 208949, 208958, 208967.
- Handled by: `offering_terms.season` = `SUMMER`, term id `2025-26-SUMMER`.

### B10. Control type of a term

- Count: cards with at least one term of each control: `залік` 8,426, `екзамен` 4,088, `теза` 576, `не має контролю` 293, `захист дипломної роботи` 5. A card with two terms can count twice. On 11,864 cards the lecture, seminar and practice hours are totals for the term, although their `title` says "per week".
- Codes: 209153, 209181 (`не має контролю`); 209573, 225340, 242519 (`захист дипломної роботи`).
- Handled by: `offering_terms.control` with 5 values. Rate UKMA's scraper maps every unknown value to an exam, so a thesis term becomes an exam there. The parser reads the label text, never the `title`.

```html
<span class="label label-default" title="3.0 кредитів">3.0 кред.</span>
<span class="label label-default" title="4 годин на тиждень">4 год./тижд.</span>
<span class="label label-default" title="24 годин на тиждень">24 сем.</span>
<span class="label label-default">теза</span>
```

### B11. Programmes on the card

- Count: 118 cards have no programmes block (2018-19: 54, 2019-20: 49). 2,085 list two or more programmes, up to 31. 323 mix two kinds. 1 lists the same row twice.
- Codes: 208941, 208947, 208954 (no block); 317578 (same row twice).
- Handled by: `offering_programmes` with the key (offering, programme). A repeated row collapses into one.

```html
<div class="collapse text-justify" id="course-card--900123--spec">
  <table class="table table-bordered table-condensed">
    <tr><td>Економіка</td><td><span class="label label-default">Вільного вибору</span></td></tr>
  </table>
</div>
```

### B12. Unlimited limits

- Count: `необмежено` for the maximum of students on 9,501 cards and of groups on 7,713.
- Codes: 208930, 208936, 208941.
- Handled by: `offerings.max_students` and `max_groups` are null when unlimited.

```html
<tr><th>Максимальна кількість студентів</th><td><span class="label label-success">необмежено</span></td></tr>
```

### B13. Enrollment block

- Count: 1,953 cards have no enrollment block (the empty lists of A7). In all 10,650 blocks the label `Кількість затверджених груп` appears twice, with the same value.
- Codes: 208946, 208949 (no block); 208930 (label twice).
- Handled by: `offerings.enrolled_active` is null without the block. The parser reads the first of two equal labels.

### B14. Card count and list disagree

- Count: 10,650 cards have the count; 298 of them are the A2 offerings with no stored list. On 10,271 of the other 10,352 the count equals the list entries with status 10 and an active student; on 81 it does not.
- Codes: 341247, 341742, 341844, 340965, 341761.
- Handled by: both are stored; the list is the source for enrollments and a mismatch fails nothing.

### B15. No annotation

- Count: 3,227 cards have no annotation block.
- Codes: 340268, 340438, 341645, 340335, 341644.
- Handled by: `offerings.annotation` is null.

### B16. Title markup

- Count: 97 titles hold an HTML entity (`&quot;`, `&#039;`), 156 a double space, 1,675 end with a note in brackets and 110 hold two languages split by ` / `.
- Codes: 208936, 209011 (entity); 209104, 209114 (double space); 243111, 258229 (two languages).
- Handled by: a parser rule. `offerings.title` is unescaped, with whitespace collapsed. The course rule normalises further (C3).

```html
<h1>Вступ до аналізу даних  (англ. мовою) / Introduction to Data Analysis <small>Перегляд деталей курсу</small></h1>
```

### B17. Fields that never varied

- Count: all 12,603 cards: `Формат 2015`, the year in `Навчальний рік` matches the run, the `Код` cell matches the path, and `Освітній рівень` is `Бакалавр` (because of A1).
- Handled by: `offerings.level` and `offerings.format` stay fields, so master's courses fit once A1 is fixed.

## C. Course identity

### C1. Parallel sections

- Count: 782 groups of 2 to 6 codes share title, department and year: 1,817 cards. Counted by department; the course rule (C2) uses faculty. Their students lists are often the same: 312 groups of lists, 937 pages, have the same content hash.
- Codes: 209028, 209263, 209511, 209541, 210410 (one group).
- Handled by: each code stays its own offering with its own enrollments. The course rule puts them in one course.

### C2. Same course across years

- Count: 2,809 groups by title and department; 2,022 span two or more years and 420 span all nine.
- Handled by: the first course rule, as in Rate UKMA's importer: title, faculty, programmes and level. The counts use title and department, a close stand-in. The САЗ code never links years (A8).

### C3. Titles that differ a little between years

- Count: 141 title groups differ only by a note in brackets at the end, 2 only by letter case.
- Codes: 345718, 345745, 351378, 351381 (one group).
- Handled by: the review case "an offering may belong to an existing course", with a new course as the safe answer. A trailing note can be the language of a separate course, so it is not merged without staff.

```text
Вступ до аналізу даних
Вступ до аналізу даних (англ. мовою)
```

## D. Students lists

Every list is a JSON array of objects with the same 17 keys (449,049 entries).

### D1. `cdoc` is the student's programme record

- Count: `cdoc` never equals the course code. There are 11,872 values; each has one name and one programme. 156 emails have 2 or 3 values, and 1 value has 2 emails.
- Handled by: `student_programmes.saz_cdoc`. A student is a person (email), a programme record is a `cdoc`. When a record shows a new email, the latest list wins: the record moves to the student with that email.

```json
{"cdoc": 600123, "name": "Зразок Олена Петрівна", "email": "o.zrazok@ukma.edu.ua", "specName": "Економіка", "grade": 3}
```

### D2. One student twice in one list

- Count: 175 pairs on 144 pages: the same email with two different `cdoc`, a student on two programmes.
- Codes: 209234, 209348, 209452, 209502, 209530.
- Handled by: `enrollments` is unique on (offering, programme record), not on (offering, student).

### D3. Empty email

- Count: 338 entries on 293 pages belong to 18 programme records. Only 1 of them has an email in another list.
- Codes: 209047, 209052, 209054, 209169, 209177.
- Handled by: `students.email` is nullable; such a student is found by `cdoc`.

```json
{"cdoc": 600124, "name": "Приклад Ігор Васильович", "email": ""}
```

### D4. Email domain cut short

- Count: 51 entries in 2019-20 to 2022-23, all of one programme record, end with `@ukma.edu.u`.
- Codes: 226135, 226137, 226140, 226185, 226196.
- Handled by: stored as read in `students.email`. No list has the full address for that record, so nothing collides; the record links the entries.

### D5. Upper-case email

- Count: 460 entries.
- Codes: 209258, 209265, 209271, 209273, 209285.
- Handled by: `students.email` is stored lower-case; lookups ignore case.

### D6. Name shapes

- Count: three words 445,934 entries, two 1,582, four 1,441, five 92. 105 have extra spaces. 17,367 use a backtick for the apostrophe. 258 entries in 2024-25 to 2026-27 hold `*` inside the name.
- Codes: 314804, 314809, 314810 (`*`); 209057 (extra space).
- Handled by: `students.full_name` keeps the name with whitespace collapsed. A name with `*` never replaces one without it. `last_name`, `first_name` and `patronymic` are filled only for three words and are null otherwise.

```json
{"name": "Зразок-Приклад Марія"}
{"name": "Зр*зок Олена Петрівна"}
```

### D7. A student's data drifts between lists

- Count: 12 emails appear with two names, 44 names with two emails and 124 emails with two programmes.
- Handled by: a student is found by email, else by `cdoc`, never by name. The latest list sets the name.

### D8. Enrollment status

- Count:

| status | statusLabel | Entries |
| --- | --- | --- |
| 10 | не навчається | 274,187 |
| 10 | записано | 157,536 |
| 10 | примусово | 1,301 |
| -10 | не навчається | 11,667 |
| -10 | виписано | 4,358 |

  "не навчається" means the person is no longer a student, not that they left the course. `isForced` is true on 3,886 entries.
- Handled by: `enrollments.status` is `enrolled` (10) or `unenrolled` (-10). `enrollments.is_student_active` keeps the person's state and `is_forced` the flag; the label follows from them. Rate UKMA's scraper also counts "не навчається" as enrolled.

```json
{"status": 10, "statusLabel": "не навчається", "isStudentActive": false, "isEnrolled": true, "isUnenrolled": false, "isForced": false}
```

### D9. No group

- Count: `group` is null on 159,053 entries; otherwise 1 to 70.
- Handled by: `enrollments.group_no` is nullable.

### D10. Timestamps

- Count: `createdAt` is 0 on 33,553 entries and `updatedAt` on 29,980, all in 2018-19 and 2019-20. 152 entries in 2021-22 have `updatedAt` before `createdAt`.
- Codes: 258242, 259099, 259783, 259789, 259838 (`updatedAt` first).
- Handled by: `enrollments.saz_created_at` and `saz_updated_at` are null when 0, kept as read otherwise.

### D11. Kind per enrollment

- Count: `mandat` 274,143 entries, `option` 109,802, `zfree` 65,104.
- Handled by: `enrollments.kind` (compulsory, professionally oriented, elective). It is the kind for that student's programme, which can differ from the card's list.

### D12. Programme names differ between cards and lists

- Count: cards name 41 programmes, lists 40; 34 names are in both. The rest are mostly master's programmes, whose students take bachelor courses.
- Handled by: `programmes` is filled from both, matched by exact name.

### D13. Large lists

- Count: the largest list has 1,360 entries; the longest page is 541,029 characters.
- Codes: 362858, 314804, 340216.
- Handled by: the API's cursor pagination of enrollments; the parser needs no rule.

## Rate UKMA codes

The spec's done-when asks for every САЗ code that Rate UKMA holds for 2018 to 2025 to exist in the service. Against the stored snapshots:

| Years | Rate UKMA codes | Missing | Master's | Bachelor |
| --- | --- | --- | --- | --- |
| 2018-19 to 2025-26 | 21,188 | 10,602 | 9,021 | 1,581 |
| 2026-27 | 3,055 | 1,507 | 1,234 | 273 |

- The missing codes are the A1 filters: all master's courses and the bachelor courses that are not `рекомендовано`. The crawl needs the A1 fix to reach the done-when.
- 12 codes in the file have no year and no snapshot.
- 469 snapshot codes are not in Rate UKMA. 206 are cards with no programmes (B11) or no terms (B7): selecting every option of a filter drops a card with no value for it. Of the other 263, 257 have no status label (B2) and 128 are 2026-27 courses, some added after 2026-03-26.
