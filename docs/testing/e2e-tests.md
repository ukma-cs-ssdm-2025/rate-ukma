# E2E Testing Strategy

## Purpose

Playwright E2E tests exist to validate critical user journeys in a browser with production-like behavior.

In this project we do **not** have a seeded database for E2E for now, since seeding adds too much complexity. Tests must be written to tolerate real, changing data.

## What belongs in E2E

- Cross-page user flows that validate app wiring (routing, auth state, navigation).
- URL/search-param behavior that users rely on (shareable links, back/forward, reload persistence).
- Mutating flows that can create and then clean up their own data (idempotent or self-contained).

## What does not belong in E2E

- Asserting backend request shapes (query param names, payload fields). This is an implementation detail and should be covered by unit/integration tests.
  - Example: courses filters → API params mapping is covered in `src/webapp/src/features/courses/filterTransformations.test.ts`.
- Mocked API/network error scenarios (500/timeout/empty responses). These are valuable, but should live in frontend unit/integration tests (Vitest) where they are deterministic.
- Fine-grained UI rendering details that are already covered by component tests (Vitest + Testing Library).

## Rules for real-data E2E (no seeded DB)

- Avoid hard assertions about exact counts or specific records existing.
  - Prefer: “query param updated”, “UI didn’t crash”, “either results or empty state is shown”.
- Generate unique test artifacts when writing data (e.g. unique comment text) and always attempt cleanup.
- If a test requires a precondition that may not exist in real data, prefer making the test self-contained (create the thing), otherwise `test.skip` with a clear reason.

## Selector rules

- Prefer stable `data-testid` selectors via `src/webapp/src/lib/test-ids.ts`.
- Avoid brittle selectors (DOM structure, Radix internal attributes, localized text matching when possible).

## Test structure

Current structure is feature-based and colocated:

- `src/webapp/tests/e2e/framework/` – shared Playwright helpers and config
- `src/webapp/tests/e2e/shared/` – shared page pieces used across features
- `src/webapp/tests/e2e/courses/` – courses specs + page models + fixtures
- `src/webapp/tests/e2e/ratings/` – ratings specs + page models

Specs are named `*.spec.ts`.

Playwright projects:

- `login` – performs Microsoft login and writes `playwright/.auth/microsoft.json`
- `chromium-auth` – runs authenticated tests using the stored session state

## Running E2E tests locally

### Prerequisites

1. Start the webapp at `http://localhost:3000` (or set `BASE_URL`).
2. Provide Microsoft auth credentials (for the `login` project):

```bash
export CORPORATE_EMAIL="your-email@domain.com"
export CORPORATE_PASSWORD="your-password"
# optional
export BASE_URL="http://localhost:3000"
```

Note: `pnpm test:e2e` is configured to load env from `../.env` via `dotenv`, so you can also put these variables there.

### Commands

```bash
# run all e2e
pnpm -C src/webapp test:e2e

# run a single spec
pnpm -C src/webapp test:e2e -- tests/e2e/courses/search.spec.ts

# headed mode
pnpm -C src/webapp test:e2e -- --headed

# run only authenticated project
pnpm -C src/webapp test:e2e -- --project=chromium-auth
```

## When to add Vitest tests instead

Add or extend Vitest tests for:

- Error and retry UI states (rendering + callbacks).
- Route-level logic that chooses between error state vs table.
- Mapping/query-string transformations and API param construction.

This keeps Playwright E2E focused, stable, and black-box oriented.
