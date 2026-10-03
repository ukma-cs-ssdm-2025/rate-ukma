# UKMA Data

UKMA Data collects NaUKMA data from САЗ and smart.ukma on a schedule and serves it read-only over an HTTP API with keys. Rate UKMA is its first reader.

## Motivation

- Rate UKMA already parses course cards, terms, rosters and course history since 2018, but a developer runs that scraper by hand for 2 to 3 hours. The last enrolment import was on 2026-07-05.
- Rate UKMA has no teacher on any offering: its course-instructor table is empty.
- UKMA Schedule crawls the same САЗ pages every hour on its own. One service can crawl once for both.

## Decisions

| Area | Decision | Why |
| --- | --- | --- |
| Readers | Every reader is an ordinary consumer, Rate UKMA included. | No single reader shapes the API. |
| | Rate UKMA keeps a full copy and syncs once a day. | A student who signs in for the first time is already in Rate UKMA, and Rate UKMA works when the service is down. |
| Data | Keep every year that САЗ shows, and students with full name and email. | Rate UKMA shows student names today. |
| | Group offerings into courses across years. | Every reader needs the same course identity. |
| | Link smart.ukma teachers to offerings by title, department, term and credits. Admins fix the rest. | `optimaCode` cannot join the two sources. |
| Crawling | A scheduled worker crawls. A key with `runs:trigger` can ask for an extra run. | Load on САЗ does not grow with the number of readers. |
| | The worker signs in with a team member's own account. | There is no service account yet. |
| Access | Every request needs a key, and every endpoint needs a scope. A new key gets the scopes without personal data. | One check for every endpoint, and personal data only for keys that ask for it. |
| | Scopes sit on the key. No roles. | With a few keys, roles add a second concept. |
| | Only admins create keys. | Nobody has asked for self-service keys. |
| Build | TypeScript with Effect 4. | One schema gives validation and the OpenAPI file. UKMA Schedule's САЗ crawler already runs on it. |
| | Admin pages are HTML from the same server, with htmx for actions. | No second frontend to build and deploy. |
| Hosting | Rate UKMA monorepo, own folder and own database. | Shared context and CI. HTTP is the only link to Rate UKMA. |
| | Kubernetes on Hetzner through Terraform. | Rate UKMA already runs on Hetzner with Terraform. |
| | `data.rateukma.com` | `rateukma.com/api/` is already Rate UKMA's API. |

## Glossary

- **САЗ**: my.ukma.edu.ua, where students register for courses.
- **smart.ukma**: smart.ukma.edu.ua, the university system that lists teachers and their disciplines.
- **Course page**: the САЗ page `/course/{id}`. It shows the card and loads the roster from `/course/{id}/students`.
- **Offering**: one САЗ course card, that is, one course in one academic year. It runs in one or more terms.
- **Term**: one season of one academic year, written `2026-27-FALL`. Both years are in the id because САЗ and Rate UKMA count years differently.
- **Course**: the offerings of one subject across years.
- **Programme**: a study programme that an offering counts for, as compulsory, professionally oriented or elective.
- **Instructor**: a teacher from smart.ukma.
- **Student**: a person from САЗ rosters, with email, last name, first name, patronymic and programme.
- **Enrolment**: one student on one offering, with a status and a group.
- **Run**: one pass of the worker over one part of a source, for example САЗ courses of 2026-27.
- **Page snapshot**: every field of an HTML page as text, or a JSON response as it came.
- **Override**: an admin decision on grouping or teacher links, stored as its own row.
- **Scope**: one permission on a key, for example `students:read`.

## Rules

