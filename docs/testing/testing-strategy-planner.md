# Testing Strategy: ІНП planner

The planner-specific addition to [testing-strategy.md](testing-strategy.md). Conventions are not repeated: backend in [backend-tests.md](backend-tests.md), Playwright in [e2e-tests.md](e2e-tests.md). Scenarios come from [acceptance_criteria_gherkin.md](../requirements/acceptance_criteria_gherkin.md); tests are derived from them, never from the code under test. Status below is read from test names and bodies, not from a coverage tool; anything not read is `unverified`.

## 1. Scope

### Automated

| Story | Rule | Level |
| --- | --- | --- |
| US-5.1 | Add a course to a chosen year and term; a multi-term course lands in every term | API (`views/test_personal_plan.py`) |
| US-5.1 | The course page says a course is already planned, with its year and semester; hidden for non-students and with the flag off | Unit (`planTimeline.test.ts`); component (`AddToPlanButton.test.tsx`) |
| US-5.9 | Plan grouped by year and semester; mandatory and taken courses present without picks | API, service (`test_personal_plan_service.py`) |
| US-5.2 | A pick, even the only one of a semester, can be a backup; backups stay out of every total | API; unit (`planRules.test.ts`); component |
| US-5.10a | Remove a pick; mandatory and already taken courses cannot be removed (409); multi-term removal | API; component (`PlanSemesterGrid.test.tsx`) |
| US-5.10b | Promote a backup to main (a move from `BACKUP` to `MAIN`) | API; component |
| US-6.3 | Credits by course kind against 240 / ≥54 / ≤25, at and around each boundary | Unit, component (`planRules`, `PlanCreditsSummary.test.tsx`) |
| all | Anonymous 403, non-student 403, malformed id 400, unknown id 404, another student's plan hidden, cache refresh after a write | API |

### Scenario status

| Gherkin | Status |
| --- | --- |
| US-5.1 add, year decides the term, multi-term | covered |
| US-5.1 "already in plan" message | covered (`AddToPlanButton.test.tsx`). The app says "У вашому ІНП", the Gherkin says "Ваш курс вже додано в ІНП": the test follows the app, the wording is to be aligned |
| US-5.9 grouping, first visit | covered |
| US-5.9 exact decimal sums (3.5 + 2.5), empty semester shown with 0 credits | covered (`planRules.test.ts`, `PlanSemesterGrid.test.tsx`) |
| US-5.2 mark backup, backups not counted | covered |
| US-5.2 only course in a semester is a backup | covered (API, `planRules`, grid) |
| US-5.10a remove, mandatory refused, multi-term | covered |
| US-5.10b promote | covered |
| US-5.10b promotion above the year range warns but is allowed | not covered (no yearly range in the UI, see below) |
| US-6.1 yearly range 58–62, boundaries, decimals, summer | **not implemented**: the planner has no yearly-range constant or check |
| US-6.2 weekly hours limit 24 | **not implemented**: weekly hours are shown and `sumWeeklyHours` exists, but no limit is applied |
| US-6.3 programme limits | covered, with boundaries 53.5 / 54, 25 / 25.5, 239.5 / 240.5 (`PlanCreditsSummary.test.tsx`) |
| End-to-end add and remove on `/plan` | written (`tests/e2e/personal-plan/plan.spec.ts`), not yet run: it needs a Microsoft session |

### Manual on purpose

| Check | Why not automated |
| --- | --- |
| Layout, spacing, phone width, dark theme of the plan grid | No visual baseline; contrast alone is tested (`theme-contrast.test.ts`) |
| Real Microsoft sign-in | External IdP; Playwright reuses a stored session |
| Plan built from real САЗ data | Personal data; the source changes under us |
| PostgreSQL-only behaviour | Tests run on in-memory SQLite |
| Keyboard use and screen readers | No automated a11y check in the repo |

## 2. Tools and levels

| Rule type | Tool | Why |
| --- | --- | --- |
| Permissions, mandatory-course and taken-course refusals, status codes, cache | `pytest` over the endpoint with a real database | The risk is in the query and the entitlement, which a mock would hide |
| Credit and hour sums, kind and offering choice | Vitest, pure functions | Cheap, exhaustive boundaries |
| Grid actions (drop, promote, read-only, backups hidden) | Vitest + Testing Library | Behaviour a student sees, without a browser |
| Add then remove across pages | Playwright, one spec | Wiring only (routing, auth, API); rules stay below |

## 3. Organization and data

- Backend: `rating_app/views/test_personal_plan.py`, `rating_app/services/test_personal_plan_service.py`, next to the unit; named `test_<method>_<expected>_when_<condition>`. Markers: `django_db` + `integration`.
- Frontend: `src/webapp/src/features/personal-plan/**/*.test.ts(x)`, beside the file under test.
- Isolation: each test runs in its own transaction (`django_db`); rows come from `factory_boy` factories (`PlannedCourseFactory`, `make_offering`); the autouse `mock_cache_manager` swaps Redis for an in-memory cache; time is pinned with `freeze_time`; one student's plan is asserted hidden from another.
- E2E (written, not yet run): no seeded database, so the spec creates its own pick, uses unique data and removes it. It needs the `login` project (a real Microsoft account), so it runs only where those credentials exist.
- No real student or teacher data in fixtures.

## 4. Running and checking the tests

```bash
cd src/backend && uv run pytest -k personal_plan -q
cd src/webapp  && pnpm exec vitest run src/features/personal-plan
```

A single command for the whole repository is planned (`scripts/test-all.sh`). A test is trusted only after it is broken on purpose: spoil one condition in the code (for example, drop the mandatory-course check in `personal_plan_service.py`, or count backups in `summarizePlan`), expect the test to turn red, then revert. Done so far: `credits >= min` to `credits > min` turned the minimum-boundary test red, and counting backups in `summarizePlan` turned two sum tests red. Mutations for the API tests are not yet done.
