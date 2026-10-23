# САЗ edge cases

Every variation found in the САЗ pages that UKMA Data stores, with a count, up to five САЗ codes, an invented example and where the [schema](schema.md) or a parser rule handles it. It is the input for the parsers (#763, #766) and for course groups (#765).

## Sources

- The pages of runs 15 to 23 in a local dev database, crawled 2026-10-13 to 2026-10-17 with the catalog fix of #761: one academic year per run from 2018-19 to 2026-27, 1,293 catalog pages, 25,771 course pages and 25,315 students pages. A run stores a page again only when it changed, so the pages are read through `run_pages.snapshot_id`.
- The course pages fall into three groups: 12,641 recommended bachelor's, 1,951 bachelor's marked "не рекомендовано" and 11,179 master's (2,128 of them not recommended). Counts below are for all three unless a case names a group. The first survey (runs 4 to 14) saw only the first group.
- Rate UKMA's scraper (`src/backend/scraper`) and its tests, for the quirks it already handles.
- The file Rate UKMA's importer loads (`scraper/state/courses.jsonl`, 24,255 codes, last written 2026-03-26), for the codes Rate UKMA holds. The local Rate UKMA database was empty, so the file stands in for it.

Counts are pages unless a case says entries (one student on one students page). Examples are invented: no real title, teacher, student or email appears here. The queries that produce every count are kept outside the repository with the survey notes.

## Main cases

| Case | Count | Handled by |
| --- | --- | --- |
| [A1](#a1-catalog-filters-and-the-recommendation-mark) Recommendation shows only on the catalog card | 4,079 cards not recommended | `offerings.is_recommended` |
| [A2](#a2-students-page-fails-with-http-500) Students page fails with HTTP 500 | 456 | `run_pages.http_status`, rule 6 |
| [A5](#a5-pages-change-with-the-signed-in-account) Pages change with the signed-in account | 25,771 | snapshot rule |
| [B6](#b6-offering-in-several-terms) Offering in several terms | 2,395 | `offering_terms` |
| [B18](#b18-no-faculty-and-department) No faculty and department | 266 | nullable `faculty_id`, `department_id` |
| [C1](#c1-parallel-sections) Parallel sections | 2,055 groups, 4,707 pages | course rule |
| [D1](#d1-cdoc-is-the-students-programme-record) `cdoc` is the student's programme record | 15,821 records | `student_programmes.saz_cdoc` |
| [D12](#d12-one-programme-name-at-two-levels) One programme name at two levels | 30 names | `programmes` unique on (name, level) |

## A. Crawl and snapshots

### A1. Catalog filters and the recommendation mark

- Count: the catalog shows only bachelor's and recommended courses unless the request asks for more. The first crawl missed 10,602 of the 21,188 codes Rate UKMA holds for 2018-19 to 2025-26 because of it. Since #761 every catalog request asks for both levels and both `selected` values, and all 1,293 catalog pages show the four options selected. Whether a course is recommended shows only as the class of its catalog card: 4,079 cards are `panel-danger` (1,951 bachelor's, 2,128 master's). The course page has no mark for it.
- Codes: 208933, 208935 (not recommended, bachelor's); 209470, 209487 (master's).
- Handled by: the catalog parser reads the card class into `offerings.is_recommended`. `panel-info` (A4) is a recommended card.

```html
<select name="filter[level][]"><option value="1" selected>Бакалавр</option><option value="2" selected>Магістр</option></select>
<div class="panel panel-danger">  <!-- не рекомендовано -->
<div class="panel panel-default"> <!-- рекомендовано -->
```

### A2. Students page fails with HTTP 500

- Count: 456 students pages in runs 15 to 19 (2018-19: 70, 2019-20: 99, 2020-21: 139, 2021-22: 84, 2022-23: 64): 298 recommended bachelor's, 17 not-recommended bachelor's and 141 master's. Each course page loaded. Each failed page was fetched twice and got 500 both times. The 298 recommended pages are exactly the 298 that failed in runs 6 to 10, so САЗ fails on them every time. The runs of 2023-24 to 2026-27 loaded every list.
- Codes: 208930, 208936, 208947, 208948, 208950.
- Handled by: `run_pages.http_status` and the removal scopes of rule 6 (see [schema](schema.md#when-a-run-may-remove-rows)). The offering is published, its enrollments are not.

```text
GET /course/900123/students -> 500
```

### A3. Course page fails while its students page loads

- Count: 0 in runs 15 to 23. The first crawl had 1 (2026-27); a run now retries such a page once more at the end (#761).
- Codes: 364653 (first crawl).
- Handled by: a parser rule. A students list is parsed only after its offering exists.

### A4. Catalog pages carry the signed-in student's plan

- Count: 1,293 of 1,293. Each catalog page has a panel with the account owner's study plan and 14 links to `/course/<code>` outside the cards. 54 cards of those codes use `panel-info`.
- Codes: 362864, 362924, 364999, 365025, 365090.
- Handled by: the catalog parser reads only the card buttons (`COURSE_BUTTON`). The snapshot holds personal data, so it needs the "Read snapshots" scope.

```html
<a class="btn btn-block btn-default" href="/course/900123">  <!-- a card: read -->
<a href="/course/900456">                                  <!-- the plan panel: skipped -->
```

### A5. Pages change with the signed-in account

- Count: 25,771 of 25,771 course pages show the account owner's name in the navbar. 844 pages highlight the owner's own programme row with `class="success"`.
- Codes: 208930, 209013, 209014, 209020, 209023 (highlighted row).
- Handled by: the snapshot rule of #774 (`snapshotOf`). Before it hashes and stores a page, the worker empties the navbar and turns `<tr class="success">` into `<tr>`. Otherwise a sign-in with another account changes the hash of every page, and every page is stored again. The pages counted here were crawled before that rule.

```html
<li><a href="/profile"><span class="glyphicon glyphicon-user"></span> Зразок Олена Петрівна</a></li>
<tr class="success"><td>Комп`ютерні науки</td><td><span class="label label-default">Обов`язкова</span></td></tr>
```

### A6. Site parts that change on every САЗ release

- Count: 25,771 of 25,771 pages hold the footer year and the navbar list of individual plans (2023-24 to 2026-27). The pages carry 6 asset versions; `app.js` alone has 3 (`?v=1791652024` and 2 others) across one crawl.
- Codes: any.
- Handled by: the same snapshot rule as A5. It also empties the footer, drops the `?v=` stamp from asset links and clears the CSRF token, so a new year or a САЗ deploy does not store every page again.

```html
<script src="/assets/92e1c474/js/app.js?v=1791652024"></script>
<p class="pull-left hidden-xs">© <a href="https://www.ukma.edu.ua/">National University of Kyiv-Mohyla Academy</a> 2026</p>
```

### A7. Empty students list

- Count: 7,461 lists are `[]`: 1,960 recommended bachelor's, 1,236 not-recommended bachelor's and 4,265 master's. On exactly these 7,461 the card has no enrollment block, and no non-empty list lacks it.
- Codes: 208933, 208937, 208938, 208940, 208942.
- Handled by: a parser rule. `[]` is a valid list with no enrollments, not a failure.

```json
[]
```

### A8. A САЗ code belongs to one year

- Count: 0 codes appear in two years; a code is never reused across years.
- Handled by: `offerings.saz_code` is unique. The academic year comes from the card.

### A9. Offerings leave the catalog

- Count: 4 codes of 2026-27 were listed on 2026-10-13 and absent on 2026-10-16. 38 of the 3,055 codes of 2026-27 in Rate UKMA's file (2026-03-26) are not listed (35 bachelor's, 3 master's).
- Codes: 364934, 364942, 364943, 364963 (absent on 2026-10-16); 362950, 363045 (in Rate UKMA only).
- Handled by: rule 4. The offering gets `removed_at` when a run that may remove offerings (rule 6) no longer finds it.

## B. Course card

### B1. Teacher row

- Count: 8,557 of 25,771 cards have a `Викладач` row (2018-19: 34, 2024-25: 1,683). 2,824 list two or more people separated by commas, 94 use a semicolon and 176 add a role after a dash. 24 say `вакансія` and 1 has an empty cell.
- Codes: 209146, 209485, 209495 (row); 277746, 295275 (`вакансія`); 317086 (empty).
- Handled by: `offerings.saz_teachers` keeps the text as read, null when empty. It is a hint for teacher matching (#767), not an instructor link, because it holds initials, not emails. `вакансія` names no person.

```html
<tr><th>Викладач</th><td>Зразок О. П., Приклад І. В.</td></tr>
<tr><th>Викладач</th><td>вакансія</td></tr>
```

### B2. Status label

- Count: `Курс відбувся` 18,063, `Курс не відбувся` 7,024, `Курс можливо відбудеться` 1, none of these 683 (26 of them show only `Практичний`). "Не відбувся" is on 64% of not-recommended bachelor's cards, 31% of master's and 18% of recommended bachelor's.
- Codes: 208941, 209770, 210743 (no label); 211551 (`можливо відбудеться`).
- Handled by: `offerings.status` with `held`, `not_held`, `may_hold` and `unknown`.

```html
<span class="label label-success">Курс відбувся</span>
<span class="label label-default">Курс не відбувся</span>
<span class="label label-info">Курс можливо відбудеться</span>
```

### B3. Practical course label

- Count: 1,114 cards add `Практичний`.
- Codes: 209001, 209005, 209006, 209100, 209104.
- Handled by: `offerings.is_practical`.

```html
<span class="label label-warning">Практичний</span>
```

### B4. Credits and hours

- Count: 1,070 cards have half credits (`4.5 кред.`), 148 have 0 credits and 61 have 0 hours. 286 cards have 20 credits or more, up to 30; 275 of them are master's (a thesis term).
- Codes: 209153, 209181, 209305, 209635, 209925 (0 credits); 210734, 210769 (20 or more).
- Handled by: `offerings.credits` is `numeric(4,1)` and 0 is allowed. Rate UKMA's scraper drops a course with 0 credits and no terms; the parser keeps it.

```html
<span class="label label-default" title="0 кредитів">0 кред.</span>
<span class="label label-default" title="30 кредитів">30 кред.</span>
```

### B5. Term credits do not add up to the card credits

- Count: 60 cards, for example 22.5 on the card and 11 across its terms.
- Codes: 208941, 209023, 209743, 209825, 210145.
- Handled by: both are stored, `offerings.credits` and `offering_terms.credits`, and neither is corrected.

### B6. Offering in several terms

- Count: 1,924 cards have 2 term rows and 471 have 3 (fall, spring and summer).
- Codes: 208930, 208937, 208942 (2 terms); 209023, 209740 (3 terms).
- Handled by: one `offering_terms` row per term (rule 7). Rate UKMA picks its own semester when it syncs; its importer takes the latest term.

```html
<tr><th>Семестри</th><td><span class="label label-default">Семестр 5</span> <span class="label label-default">Семестр 6</span></td></tr>
<tr><th>Осінь</th><td>...</td></tr>
<tr><th>Весна</th><td>...</td></tr>
```

### B7. Card without terms

- Count: 380 cards have no `Деталі по семестрах` block (2019-20: 303; 219 are master's). 1 card has the block and term rows but no `Семестри` row.
- Codes: 209486, 209890, 210410, 210483 (no block); 247004 (no `Семестри` row).
- Handled by: an offering with no `offering_terms` rows is valid and published.

### B8. One term row covers semesters of several study years

- Count: 218 cards list more `Семестр N` labels than term rows, for example `Семестр 5` and `Семестр 7` with one `Осінь` row. 223 cards list semesters of two or more study years. Master's cards use `Семестр 1` to `Семестр 4` only, except one with `Семестр 8д`.
- Codes: 209023, 209027, 209041, 209047, 209050.
- Handled by: `offering_terms.semesters` is an array. Odd semesters are fall, even are spring and `Nд` is summer, and this matched on every card.

```html
<span class="label label-default">Семестр 5</span> <span class="label label-default">Семестр 7</span>
<tr><th>Осінь</th><td>...</td></tr>
```

### B9. Summer term

- Count: 5,124 cards have a `Семестр Nд` label and exactly these 5,124 have a `Літо` row.
- Codes: 208949, 208958, 208967.
- Handled by: `terms.season` = `SUMMER`, referenced by `offering_terms.term_id` `2025-26-SUMMER`.

### B10. Control type of a term

- Count: cards with at least one term of each control: `залік` 17,555, `екзамен` 7,437, `теза` 1,133, `не має контролю` 566, `захист дипломної роботи` 24. A card with two terms can count twice. 6 master's cards of 2026-27 have a term whose control label is empty. On 24,219 cards the lecture, seminar and practice hours are totals for the term, although their `title` says "per week".
- Codes: 209153, 209181 (`не має контролю`); 209573, 211178, 211776 (`захист дипломної роботи`); 363528, 363564, 363568 (empty).
- Handled by: `offering_terms.control` with 5 values, null for an empty label. Rate UKMA's scraper maps every unknown value to an exam, so a thesis term becomes an exam there. The parser reads the label text, never the `title`.

```html
<span class="label label-default" title="3.0 кредитів">3.0 кред.</span>
<span class="label label-default" title="4 годин на тиждень">4 год./тижд.</span>
<span class="label label-default" title="24 годин на тиждень">24 сем.</span>
<span class="label label-default">теза</span>
<span class="label label-default"></span>  <!-- empty control -->
```

### B11. Programmes on the card

- Count: 808 cards have no programmes block (2018-19: 224, 2019-20: 184; 662 are master's). 3,136 list two or more programmes, up to 36. 415 mix two kinds. 1 lists the same row twice.
- Codes: 208940, 208941, 208947 (no block); 317578 (same row twice).
- Handled by: `offering_programmes` with the key (offering, programme). A repeated row collapses into one. The catalog filter gives the programme's level (D12).

```html
<div class="collapse text-justify" id="course-card--900123--spec">
  <table class="table table-bordered table-condensed">
    <tr><td>Економіка</td><td><span class="label label-default">Вільного вибору</span></td></tr>
  </table>
</div>
```

### B12. Unlimited limits

- Count: `необмежено` for the maximum of students on 20,275 cards and of groups on 17,534.
- Codes: 208930, 208933, 208936.
- Handled by: `offerings.max_students` and `max_groups` are null when unlimited.

```html
<tr><th>Максимальна кількість студентів</th><td><span class="label label-success">необмежено</span></td></tr>
```

### B13. Enrollment block

- Count: 7,461 cards have no enrollment block (the empty lists of A7): 1,960 recommended bachelor's, 1,236 not-recommended bachelor's and 4,265 master's. In all 18,310 blocks the label `Кількість затверджених груп` appears twice, with the same value.
- Codes: 208933, 208937 (no block); 208930 (label twice).
- Handled by: `offerings.enrolled_active` is null without the block. The parser reads the first of two equal labels.

### B14. Card count and list disagree

- Count: 18,310 cards have the count; 456 of them are the A2 offerings with no stored list. On 17,343 of the other 17,854 the count equals the list entries with status 10 and an active student; on 511 it does not.
- Codes: 209999, 243788, 260031, 275505, 275560.
- Handled by: both are stored; the list is the source for enrollments and a mismatch fails nothing.

### B15. No annotation

- Count: 8,598 cards have no annotation block (806 of the 1,951 not-recommended bachelor's, 4,533 of the 11,179 master's).
- Codes: 208936, 208937, 208940, 208942, 208946.
- Handled by: `offerings.annotation` is null.

### B16. Title markup

- Count: 239 titles hold an HTML entity (`&quot;`, `&#039;`), 281 a double space, 3,205 end with a note in brackets and 511 hold two languages split by ` / ` (380 of them master's).
- Codes: 208936, 209011 (entity); 209104, 209114 (double space); 241365, 241366 (two languages).
- Handled by: a parser rule. `offerings.title` is unescaped, with whitespace collapsed. The course rule normalises further (C3).

```html
<h1>Теорія умовних прикладів  (англ. мовою) / Theory of Placeholder Examples <small>Перегляд деталей курсу</small></h1>
```

### B17. Fields that never varied

- Count: all 25,771 cards: `Формат 2015`, the year in `Навчальний рік` matches the run and the `Код` cell matches the path. `Освітній рівень` is `Бакалавр` (14,592) or `Магістр` (11,179).
- Handled by: `offerings.level` and `offerings.format` stay fields.

### B18. No faculty and department

- Count: 266 master's cards have neither a `Факультет` nor a `Кафедра` row (2018-19: 140, 2019-20: 124, 2020-21: 2). No card lacks only one of them.
- Codes: 211295, 211296, 211297, 211298, 211300.
- Handled by: `offerings.faculty_id` and `department_id` are null. The course rule treats a missing faculty as a value of its own, so such an offering groups only with others that lack it.

## C. Course identity

### C1. Parallel sections

- Count: 2,055 groups of 2 to 10 codes share title, department and year: 4,707 cards (612 groups are master's). Counted by department; the course rule (C2) uses faculty. Their students lists are often the same: 920 groups of lists, 3,162 pages, have the same content hash.
- Codes: 209027, 209262, 209433, 209590, 210520 (one group).
- Handled by: each code stays its own offering with its own enrollments. The course rule puts them in one course.

### C2. Same course across years

- Count: 5,802 groups by title and department; 4,230 span two or more years and 911 span all nine. 183 title and department pairs exist at both levels.
- Handled by: the first course rule, as in Rate UKMA's importer: title, faculty, programmes and level, so a bachelor's and a master's course with one title stay apart. The counts use title and department, a close stand-in. The САЗ code never links years (A8).

### C3. Titles that differ a little between years

- Count: 242 title groups differ only by a note in brackets at the end, 2 only by letter case.
- Codes: 345718, 345745, 351378, 351381 (one group).
- Handled by: the review case "an offering may belong to an existing course", with a new course as the safe answer. A trailing note can be the language of a separate course, so it is not merged without staff.

```text
Теорія умовних прикладів
Теорія умовних прикладів (англ. мовою)
```

## D. Students lists

Every list is a JSON array of objects with the same 17 keys (575,305 entries).

### D1. `cdoc` is the student's programme record

- Count: `cdoc` never equals the course code. There are 15,821 values; each has one name and one programme. 1,375 emails have 2 to 4 values, most often a bachelor's and a later master's record (1,215 of them), and 1 value has 2 emails.
- Handled by: `student_programmes.saz_cdoc`. A student is a person (email), a programme record is a `cdoc`. When a record shows a new email, the latest list wins: the record moves to the student with that email.

```json
{"cdoc": 600123, "name": "Зразок Олена Петрівна", "email": "o.zrazok@ukma.edu.ua", "specName": "Економіка", "grade": 3}
```

### D2. One student twice in one list

- Count: 220 pairs on 181 pages: the same email with two different `cdoc`, a student on two programmes.
- Codes: 209234, 209348, 209452, 209502, 209530.
- Handled by: `enrollments` is unique on (offering, programme record), not on (offering, student).

### D3. Empty email

- Count: 429 entries on 382 pages belong to 24 programme records. Only 3 of them have an email in another list.
- Codes: 209047, 209052, 209054, 209155, 209169.
- Handled by: `students.email` is nullable; such a student is found by `cdoc`.

```json
{"cdoc": 600124, "name": "Приклад Ігор Васильович", "email": ""}
```

### D4. Email domain cut short

- Count: 52 entries in 2019-20 to 2022-23, all of one programme record, end with `@ukma.edu.u`.
- Codes: 226135, 226137, 226138, 226140, 226185.
- Handled by: stored as read in `students.email`. No list has the full address for that record, so nothing collides; the record links the entries.

### D5. Upper-case email

- Count: 631 entries.
- Codes: 209258, 209265, 209271, 209273, 209285.
- Handled by: `students.email` is stored lower-case; lookups ignore case.

### D6. Name shapes

- Count: three words 571,356 entries, two 2,011, four 1,774, five 164. 248 have extra spaces. 21,241 use a backtick for the apostrophe. 332 entries in 2024-25 to 2026-27 hold `*` inside the name.
- Codes: 314804, 314809, 314810 (`*`); 209057, 209076 (extra space).
- Handled by: `students.full_name` keeps the name with whitespace collapsed. A name with `*` never replaces one without it. `last_name`, `first_name` and `patronymic` are filled only for three words and are null otherwise.

```json
{"name": "Зразок-Приклад Марія"}
{"name": "Зр*зок Олена Петрівна"}
```

### D7. A student's data drifts between lists

- Count: 40 emails appear with two names, 238 names with two emails and 690 emails with two programmes.
- Handled by: a student is found by email, else by `cdoc`, never by name. The latest list sets the name.

### D8. Enrollment status

- Count:

| status | statusLabel | Entries |
| --- | --- | --- |
| 10 | не навчається | 363,712 |
| 10 | записано | 189,592 |
| 10 | примусово | 1,944 |
| -10 | не навчається | 14,791 |
| -10 | виписано | 5,266 |

  "не навчається" means the person is no longer a student, not that they left the course. `isForced` is true on 6,602 entries.
- Handled by: `enrollments.status` is `enrolled` (10) or `unenrolled` (-10). `enrollments.student_state` keeps the label and `is_forced` the flag. Rate UKMA's scraper also counts "не навчається" as enrolled.

```json
{"status": 10, "statusLabel": "не навчається", "isStudentActive": false, "isEnrolled": true, "isUnenrolled": false, "isForced": false}
```

### D9. No group

- Count: `group` is null on 221,751 entries; otherwise 1 to 70.
- Handled by: `enrollments.group_no` is nullable.

### D10. Timestamps

- Count: `createdAt` is 0 on 39,207 entries and `updatedAt` on 34,797, all in 2018-19 and 2019-20. 155 entries in 2021-22 have `updatedAt` before `createdAt`.
- Codes: 258242, 259099, 259783, 259789, 259838 (`updatedAt` first).
- Handled by: `enrollments.saz_created_at` and `saz_updated_at` are null when 0, kept as read otherwise.

### D11. Kind per enrollment

- Count: `mandat` 354,847 entries, `option` 144,993, `zfree` 75,465.
- Handled by: `enrollments.kind` (compulsory, professionally oriented, elective). It is the kind for that student's programme, which can differ from the card's list.

### D12. One programme name at two levels

- Count: cards name 103 programmes: 43 bachelor's and 60 master's. 30 names exist at both levels, so a name alone does not identify a programme. The catalog filter `filter[spec][]` has 100 options, each with its level in brackets, and 23 of its names exist at both levels. 95 of the 103 card programmes have an option. The lists name 61 programmes, all of them also on cards, without a level.
- Codes: any card with a programmes block.
- Handled by: `programmes` is unique on (name, level). A card row takes the level of the catalog filter option of that name, the card's level first; without an option it keeps the level of a stored programme of that name, else takes the card's level. A programme record (`cdoc`) takes the programme of its name on the cards of its offerings, and stays unlinked when those cards name it at both levels. Of the 13,076 records whose name exists at both levels, 13,058 appear on such a card; 121 appear on cards of both levels and 18 on none. Such records stay unlinked (`programme_id` null): 43 in the full parse of #766.

```html
<option value="900">Економіка (Бакалавр)</option>
<option value="901">Економіка (Магістр)</option>
```

### D13. Large lists

- Count: the largest list has 1,367 entries; the longest students page is 541,029 characters.
- Codes: 362858, 314804, 362857.
- Handled by: the API's cursor pagination of enrollments; the parser needs no rule.

## Rate UKMA codes

The spec's done-when asks for every САЗ code that Rate UKMA holds for 2018 to 2025 to exist in the service. Against the pages of runs 15 to 23:

| Years | Rate UKMA codes | Missing | Master's | Bachelor's |
| --- | --- | --- | --- | --- |
| 2018-19 to 2025-26 | 21,188 | 0 | 0 | 0 |
| 2026-27 | 3,055 | 38 | 3 | 35 |

- The first crawl missed 10,602 of the 21,188 codes (A1); the crawl with the catalog fix has a course page for every one of them. The 38 codes of 2026-27 left the catalog after 2026-03-26 (A9).
- 12 codes in the file have no year and no course page. 1 code has another level in the file than on its card.
- 1,566 course pages are not in Rate UKMA (510 recommended bachelor's, 128 not recommended, 928 master's). 717 are cards with no programmes (B11) or no terms (B7): Rate UKMA's scraper selects every option of every filter, and that drops a card with no value for it. Of the other 849, 626 have no status label (B2), and 381 of all 1,566 are 2026-27 courses, many added after 2026-03-26.
