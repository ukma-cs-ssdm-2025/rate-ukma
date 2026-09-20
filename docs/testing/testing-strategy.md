# Testing Strategy

Targets and tooling for the whole project. How a backend test is written: [backend-tests.md](backend-tests.md).

## Layers

| Layer | Where | Count |
| --- | --- | --- |
| Backend unit | mocked services, mappers, parsers | 368 |
| Backend integration | endpoints and repositories against a real database | 419 |
| Frontend unit | Vitest over components, hooks, API clients | 35 files |
| E2E | Playwright in `src/webapp/tests/e2e` | 15 specs |

Backend unit vs integration is the `integration` marker, not a folder: `-m integration` is everything that leaves the process, `-m "not integration"` the rest. The suite is currently integration-heavy because the product's risk sits in queries and permissions, not in pure functions; treat a new mock-only test that could have been an endpoint test as a smell.

## Coverage

| Scope | Line | Branch |
| --- | --- | --- |
| Backend | 75% | 60% |
| Frontend | 70% | 50% |
| Authentication, rating workflows | 90% | — |

These are review targets, not gates: nothing sets `fail_under`, so CI reports coverage and fails only on a failing test. A drop over 5% or a new untested critical path is a review objection, raised by a human.

## Tooling

- Backend: `pytest`, `pytest-django`, `pytest-cov`, `factory_boy`, `pytest-factoryboy`.
- Frontend: Vitest, `@testing-library/*`, jsdom, Playwright.

## Process

Run the suite locally before pushing; CI runs it again with coverage, and review covers test quality alongside the diff. Fix a flaky test when it appears — a quarantined test is coverage nobody is counting.
