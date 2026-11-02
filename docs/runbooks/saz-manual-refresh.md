# Manual САЗ Refresh

Runbook for refreshing Rate UKMA's courses, offerings, students and enrollments from САЗ through the Django scraper (`src/backend/scraper`). It is the fallback until Rate UKMA syncs from UKMA Data ([ADR-0011](../architecture/decisions/0011-saz-data-service.md)). The last run was on 2026-10-31; its numbers are in [Result of 2026-10-31](#result-of-2026-10-31), and what it taught the parser is in the [САЗ edge cases](../parser-service/edge-cases.md) B19, B20, C4, D14 and D15.

## When to Use

- Students cannot rate a course that САЗ shows they took.
- A new academic year or term opened in САЗ and Rate UKMA does not list its courses.

## Rules

- Ask the owner before any write to staging or live, and again before live.
- Take a `pg_dump` backup on the host before the first write.
- Rehearse every step on a local copy of live first. Run staging, check it, then live.
- The scraped files and the database copy hold student names and emails. Keep them outside the repository, never attach them to an issue or PR, and delete them from the hosts when the run ends.
- The SQL in steps 6 and 9 is specific to the faculty reorganisation and the new specialities of 2026. Before the next run, check what changed in САЗ and write the SQL for that.

## Prerequisites

- `CORPORATE_EMAIL` and `CORPORATE_PASSWORD` of a САЗ account in `src/.env`.
- Redis running for the ingest (`REDIS_HOST`, `docs/onboarding.md` section 3).
- The backend deployed on the target host includes PR #819, which keeps students on a reused email apart (D14). Check the image tag of `rate_ukma_django_backend_release`.
- SSH access to `rate-ukma-staging` and `rate-ukma-live`.

## Steps

### 1. Scrape (local)

Run from `src/backend`. The default files go to `scraper/state/`.

```bash
python manage.py prepare_filtered_url
python manage.py collect_catalog --url "$(cat scraper/state/filtered_catalog_url.txt)"
python manage.py fetch_courses scraper/state/course_ids.jsonl --concurrency 16
```

- `prepare_filtered_url` selects every filter option, both levels and both recommendation values (A1). Check that the years you need are selected.
- `fetch_courses` resumes by default and skips codes already in its output. A run that fails with `ERR_NETWORK_CHANGED` or a timeout leaves gaps: run it again until it reports no failures.
- On 2026-10-31 this gave 24,004 offerings for 2018-19 to 2026-27.

### 2. Split by year and group (local)

The ingest sets a student's level and programme from the offering it processes last (D15), so each year is ingested on its own, oldest first. Split the fetched file by `academic_year` and group each part:

```bash
mkdir -p scraper/state/by_year
for y in 2018 2019 2020 2021 2022 2023 2024 2025 2026; do
  jq -c --arg y "$y" 'select(.academic_year | startswith($y))' scraper/state/courses.jsonl \
    > "scraper/state/by_year/$y.jsonl"
  python manage.py group_courses "scraper/state/by_year/$y.jsonl" \
    --out "scraper/state/by_year/$y.grouped.jsonl" --force
done
```

One run over all years at once gave 497 students another level than the run year by year.

### 3. Find reused emails (local)

САЗ gives a former student's email to a newer one (D14). The ingest before PR #819 merged both people into one student. Delete those merged students before the ingest, so it creates each person again with their own enrollments.

List the emails that the scraped lists show with more than one first name (the second word of `name`, apostrophes unified):

```bash
jq -r '.students[]? | select(.email != "")
       | [(.email | ascii_downcase), (.name | split(" ") | map(select(. != "")) | .[1] // "")]
       | @tsv' scraper/state/courses.jsonl \
  | sed "s/[\`ʼ’]/'/g" | sort -u \
  | awk -F'\t' '{ n[$1]++ } END { for (e in n) if (n[e] > 1) print e }' \
  > reused_emails.txt
wc -l reused_emails.txt
```

Emails where only the surname differs are not in this list: PR #819 treats them as one person who changed surname. On 2026-10-31, 23 emails had different first names and 9 differed only in surname.

