# UKMA Data conventions

UKMA Data collects NaUKMA data from САЗ and smart.ukma on a schedule and serves it over a keyed HTTP API; Rate UKMA is its first reader. Read [spec.md](../../docs/parser-service/spec.md) for scope and [deployment-infrastructure.md](../../docs/parser-service/deployment-infrastructure.md) for how it runs.

## Run

- Node 24 runs `src/*.ts` directly by type stripping, so dev needs no build: `pnpm api`, `pnpm worker`, `pnpm migrate`.
- Docker: `docker compose --profile dev` in `src` starts `parser-api` and `parser-worker`; before the worker, `parser-db-init` creates the `ukma_data` database and role and `parser-migrate` applies migrations.
- Settings: `DATABASE_URL` (worker and migrate), `PORT` (api, default 8080), and for the worker `CORPORATE_EMAIL` and `CORPORATE_PASSWORD` (the САЗ account), `SAZ_REQUEST_GAP` (default 1 second) and `SAZ_REQUEST_TIMEOUT` (default 30 seconds, covering the response body).

## Layout

- `src/main.ts`: the `api`, `worker` and `migrate` commands.
- `src/api/Api.ts` is the endpoint definition; `src/api/http.ts` holds the handlers and the server layer.
- `src/worker/`: the background loop.
- `src/db/database.ts`: the Postgres layer and the migration list; migrations live in `src/db/migrations/`.

## Rules

- A new migration is added by hand to the `migrations` record in `src/db/database.ts`; `database.test.ts` checks that its keys are `NNNN_name`, unique by number and in order. Its number only grows: an id at or below the highest applied one is skipped silently.
- The image ships one esbuild bundle (`dist/main.js`), so no code reads files or folders under `src` at runtime.
- `/health` stays keyless and unlogged; Kubernetes probes call it every few seconds.
- The container contract (one image, commands `api`/`worker`/`migrate`, `DATABASE_URL`, `PORT`, the worker's САЗ account, `/health`) is shared with infra. A change to it updates `deployment-infrastructure.md` in the same PR.
- No real student data in fixtures, logs or tests.

## Conventions

Some older code predates these rules. Follow the rule, not the neighbouring file, and name the contradiction in the PR.

Files:

- `PascalCase.ts` when the file defines a class or `Context.Service` and is named after it, as `CrawlStore.ts`; `camelCase.ts` for a module of functions, as `snapshot.ts`.
- `<file>.test.ts` sits beside the file it tests, and `<file>.fixture.ts` holds invented data for it.
- `test` appears in a name only for test files; test helpers go in a `testing` module.

Services and errors:

- A service is a `Context.Service` with the id `ukma-data/<module>/<Name>` and a `static readonly layer`. Split out `layerNoDeps` (Effect's name for the layer that still needs its dependencies) only when `layer` wires one beyond `SqlClient`, as `SazClient` does with its HTTP client.
- A failure the caller acts on is a `Schema.TaggedError` in the error channel. A store turns SQL and decode errors into defects with `Effect.orDie`, so its signatures carry only domain errors. A signature keeps `SqlError` only when a caller recovers from it.
- Queries use the `sql` template with `SqlSchema` or a `Schema` decode, and alias snake_case columns to camelCase. A raw string passed to `connection.execute` skips both; only the session lock below needs it.

Database:

- Number a new migration with the next free number at the top of the stack, and renumber it whenever a base branch adds one. Never change a merged migration. Two files with one number make the second one a silent skip on every database that ran the first.
- A migration must work with the image that is still running. Add tables and columns first; drop or rename them in a later PR, after no deployed code reads them (expand, then contract).
- Advisory-lock keys go in `src/db/locks.ts` as named constants. A migration or test that needs a key interpolates the constant, never repeats the number. Prefer `pg_advisory_xact_lock`, which commit releases, as `ChangeLog.withTurn` does. A lock that spans transactions, such as the crawl's, is a session lock: take and release it on one reserved connection, since a pooled query may run on another session.
- A worker step is safe to run twice: queue inserts use `ON CONFLICT`, snapshots dedupe by hash, a crashed run resumes instead of restarting, and `reparse` rebuilds from snapshots. A crash between two statements must not need a manual fix.
- Every request to another system has a timeout and a capped, spaced retry, as `SazClient` has (`SAZ_REQUEST_TIMEOUT`, `SAZ_REQUEST_GAP`). Retry each request step, not a multi-step sign-in around it, and never retry a failed sign-in: each try sends the password again.

Tests:

- Test store SQL against real Postgres with `TestDatabase` (`src/db/testing.ts`), one migrated database per test file. A `Layer.succeed` fake of a store passes with broken SQL, so use one only to test logic above a store that has its own Postgres suite.
- A missing `TEST_DATABASE_URL` always fails the Postgres suites, locally and in CI; they never skip. A green run with skipped suites proves nothing.
- Postgres suites run with `excludeTestServices: true`: under `TestClock` a `Schedule` that polls the database never advances and the test times out. Use `TestClock` for code without a database, as `SazClient.test.ts` does.
- A new test must fail when the code it covers breaks. Break the line, see the test fail, restore it, and say so in the PR. An assertion on a value the fake hard-codes proves nothing.
- The no-real-data rule covers courses and teachers too: names, emails and codes in `<name>.fixture.ts` files are invented, never copied from САЗ or smart.ukma, even trimmed.

Logs and PRs:

- Log annotation keys and fields are snake_case (`run_id`, `source_part`), the same as the columns, so one key finds a run across records. Log a report object under one key instead of spreading its fields.
- Errors and logs carry ids, keys and counts, never personal data. A `CoursePageError` has a short stable `reason` to group by and the page label in `detail`.
- One feature per PR, about 400 changed lines of code at most, not counting tests, fixtures and generated files. Tests ship in the same PR. Split a larger change by layer, such as the pure parser before its persistence.

## Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `src/parser/node_modules/effect/AGENTS.md` **completely**, and follow the links in the file when required. It and `node_modules/effect/ai-docs` exist only after `pnpm install` in `src/parser`.

If you need to learn more about particular Effect apis and concepts that the guide doesn't cover, search through the source code in `src/parser/node_modules/effect/src`. Effect 4 renamed many v3 APIs, so check names there, not from memory or blog posts.

The personal `effect-ts` and `install-anti-slop` skills are not needed: everything they set up is already in this package.

## Checks

`pnpm check:all` (oxlint, oxfmt, tsc, vitest) is the gate CI runs. The Postgres tests always need `TEST_DATABASE_URL`, a server where they may create and drop databases (CI's Postgres service, or locally the docker compose Postgres as the `postgres` user); without it they fail, locally too. The anti-slop lint rules are vendored in `tools/oxlint/anti-slop`; `UPSTREAM.md` there lists the update steps.
