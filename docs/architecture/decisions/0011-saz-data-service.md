# ADR-0011: САЗ Data Through a Separate UKMA Data Service

## Status

Proposed

## Date

2026-10-29

## Context

Rate UKMA takes courses, terms and enrollments from САЗ through the Django `src/backend/scraper` app. A developer runs it by hand for 2 to 3 hours. The last enrollment import was on 2026-07-05. The MVP enabler stories need this data to stay fresh on its own and need bad runs to be caught.

**Forces:**

- **Scheduled refresh** ([US-E.1](../../requirements/story_mapping_scope.md)): course, term and enrollment data refreshed every day without manual work (BR-15). After an update, a student can rate a course that САЗ now shows they took (BR-16).
- **A broken crawl must not be silent** (US-E.2): the maintainer is alerted when a run fails or brings far fewer courses than last time (BR-17). A normal run raises no alert (PR-07).
- **Bad data must not reach students** (US-E.3): each run has a summary of new, changed and removed courses (BR-18). A course that leaves САЗ is marked "gone from САЗ", never deleted, and its ratings stay visible (BR-19, PR-06).
- **САЗ is fragile.** Its pages change shape, it rate-limits with 429 responses, and a crawl can stop half-way. A partial crawl must not look like "these courses were removed".
- **Conflicts with existing ADRs.** The parser work (#759–#763, #767, [spec](../../parser-service/spec.md), [schema](../../parser-service/schema.md)) builds a separate TypeScript/Effect service, `src/parser`, with its own Postgres 18. This is an exception to [ADR-0001](./0001-n-tier-arch.md), which has a single Django deployable, and to [ADR-0003](./0003-tech-stack.md), which picks Django. The planned hosting on Kubernetes on Hetzner (#769–#772, [deployment](../../parser-service/deployment-infrastructure.md)) is outside the MVP's local-only, zero-budget limit.

## Decision

We will take САЗ data from a separate UKMA Data service, and Rate UKMA will keep its own copy, synced once a day by change number.

1. **Store raw pages first, parse later.** A crawl only saves page snapshots. Parsing reads snapshots into the service's own tables (offerings, terms, programmes, enrollments).
2. **Every change gets a number** from one counter, and writes take turns. Rate UKMA saves the last number per list and asks for rows above it. It never syncs by time.
3. **Nothing is deleted.** A row that leaves САЗ gets `removed_at` and keeps its id. Removals happen only after a complete, consistent crawl. A run that would remove more than 5% of a year's offerings holds those removals as a `removals_held` review case for staff.
4. **HTTP with keys is the only link.** Rate UKMA reads the service's `/v1` API with a scoped key, never its database. Rate UKMA never crawls САЗ itself.
5. **Sentry** reports failed runs, failed sign-ins and pages that fail to parse.
6. **For the MVP the service runs locally** in `src/docker-compose.yml` (`parser-api`, `parser-migrate`, its own database). Production hosting is a separate decision.

## Consequences

* ✅ US-E.3 and PR-06 follow from the service rules: soft delete, removals only after a full crawl, large removals held for review.
* ✅ A parser fix reparses stored snapshots without new requests to САЗ, and a crashed crawl resumes where it stopped.
* ✅ Rate UKMA keeps working when the service is down. Its data only gets older.
* ✅ US-E.2 alerts come from Sentry, which Rate UKMA already uses.
* ⚠️ Rate UKMA needs a sync importer. It maps service ids (`off_…`) and term ids (`2026-27-FALL`) to `Course`, `CourseOffering` and `Enrollment`, saves the last change number for each list, and marks courses "gone from САЗ" instead of deleting them.
* ⚠️ `src/backend/scraper` can be deleted only after the importer works.
* ❌ Two stacks (Python and TypeScript), two databases and two migration sets for a 5-person team.
* ❌ Debugging a data issue now crosses an HTTP boundary.
* ❌ Production hosting (k3s on Hetzner) costs money and needs its own ADR before it goes live.

## Considered Alternatives

1. **Extend the Django `scraper` app with a scheduled management command that writes straight into `rating_app` tables.**
   - Pros: no new service, language or database; stays inside ADR-0001 and ADR-0003.
   - Cons: a partial crawl can overwrite or drop live `CourseOffering` rows; no stored pages, so a parser fix needs a new 2–3 h crawl; other readers (UKMA Schedule) still crawl САЗ on their own.
   - Rejection Reason: nothing stands between a bad crawl and what students see, which is the core of US-E.3.

2. **The same service, but Rate UKMA reads its database directly.**
   - Pros: no API or sync importer to write.
   - Cons: couples two schemas, so a migration in one breaks the other; no scopes protecting student personal data; Rate UKMA stops working when the service's database is down.
   - Rejection Reason: removes the HTTP boundary that keeps both sides independent and keeps personal data behind scoped keys.