### 4. Rehearse on a local copy of live

Restore a dump of live into the local database, then run steps 5 to 9 against it. Take a catalog snapshot before and after, and read the diff:

```bash
python manage.py snapshot_catalog --out before.json
# steps 5 to 9
python manage.py snapshot_catalog --out after.json
python manage.py diff_catalog_snapshots before.json after.json --out catalog-diff.md
```

Expect changed attributes on offerings of past years: САЗ rewrites them (C4). Stop and fix the SQL if the [checks](#10-check) find duplicate courses or specialities without a faculty.

### 5. Backup and counts (host)

```bash
ssh rate-ukma-live "sudo mkdir -p /opt/rateukma/backups && sudo docker exec rate_ukma_postgres \
  pg_dump -U postgres -d rateukma -Fc | sudo tee /opt/rateukma/backups/pre-saz-$(date +%Y%m%d-%H%M).dump > /dev/null"
```

```sql
SELECT 'students', count(*) FROM rating_app_student
UNION ALL SELECT 'enrollments', count(*) FROM rating_app_enrollment
UNION ALL SELECT 'courses', count(*) FROM rating_app_course
UNION ALL SELECT 'ratings', count(*) FROM rating_app_rating;
```

Copy the grouped files, `reused_emails.txt` and the SQL files of steps 6, 7 and 9 to a `chmod 700` folder on the host, then into the backend container (`docker cp`). Copy `reused_emails.txt` into `rate_ukma_postgres` too. Run SQL with `psql -U postgres -d rateukma -v ON_ERROR_STOP=1`.

### 6. Move departments to a new faculty (2026 only)

The ingest finds a department by name and faculty, and a course by title, department and level. In 2026 САЗ moved two departments to a new faculty for every year (C4). Without this step, the ingest created both departments again and 455 duplicate courses.

```sql
BEGIN;
INSERT INTO rating_app_faculty (id, name)
SELECT gen_random_uuid(), 'Факультет міжнародних відносин і врядування'
WHERE NOT EXISTS (SELECT 1 FROM rating_app_faculty WHERE name = 'Факультет міжнародних відносин і врядування');
UPDATE rating_app_department
SET faculty_id = (SELECT id FROM rating_app_faculty WHERE name = 'Факультет міжнародних відносин і врядування')
WHERE name IN (
  'Кафедра міжнародних відносин',
  'Кафедра "Києво-Могилянська школа врядування імені Андрія Мелешевича"'
);
SELECT d.name FROM rating_app_department d JOIN rating_app_faculty f ON f.id = d.faculty_id
WHERE f.name = 'Факультет міжнародних відносин і врядування';
COMMIT;
```

The `SELECT` must list both departments before the ingest.

### 7. Delete the merged students on reused emails

Django's `on_delete=CASCADE` runs only in the ORM. Raw SQL deletes a student's enrollments first. The transaction aborts if any of these students has a rating or a rating vote; then stop and ask the owner. Comments belong to a user, not a student, so they are not touched. A linked account loses its student and gets the right one at its next sign-in.

```sql
BEGIN;
CREATE TEMP TABLE reused_email (email text);
\copy reused_email FROM 'reused_emails.txt'
CREATE TEMP TABLE merged AS
  SELECT s.id FROM rating_app_student s JOIN reused_email r ON r.email = lower(s.email);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM rating_app_rating r JOIN merged m ON m.id = r.student_id)
     OR EXISTS (SELECT 1 FROM rating_app_ratingvote v JOIN merged m ON m.id = v.student_id) THEN
    RAISE EXCEPTION 'merged students have ratings or votes';
  END IF;
END $$;
SELECT count(*) AS merged_students FROM merged;
DELETE FROM rating_app_enrollment WHERE student_id IN (SELECT id FROM merged);
DELETE FROM rating_app_student WHERE id IN (SELECT id FROM merged);
COMMIT;
```

On 2026-10-31, 5 accounts sat on such students, none with ratings, votes or comments.

### 8. Ingest year by year

Oldest to newest, so only newer data overwrites a student's level and programme:

```bash
for y in 2018 2019 2020 2021 2022 2023 2024 2025 2026; do
  docker exec rate_ukma_django_backend_release \
    python manage.py insert_scraped --file "/tmp/saz-refresh/$y.grouped.jsonl" || break
done
```

On live this took 30 minutes for the nine years.

### 9. Fix new specialities, delete empty courses, clear the cache

The scraper sets the faculty of a speciality it has not seen to `""` (B19). Set each from the faculty that owns most of its compulsory courses, not counting language and military departments, and ask the owner where that gives none. The list below is the one of 2026-10-31; find the current ones with the check in step 10.

```sql
BEGIN;
UPDATE rating_app_speciality s SET faculty_id = f.id
FROM (VALUES
  ('Аналітика великих даних', 'Факультет інформатики'),
  ('Економічна дипломатія і GR-політики', 'Києво-Могилянська школа професійної та неперервної освіти'),
  ('Міжнародний бізнес', 'Факультет економічних наук'),
  ('Могилянські культурологічні студії', 'Факультет гуманітарних наук'),
  ('Російські студії: виклики міжнародній безпеці', 'Факультет міжнародних відносин і врядування'),
  ('Українська мова, компаративістика і психолінгвістика', 'Факультет гуманітарних наук'),
  ('Фізика ракетних та аерокосмічних систем', 'Факультет природничих наук'),
  ('Фізика та моделювання аеродинамічних систем', 'Факультет природничих наук'),
  ('Медицина', 'Факультет охорони здоров`я, соціальної роботи і психології')
) AS m(spec, fac)
JOIN rating_app_faculty f ON f.name = m.fac
WHERE s.name = m.spec;
DELETE FROM rating_app_faculty f WHERE f.name = ''
  AND NOT EXISTS (SELECT 1 FROM rating_app_speciality s WHERE s.faculty_id = f.id)
  AND NOT EXISTS (SELECT 1 FROM rating_app_department d WHERE d.faculty_id = f.id);
