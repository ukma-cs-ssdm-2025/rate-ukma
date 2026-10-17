# UKMA Data conventions

UKMA Data collects NaUKMA data from САЗ and smart.ukma on a schedule and serves it over a keyed HTTP API; Rate UKMA is its first reader. Read [spec.md](../../docs/parser-service/spec.md) for scope and [deployment-infrastructure.md](../../docs/parser-service/deployment-infrastructure.md) for how it runs.

## Run

- Node 24 runs `src/*.ts` directly by type stripping, so dev needs no build: `pnpm api`, `pnpm worker`, `pnpm migrate`, `pnpm reparse`, `pnpm create-key`, `pnpm revoke-key`, `pnpm list-keys`.
- Docker: `docker compose --profile dev` in `src` starts `parser-api` and `parser-worker`; before the worker, `parser-db-init` creates the `ukma_data` database and role and `parser-migrate` applies migrations.
- Settings: `DATABASE_URL` (every command), `PORT` (api, default 8080), and for the worker `CORPORATE_EMAIL` and `CORPORATE_PASSWORD` (the САЗ account), `SAZ_REQUEST_GAP` (default 1 second), `SAZ_REQUEST_TIMEOUT` (default 30 seconds, covering the response body) and `REMOVAL_THRESHOLD` (the share of a year's offerings one run may remove before the removals are held, default 0.05).

## Layout

- `src/main.ts`: the `api`, `worker`, `migrate` and `reparse` commands. `reparse` rebuilds the parsed tables from stored snapshots and sends nothing to САЗ.
- `src/keys/`: API keys, their scopes, and the `create-key`, `revoke-key` and `list-keys` commands. `src/audit/Audit.ts` writes the audit log.
- `src/api/Api.ts` is the endpoint definition; `src/api/http.ts` holds the handlers and the server layer; `src/api/auth.ts` checks the key and scopes and writes one audit row per request whose key exists, a refused one with its reason.
- `src/worker/`: the background loop: crawl, parse, then removals (`src/offerings/removals.ts`).
- `src/changes/ChangeLog.ts`: the writers' turn, change numbers and the `changes` trail.
- `src/db/Database.ts`: the Postgres layer and the migration list; migrations live in `src/db/migrations/`.

## Rules

- Every write to a numbered table (one with `change_no`) runs inside `ChangeLog.withTurn` and takes `nextval('change_no_seq')` only for rows whose content changed; `ChangeLog.track` adds their `changes` rows. `track` requires the `Turn` service, which only `withTurn` provides, and the `require_turn` trigger fails a statement that writes `change_no` without the turn's lock.
- A new migration is added by hand to the `fromRecord` list in `src/db/Database.ts`. Its number only grows: an id at or below the highest applied one is skipped silently.
- The image ships one esbuild bundle (`dist/main.js`), so no code reads files or folders under `src` at runtime.
- `/health` stays keyless and unlogged; Kubernetes probes call it every few seconds.
- Every other endpoint sits in a group with `.middleware(ApiKeyAuth)` and is annotated with `RequiredScopes`; without the annotation it refuses every key. A list handler calls `Caller.countRows`, so the audit row has the count and never the values.
- A write endpoint (start a run, decide a case) records its audit row inside its own transaction, so a failed audit write cannot leave work done behind a 500.
- A token is a `Redacted` value everywhere but the one `create-key` print; never log it.
- The container contract (one image, commands `api`/`worker`/`migrate`/`reparse`/`create-key`/`revoke-key`/`list-keys`, `DATABASE_URL`, `PORT`, the worker's САЗ account, `/health`) is shared with infra. A change to it updates `deployment-infrastructure.md` in the same PR.
- No real student data in fixtures, logs or tests.

## Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `src/parser/node_modules/effect/AGENTS.md` **completely**, and follow the links in the file when required. It and `node_modules/effect/ai-docs` exist only after `pnpm install` in `src/parser`.

If you need to learn more about particular Effect apis and concepts that the guide doesn't cover, search through the source code in `src/parser/node_modules/effect/src`. Effect 4 renamed many v3 APIs, so check names there, not from memory or blog posts.

The personal `effect-ts` and `install-anti-slop` skills are not needed: everything they set up is already in this package.

## Checks

`pnpm check:all` (oxlint, oxfmt, tsc, vitest) is the gate CI runs. The Postgres tests run only when `TEST_DATABASE_URL` names a server where they may create and drop databases, as CI's Postgres service does; without it they skip. The anti-slop lint rules are vendored in `tools/oxlint/anti-slop`; `UPSTREAM.md` there lists the update steps.
