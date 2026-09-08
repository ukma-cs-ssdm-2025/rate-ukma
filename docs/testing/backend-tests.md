# Backend Test Conventions

Rules for pytest code under `src/backend`. `docs/testing/testing-strategy.md` covers the pyramid and coverage targets; this file covers how a single test is written. Older files may predate a rule: follow the rule, not the neighbour, and mention the contradiction in the PR.

The mechanical half of these rules is enforced by ruff's `PT` (flake8-pytest-style) rule set, enabled in `src/backend/pyproject.toml`.

## Layout

- Tests live next to the code they test: `rating_app/repositories/course_repository.py` is tested by `rating_app/repositories/test_course_repository.py`. `rating_app/tests/` holds only `factories.py`.
- Shared fixtures and factory shortcuts (`token_client`, `course_factory`, ...) live in `src/backend/conftest.py`. Add a fixture there only when a second test file needs it.

## Structure

- Module-level `def test_*` functions. No `class Test*` groups and no `unittest.TestCase`. Group related tests by file and share setup through module-level `@pytest.fixture` (no parentheses) and private `_make_*` helpers.
- One behaviour per test. Name it after the unit and the outcome: `test_<method>_<expected>_when_<condition>`. The name carries the intent; add a docstring only when it states non-obvious rationale (a boundary, an invariant, a trap the test guards).
- Body in three blocks separated by blank lines: arrange, act, assert. `# Arrange` / `# Act` / `# Assert` comments are optional; keep them consistent within a file.
- `pytest.mark.parametrize` takes a tuple of names, not a comma-separated string. Use it for the same path with different inputs, not for unrelated behaviours.

## Markers

`pytest.ini` registers two markers: `integration` and `e2e`. There is no `unit` marker; a test without markers is a unit test.

- Every test that touches the database carries both `@pytest.mark.django_db` and `@pytest.mark.integration`, in that order, directly above the function. A file where every test hits the database may declare `pytestmark = [pytest.mark.django_db, pytest.mark.integration]` once at module level.
- The converse does not hold: the cache-layer tests in `rateukma/caching/test_cache.py` carry `integration` without touching the database (they exercise the cache layer against a mocked redis client).
- `@pytest.mark.e2e` is reserved for Playwright flows in `src/webapp`; backend tests do not use it.

## Test data by layer

| Layer | Data source | Reason |
| --- | --- | --- |
| Repositories, mappers, views | `rating_app.tests.factories` (`CourseFactory`, ...) via `conftest.py` fixtures or direct import | The contract is the query and the serialized shape; only a real database proves it. |
| Services, event listeners, adapters | `MagicMock` / `SimpleNamespace` standing in for repository and service protocols | Services are wired through `rateukma.ioc` protocols; a unit test asserts the calls the service makes, not the ORM. |
| Scraper parsers and dedup | Inline fixtures and sample payloads | Pure functions over parsed HTML; no database. |

Rules that apply to all layers:

- Never create fixtures in the order the assertion expects. Ordering tests must insert out of order so a dropped `order_by` fails the test (see `test_course_repository.py::five_courses_out_of_order`).
- Assert on what a consumer observes: returned DTOs, response JSON, raised exception, repository calls. Do not assert a mock echoing its own input, `hasattr`, or `len(result) > 0`.
- Query-count invariants use `django_assert_num_queries`; that is the only place where implementation detail is asserted on purpose.
- Values that look like production data (real names, emails, ids) never appear in tests; invent them or use `faker`.

## Exceptions

- Pass `match=` with a stable fragment of the real message. Bare `pytest.raises(ValueError)` accepts any `ValueError`, including one raised by a typo in the arrange block. When the exception carries no message (a bare domain error such as `InvalidCursorError`), a bare `pytest.raises` is acceptable.
- Never assert inside an `except` block; a test that never raises would pass silently.

## Running

```bash
cd src/backend
uv sync --extra test --extra linting   # pytest and ruff are extras, not base dependencies
cp ../.env.sample .env                 # settings read DJANGO_SECRET_KEY even under settings.testing
uv run pytest rating_app/repositories/test_course_repository.py -q
uv run pytest -m integration -q        # integration-marked tests (mostly, not only, DB-backed)
uv run ruff check --select PT .        # pytest-style lint
```

`settings.testing` swaps the database for in-memory SQLite, so PostgreSQL-only behaviour (collation, JSON operators) is not covered by the suite. `--reuse-db` is on by default in `pytest.ini`; pass `--create-db` after changing migrations.

## Sources

- pytest: [Good integration practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html), [How to use fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html)
- pytest-django: [Database access](https://pytest-django.readthedocs.io/en/latest/database.html), [Helpers](https://pytest-django.readthedocs.io/en/latest/helpers.html)
- ruff: [flake8-pytest-style (PT)](https://docs.astral.sh/ruff/rules/#flake8-pytest-style-pt)
- factory_boy: [Using factories](https://factoryboy.readthedocs.io/en/stable/introduction.html)
- Arrange-Act-Assert (Bill Wake) and "Software Engineering at Google", ch. 12 (test behaviours, not methods; clarity over deduplication in tests)