COMMIT;
```

A course whose offerings all moved to another course is left empty. Delete empty courses through the ORM, so the cascade runs, then clear the cache:

```bash
docker exec rate_ukma_django_backend_release python manage.py shell -c "
from django.db.models import Exists, OuterRef
from rating_app.models import Course, CourseOffering
print(Course.objects.filter(~Exists(CourseOffering.objects.filter(course=OuterRef('pk')))).delete())
"
docker exec rate_ukma_django_backend_release python manage.py manage_cache --clear
```

### 10. Check

Each query returns no rows, then compare the counts of step 5.

```sql
-- duplicate courses
SELECT c.title, d.name AS department, c.education_level, count(*)
FROM rating_app_course c JOIN rating_app_department d ON d.id = c.department_id
GROUP BY 1, 2, 3 HAVING count(*) > 1;

-- courses without offerings
SELECT c.id FROM rating_app_course c
WHERE NOT EXISTS (SELECT 1 FROM rating_app_courseoffering o WHERE o.course_id = c.id);

-- specialities without a faculty
SELECT s.name FROM rating_app_speciality s JOIN rating_app_faculty f ON f.id = s.faculty_id
WHERE f.name = '';
```

Then delete the uploaded files from both containers and the host folder.

## Result of 2026-10-31

The same steps on staging and live, each step exit 0.

- +1,841 students, 1,832 of them starting in 2026 (1,503 bachelor's, 329 master's). 182 new students already had an account and were linked.
- +28,943 enrollments, +214 courses. 888 to 890 existing students changed; 781 moved from bachelor's to master's (D1).
- 549 courses moved to `Факультет міжнародних відносин і врядування`: 352 from the law faculty and 197 from the social sciences faculty (C4).
- 196 offerings moved to another course, 3 of them with ratings; a rating follows its offering. 41 courses were left without offerings, none with ratings, and were deleted.
- 54 term rows disappeared from САЗ, mostly the spring and summer 2027 terms of 2026-27 offerings (B20).
