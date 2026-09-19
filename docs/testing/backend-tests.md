# Backend Test Conventions

How a single pytest test under `src/backend` is written. Pyramid and coverage targets: [testing-strategy.md](testing-strategy.md). Every rule below holds across the suite today; when you hit a file that contradicts one, the file is wrong — fix it or say why in the PR.

Ruff `PT` enforces the `parametrize` / `raises` / fixture-syntax rules. Everything else here is review-enforced.

## Layout

- Test sits next to its unit: `test_course_repository.py`, `rating_app/views/test_<resource>.py`. Name the file after the unit or a concern of it (`test_rating_cache_invalidation.py`), never after how it runs — an `_integration.py` suffix duplicates the marker and drifts when one test stops needing the database.
- Never put a test module inside `rating_app/models/`: pytest imports it as top-level `models.*` and Django raises `doesn't declare an explicit app_label`. Cross-model tests go at the app root beside `test_signals.py`. `rating_app/tests/` holds no tests — only `factories.py` and `semester_dates.py`.
- Fixture goes in the narrowest scope that needs it: module first, package `conftest.py` next, root `src/backend/conftest.py` last.
- `autouse` is for global environment swaps only (`mock_cache_manager`). An autouse fixture that builds data hides the arrange block.
- Time-gated views need `@freeze_time` with a date from `rating_app/tests/semester_dates.py` (`DEFAULT_AFTER_MIDTERM_DATE` open, `DEFAULT_BEFORE_MIDTERM_DATE` closed). A test module never imports another test module.

## Factories

Registered in `conftest.py` via `pytest-factoryboy` `register(CourseFactory)`, which generates `course_factory` and `course`. Take them as parameters — never import the class, never write `def course_factory(): return CourseFactory`.

- They have no source definition to grep: `grep -n '^register(' src/backend/conftest.py`.
- They take the factory's own arguments: `course_offering_factory(course=course)`, `course_factory.create_batch(3)`, `rating_factory(course_offering__semester=semester)`. Change a default with `user__email`-style overrides.
- Prefer `course_factory` over bare `course`; the bare fixture is one shared instance.
- A helper that builds rows becomes a fixture returning the builder (`make_rating(rating_factory, student_factory)`). Plain `_make_*` functions stay for DTOs.
- Defaults are deterministic: `Sequence` for `unique=True` and any `django_get_or_create` key, fixed values for anything asserted on, enum members over string literals, variants as traits (`student_factory(with_user=True)`). A fuzzy `get_or_create` key collides silently — `SemesterFactory` keyed on `(year, term)` returned the same row for two calls ~5% of the time.
- Randomness only via `factory.Faker`, which `factory.random.reseed_random()` can pin. Never stdlib `random` or a module-level `Faker()`.
- Every model a test touches needs a factory. Raw `Model.objects.create` survives only for `waffle.Flag` (third-party) and `FeedEvent` rows written deliberately without the service layer.

## Structure

- Module-level `def test_*` and `class Test*` are both fine. Stay consistent within a module; never convert one to the other as a drive-by.
- A class earns its place by grouping several behaviours of one unit with shared fixtures or markers. A class around one test groups nothing.
- Never `unittest.TestCase` (no fixtures, no `parametrize`, no `match=`). Never `setup_method` holding mutable state.
- `@pytest.fixture(scope="class")` cannot touch the ORM — `db` is function-scoped, so it raises `ScopeMismatch`. Use default-scope fixture methods.
- One behaviour per test, named `test_<method>_<expected>_when_<condition>`. Arrange/act/assert separated by blank lines. Docstring only for non-obvious rationale.
- `parametrize` takes a tuple of names, and covers one path with different inputs — not unrelated behaviours.

## Markers

```python
@pytest.mark.django_db
@pytest.mark.integration
def test_course_returns_offerings(course_factory): ...
```

- Both markers, above the test, `django_db` first. No module-level `pytestmark` and no hook deriving one from the other: hoisting saves lines and costs the ability to tell from a test whether it hits the database.
- On a class the pair may sit on the class, but only when every method needs it — a class marker silently covers methods added later.
- `integration` alone means leaves-the-process without the ORM: `rateukma/caching/test_cache.py` against a mocked redis.
- `--strict-markers` is on, so a typo fails collection. Nothing in CI filters by marker; the split serves local runs and the pyramid.
- `@pytest.mark.e2e` is reserved for `src/webapp` Playwright flows.

## Test data by layer

| Layer | Source | Why |
| --- | --- | --- |
| Repositories, mappers, views | factory fixtures | The contract is the query and the serialized shape; only a real database proves it. |
| Services, listeners, adapters | `MagicMock` over the `rateukma.ioc` protocols | Assert the calls the service makes, not the ORM. |
| Scraper parsers, dedup | inline payloads | Pure functions; no database. |

- Insert ordering fixtures out of order, or a dropped `order_by` still passes (the `five_courses_out_of_order` fixture in `test_course_repository.py`).
- Assert what a consumer observes: DTOs, response JSON, the raised exception, repository calls. Never a mock echoing its input, `hasattr`, or `len(result) > 0`.
- Query counts via `django_assert_num_queries` — the one place implementation detail is asserted on purpose.
- Nothing resembling production data. Invent it or use `factory.Faker`.
- `pytest.raises` takes `match=` with a fragment of the real message, unless the exception carries none (`InvalidCursorError`). Never assert inside `except`.

## Endpoint baseline

Six scenarios per endpoint. Skipping one is fine; skipping it silently is not — say which is N/A and why.

| # | Scenario | Assert |
| --- | --- | --- |
| 1 | Happy path | Status **and** the body a client reads; keys differ per route, so check the serializer. Status-only is not coverage. |
| 2 | Unauthenticated | Bare `api_client` gets `403`, not `401` — `SessionAuthentication` is first, so DRF sends no `WWW-Authenticate`. `auth/session/` is the `401` exception. Skip only for `AllowAny` views. |
| 3 | Not entitled | Wrong owner, not enrolled, or not a student → `403`. Ownership gets its own test, separate from enrolment. |
| 4 | Validation | Bad body → `400`, asserting which field failed. |
| 5 | Not found | Unknown id → `404`, malformed id → `400`. |
| 6 | List contract | Prove a second page; prove order with fixtures inserted out of order. |

- `token_client` authenticated, `api_client` anonymous; never hand-roll `force_authenticate`. `token_client.user` has **no** `Student` row — anything behind `require_student` or an enrolment check needs `student_factory(user=token_client.user)` plus `enrollment_factory(...)`, or the happy path returns `403` and looks like broken auth (`test_vote.py` shows the arrange).
- Exact status codes. `in (401, 403)` passes whether the endpoint demands login or rejects the caller, catching neither regression.
- `reverse()` with the route name from `rating_app/ioc_container/web.py`; add a `name=` if the route lacks one. A hardcoded path 404s silently when a route moves.
- Entitlement lives in `rating_app/views/decorators.py` (`require_rating_ownership`, `require_comment_ownership`, `require_student`). A view on DRF's default `IsAuthenticated` alone has no scenario 3.

## Running

```bash
cd src/backend
uv sync --extra test --extra linting
cp ../.env.sample .env                 # settings read DJANGO_SECRET_KEY even under settings.testing
uv run pytest rating_app/repositories/test_course_repository.py -q
uv run ruff check --select PT .
```

`settings.testing` uses in-memory SQLite, so PostgreSQL-only behaviour (collation, JSON operators, `select_for_update`) is untested. `--reuse-db` is default; pass `--create-db` after changing migrations.
