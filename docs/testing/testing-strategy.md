# Testing Strategy

Targets and tooling for the whole project. How a backend test is written: [backend-tests.md](backend-tests.md).

## Pyramid

| Layer | Share | Backend | Frontend |
| --- | --- | --- | --- |
| Unit | 60% | pytest over models, services, mappers; dependencies mocked | Vitest over components, hooks, API clients |
| Integration | 30% | endpoints and repositories against a real database, auth flows | component + API client integration |
| E2E | 10% | — | Playwright over login, rating, profile |

Backend unit vs integration is the `integration` marker: `-m integration` is everything that leaves the process, `-m "not integration"` the rest.

## Coverage

| Scope | Line | Branch |
| --- | --- | --- |
| Backend | 75% | 60% |
| Frontend | 70% | 50% |
| Authentication, rating workflows | 90% | — |

Merge blocks on a failing test or coverage below target. A drop over 5%, or a new untested critical path, is a review warning rather than a gate.

## Tooling

- Backend: `pytest`, `pytest-django`, `pytest-cov`, `factory_boy`, `pytest-factoryboy`.
- Frontend: Vitest, `@testing-library/*`, jsdom, Playwright.

## Process

Run the suite locally before pushing; CI runs it again with coverage, and review covers test quality alongside the diff. Fix a flaky test when it appears — a quarantined test is coverage nobody is counting.