1. Ids are ours and permanent: a type prefix plus a time-ordered id (`off_01k6...`). Source ids, like the САЗ code, are only lookup keys.
2. The worker stores a page snapshot when its hash changes, then parses the snapshot. A parser fix re-parses stored snapshots and sends no request to the source. Raw HTML is kept only when a snapshot fails: САЗ puts a new security token into every response, so raw HTML never hashes the same.
3. A run visits each course page once and fetches its card and roster together.
4. Nothing is deleted. A row that leaves its source gets `removedAt`.
5. Every row has `updatedAt`, and readers sync by asking for rows updated after their last sync, removals included. Runs apply their changes one at a time, so a reader never misses a row.
6. A run that looks broken, for example one that sees far fewer offerings than the last run, is held for an admin and not published.
7. An offering's terms are the truth. An offering has no single "semester".
8. Course groups and teacher links are computed from stored fields plus overrides, so a new rule is a recompute, not a crawl.
9. Course grouping starts from Rate UKMA's current courses. A recompute that would move an offering to another course becomes a proposal for an admin.
10. Each run records what it changed, and the admin pages show it.
11. Adding a source needs no change to the database schema.

## API

JSON under `/v1`, read-only except `POST /v1/runs`. The OpenAPI file is generated from the code and is the contract. A breaking change needs `/v2`.

| Request | Returns | Scope |
| --- | --- | --- |
| `GET /v1/terms`, `/v1/faculties`, `/v1/departments`, `/v1/programmes` | reference lists | `catalog:read` |
| `GET /v1/courses`, `/v1/courses/{id}` | courses with their offerings | `catalog:read` |
| `GET /v1/offerings?term=&programme=&sazCode=`, `/v1/offerings/{id}` | offerings with terms and programmes | `catalog:read` |
| `GET /v1/instructors?offering=`, `/v1/instructors/{id}` | teachers with emails and what they teach | `instructors:read` |
| `GET /v1/students?email=`, `/v1/students/{id}` | students with full name and email | `students:read` |
| `GET /v1/enrollments?offering=&student=` | enrolments | `students:read` |
| `GET /v1/runs` | runs and data freshness | `runs:read` |
| `POST /v1/runs` | an extra run of one source part | `runs:trigger` |

Every list takes `updatedAfter=` and uses cursor pagination. Every response says when its data was last updated.

## Access and personal data

- A key goes in a header. It is shown once, stored as a hash, expires and can be revoked.
- An admin picks the scopes when creating a key. To change them, issue a new key and revoke the old one.

| Scope | Gives | Default |
| --- | --- | --- |
| `catalog:read` | terms, faculties, departments, programmes, courses, offerings | yes |
| `runs:read` | runs and data freshness | yes |
| `instructors:read` | teachers, their emails, what they teach | no |
| `students:read` | students and enrolments | no |
| `runs:trigger` | `POST /v1/runs` | no |
| `admin` | admin pages: keys, audit log, overrides, page snapshots. Includes every other scope. | no |

- Example keys: Rate UKMA has the defaults plus `instructors:read`, `students:read` and `runs:trigger`. UKMA Schedule has the defaults plus `students:read`. A team member has `admin`.
- The audit log records key changes, extra runs, overrides and every read that needs `students:read`. It stores no data values.
- Only `admin` sees page snapshots, because roster snapshots carry student names.
- No real student data in fixtures, logs, screenshots or issues.
- Admin pages HTML-escape every value.

## Acceptance criteria

- [ ] Every endpoint returns 403 to a key without its scope, and the 403 names that scope. A new key reads `/v1/offerings` but not `/v1/students`.
- [ ] A key without `students:read` gets no student name or email from any endpoint.
- [ ] Every САЗ code that Rate UKMA holds for 2018 to 2025 exists in the service.
- [ ] A run that sees less than 80% of the previous run's offerings is held and changes nothing.
- [ ] Re-parsing every stored snapshot sends no request to САЗ.
- [ ] Recomputing course groups keeps every admin override.
- [ ] A list read with `updatedAfter` returns every row added, changed or removed since then.
- [ ] A `POST /v1/runs` for a part that already has a queued run returns that run.
- [ ] Rate UKMA data is less than one day old, Rate UKMA works with the service stopped, and `src/backend/scraper` is deleted.
- [ ] Some 2026-27 offerings in Rate UKMA have a teacher.

## Out of scope

Keys that students create, a sign-in page for keys, a separate change feed, САЗ schedule files, write endpoints other than an extra run, live seat counts.
