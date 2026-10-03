# UKMA Data: service and public API spec

Draft 0.6, 2026-10-03. Issues: #703 (service), #704 (API), #705 (deployment). Deployment: [deployment-infrastructure.md](deployment-infrastructure.md). Slides: [ukma-data deck](../presentations/ukma-data/slides.md).

## Summary

UKMA Data collects NaUKMA data from САЗ and smart.ukma on a schedule. It serves that data read-only over an HTTP API with keys. Rate UKMA is its first reader.

## Motivation

- Rate UKMA already parses course cards, their terms, rosters and course history since 2018. A developer runs that scraper by hand, 2 to 3 hours each time, and the last enrolment import was on 2026-07-05.
- Rate UKMA has no teacher on any offering: the course-instructor table has 0 rows.
- UKMA Schedule crawls the same САЗ pages on its own, and the study-plan constructor and analytics need the same data but have nowhere to read it. One service crawls once for all of them.

## Proposal

### Decisions

| Decision | Why |
| --- | --- |
| Every reader is an ordinary consumer, Rate UKMA included. | No single reader shapes the API. |
| A scheduled worker crawls. A key with the `runs:trigger` scope can ask for an extra run, which should be rare. | Load on САЗ does not grow with the number of readers. |
| Rate UKMA keeps a full copy and syncs from the change log once a day. | A student who signs in for the first time is already in its database, and Rate UKMA keeps working when the service is down. |
| The service keeps every year that САЗ shows, and students with full name and email. | Rate UKMA shows student names today. |
| TypeScript with Effect 4. | One schema gives validation and the OpenAPI file. UKMA Schedule's САЗ crawler already runs on it. |
| Rate UKMA monorepo, own folder, own database (#703). | Shared context and CI. HTTP is the only link to Rate UKMA. |
| Kubernetes on Hetzner through Terraform (#705). | See the deployment spec. |
| A subdomain of rateukma.com, `data.rateukma.com` (name proposed, #703). | `rateukma.com/api/` is already Rate UKMA's own API. |
| Access is role-based: a key has one role, a role is a set of scopes, and the code checks scopes only (#703). | A new reader gets an existing role, and a new role needs no new checks in the code. |
| Only admins create keys, and every request needs a key. Which reads become public without a key is decided later. | Nobody has asked for self-service keys or public reads yet. |
| The worker signs in to САЗ and smart.ukma with a team member's own account. | There is no service account yet; one replaces it later. |
| smart.ukma teachers are linked to САЗ offerings by title, department, term and credits, and admins fix the rest. | `optimaCode` cannot join the two sources. |
| The service groups offerings into courses across years. | Every reader needs the same course identity. |
| Admin pages are HTML rendered by the same Effect server, with htmx for actions. | No second frontend to build and deploy. |

### Glossary

- **САЗ**: my.ukma.edu.ua, where students register for courses.
- **smart.ukma**: smart.ukma.edu.ua, the university system that lists teachers and the disciplines they teach.
- **Course page**: one САЗ page, `/course/{id}`. It shows the card and loads the roster from `/course/{id}/students`.
- **Offering**: one САЗ course card, that is, one course in one academic year. It runs in one or more terms.
- **Term**: one season of one academic year, written `2026-27-FALL`. Both years are in the id because САЗ and Rate UKMA count years differently.
- **Course**: the offerings of one subject across years.
- **Programme**: a study programme that an offering counts for, as compulsory, professionally oriented or elective.
- **Instructor**: a teacher from smart.ukma, linked to offerings.
- **Student**: a person from САЗ rosters, with email, last name, first name, patronymic and programme.
- **Enrolment**: one student on one offering, with a status and a group.
- **Run**: one pass of the worker over one part of a source, for example САЗ courses of 2026-27.
- **Page snapshot**: every field of an HTML page as text, without interpretation, or a JSON response as it came.
- **Override**: an admin decision on grouping or teacher links, stored as its own row.
- **Scope**: one permission, written `resource:action`, for example `students:read`.
- **Role**: a named set of scopes. Each key has exactly one role.

### Rules

1. Ids are ours and permanent: a type prefix plus a time-ordered id (`off_01k6...`). Source ids, like the САЗ code, are only lookup keys.
2. The worker stores a page snapshot first, only when its hash changed, and parses the stored snapshot. A parser fix or a new field re-parses snapshots and sends no request to the source. Raw HTML is kept only when the snapshot step fails, because САЗ puts a new security token into every response, so raw HTML never hashes the same.
3. A run visits each course page once and fetches its card and its roster together.
4. Nothing is deleted. A row that leaves its source is marked as removed.
5. Every change goes into a change log. Readers sync from it, and it includes removals.
6. A run that looks broken is held for an admin and not published. Example: it sees far fewer offerings than the last run.
7. An offering's terms are the truth. An offering has no single "semester".
8. Course groups and teacher links are computed from stored fields plus overrides. Each offering keeps its own title, department and level, so a new rule is a recompute, not a crawl.
9. Course grouping starts from Rate UKMA's current courses. The service never moves an offering to another course on its own: a recompute that would move one becomes a proposal for an admin. Merges and splits appear in the change log.
10. Adding a source needs no change to the database schema.

### API

JSON under `/v1`, read-only except `POST /v1/runs`. The OpenAPI file is generated from the code and is the contract; a breaking change needs `/v2`.

| Request | Returns | Scope |
| --- | --- | --- |
| `GET /v1/terms`, `/faculties`, `/departments`, `/programmes` | reference lists | `catalog:read` |
| `GET /v1/courses`, `/v1/courses/{id}` | courses with their offerings by year | `catalog:read` |
| `GET /v1/offerings?term=&programme=&sazCode=`, `/v1/offerings/{id}` | offerings with terms and programmes | `catalog:read` |
| `GET /v1/instructors`, `/v1/offerings/{id}/instructors` | teachers, their emails, and who teaches what | `instructors:read` |
| `GET /v1/students?email=`, `/v1/students/{id}` | students with full name and email | `students:read` |
| `GET /v1/enrollments?offering=&student=` | enrolments, all or filtered | `students:read` |
| `GET /v1/changes?after=<seq>` | change log, only entities the key's scopes can read | any |
| `GET /v1/runs` | runs and data freshness | `runs:read` |
| `POST /v1/runs` | an extra run of one source part | `runs:trigger` |

Lists use cursor pagination. Every response says when its data was last updated.

### Access and personal data

- A key is sent in a header, shown once, stored as a hash, has an expiry date and can be revoked.
- Roles live in the code. Changing a role is a reviewed PR and applies to all its keys at once.

| Role | Scopes | For |
| --- | --- | --- |
| `reader` | `catalog:read`, `instructors:read`, `runs:read` | other projects |
| `sync` | the `reader` scopes, `students:read`, `runs:trigger` | Rate UKMA |
| `admin` | every scope, also `keys:manage`, `audit:read`, `overrides:write`, `snapshots:read` | the team |

- The audit log records key changes, extra runs, overrides and every read that needs `students:read`. It never stores data values.
- Page snapshots stay internal: only `snapshots:read` sees them, because roster snapshots carry student names.
- No real student data in fixtures, logs, screenshots or issues.
- Admin pages show runs, their changes, keys and the audit log. Every value in them is HTML-escaped.

## Acceptance criteria

- [ ] A `reader` key reads `/v1/offerings` and gets 403 on `/v1/students`; the 403 names the missing scope.
- [ ] A key without `students:read` gets no student name or email from any endpoint, `/v1/changes` included.
- [ ] Every САЗ code that Rate UKMA holds for 2018 to 2025 exists in the service.
- [ ] A run that sees less than 80% of the previous run's offerings is held and changes nothing.
- [ ] Re-parsing every stored САЗ snapshot sends no request to САЗ.
- [ ] Recomputing course groups keeps every admin override.
- [ ] `/v1/changes` returns additions, changes and removals in order.
- [ ] A `POST /v1/runs` for a part that already has a queued run returns that run.
- [ ] Rate UKMA data is less than one day old, Rate UKMA works with the service stopped, and `src/backend/scraper` is deleted.
- [ ] Some 2026-27 offerings in Rate UKMA have a teacher (today: none).

## Out of scope

Keys that students create, Microsoft sign-in for a key portal, schedule files, write endpoints other than an extra run, live seat counts.
