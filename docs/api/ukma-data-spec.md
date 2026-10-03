# UKMA Data: service and public API spec

Draft 0.4, 2026-10-03. Issues: #703 (service), #704 (API). Deployment: [deployment-infrastructure.md](../../infra/deploy/parser/deployment-infrastructure.md) (#705). Slides: [ukma-data deck](../presentations/ukma-data/slides.md).

## Summary

UKMA Data collects NaUKMA data from САЗ (my.ukma.edu.ua) and smart.ukma on a schedule. It serves that data read-only over an HTTP API with keys. Rate UKMA is its first reader.

## Motivation

- Rate UKMA gets its catalog and enrolments from a scraper that a developer runs by hand, 2 to 3 hours each time. The last enrolment import was on 2026-07-05.
- Rate UKMA has no teacher on any offering: the course-instructor table has 0 rows.
- UKMA Schedule already crawls САЗ on its own, and the study-plan constructor and analytics need the same data. One service crawls once for all of them.

## Proposal

### Decisions

| Decision | Why |
| --- | --- |
| Every reader is an ordinary consumer, Rate UKMA included. | No single reader shapes the API. |
| A scheduled worker crawls. Readers never start a crawl. | Load on САЗ does not grow with the number of readers. |
| TypeScript with Effect 4. | One schema gives validation and the OpenAPI file. UKMA Schedule's САЗ crawler already runs on it. |
| Rate UKMA monorepo, own folder, own database (#703). | Shared context and CI. HTTP is the only link to Rate UKMA. |
| Kubernetes on Hetzner through Terraform (#705). | See the deployment spec. |
| A subdomain of rateukma.com, `data.rateukma.com` (name proposed, #703). | `rateukma.com/api/` is already Rate UKMA's own API. |
| Only admins create keys; scopes have three tiers (#703). | Nobody has asked for self-service keys yet. |
| smart.ukma: sign in as for САЗ, then call its API with the page's token. | The same sign-in we already run for САЗ. |
| The service groups offerings into courses across years. | Every reader needs the same course identity. |

### Glossary

- **САЗ**: my.ukma.edu.ua, where students register for courses.
- **Offering**: one САЗ course card, that is, one course in one academic year. It runs in one or more terms.
- **Term**: one season of one academic year, written `2026-27-FALL`. Both years are in the id because САЗ and Rate UKMA count years differently.
- **Course**: the offerings of one subject across years.
- **Programme**: a study programme that an offering counts for, as compulsory, professionally oriented or elective.
- **Instructor**: a teacher from smart.ukma, linked to offerings.
- **Enrolment**: one student on one offering, with a status.
- **Run**: one pass of the worker over one part of a source.
- **Raw page**: a page or API response exactly as the source returned it.
- **Override**: an admin decision on grouping or teacher links, stored as its own row.

### Rules

1. Ids are ours and permanent: a type prefix plus a time-ordered id (`off_01k6...`). Source ids, like the САЗ code, are only lookup keys.
2. The worker stores each raw page first, only when its hash changed, and parses the stored copy. A parser fix or a new field re-parses stored pages and sends no request to the source.
3. Nothing is deleted. A row that leaves its source is marked as removed.
4. Every change goes into a change log. Readers sync from it, and it includes removals.
5. A run that looks broken is held for an admin and not published. Example: it sees far fewer offerings than the last run.
6. An offering's terms are the truth. An offering has no single "semester".
7. Course groups and teacher links are computed from stored fields plus overrides. Each offering keeps its own title, department and level, so a new rule is a recompute, not a crawl.
8. Course grouping starts from Rate UKMA's current courses. The service never moves an offering to another course on its own: a recompute that would move one becomes a proposal for an admin. Merges and splits appear in the change log.
9. Adding a source needs no change to the database schema.

### API

Read-only JSON under `/v1`. The OpenAPI file is generated from the code and is the contract; a breaking change needs `/v2`.

| Request | Returns | Tier |
| --- | --- | --- |
| `GET /v1/terms`, `/faculties`, `/departments`, `/programmes` | reference lists | open |
| `GET /v1/courses`, `/v1/courses/{id}` | courses with their offerings by year | open |
| `GET /v1/offerings?term=&programme=&sazCode=`, `/v1/offerings/{id}` | offerings with terms and programmes | open |
| `GET /v1/instructors`, `/v1/offerings/{id}/instructors` | teachers and who teaches what | open |
| `GET /v1/enrollments?email=` | enrolments of one student | restricted |
| `GET /v1/changes?after=<seq>` | change log, filtered by the key's scopes | open |
| `GET /v1/runs` | runs and data freshness | open |

Lists use cursor pagination. Every response says when its data was last updated.

### Access and personal data

- A key is sent in a header, shown once, stored as a hash, has an expiry date and can be revoked.
- Scope tiers. Open: catalog, teachers, runs. Restricted: enrolments, teacher emails. Admin: keys, audit log, starting a run.
- The audit log records key changes, runs started by hand, overrides and every restricted read. It never stores data values.
- Enrolments keep student email and status only. The parser drops names before anything is stored, so rosters are the one exception to rule 2.
- Raw pages stay internal: the API never serves them.
- No real student data in fixtures, logs, screenshots or issues.
- An admin page shows runs, their changes, keys and the audit log.

## Acceptance criteria

- [ ] A key with the catalog scope reads `/v1/offerings`; a key without it gets 403.
- [ ] Every САЗ code that Rate UKMA holds for 2018 to 2025 exists in the service.
- [ ] A run that sees less than 80% of the previous run's offerings is held and changes nothing.
- [ ] Re-parsing every stored САЗ page sends no request to САЗ.
- [ ] Recomputing course groups keeps every admin override.
- [ ] `/v1/changes` returns additions, changes and removals in order.
- [ ] No student name is stored: a test feeds a roster fixture and checks the database.
- [ ] Rate UKMA data is less than one day old, and `src/backend/scraper` is deleted.
- [ ] Some 2026-27 offerings in Rate UKMA have a teacher (today: none).

## Out of scope

Keys that students create, Microsoft sign-in for a key portal, schedule files, write endpoints, live seat counts.

## Open questions

1. Enrolments: lookup by student email only (proposed), or also a full list?
2. Roster data: who at the university approves storing it, how long we keep it, who runs the service after the course?
3. Can the worker sign in without a person (MFA, session and token lifetime)?
4. Can smart.ukma join САЗ by `optimaCode` instead of by title?
