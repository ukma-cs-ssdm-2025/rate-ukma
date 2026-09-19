# Backend Test Conventions

Rules for pytest code under `src/backend`. `docs/testing/testing-strategy.md` covers the pyramid and coverage targets; this file covers how a single test is written. Older files may predate a rule: follow the rule, not the neighbour, and mention the contradiction in the PR.

Ruff's `PT` (flake8-pytest-style) rule set enforces the `parametrize`, `raises` and fixture-syntax rules below. Layout, structure and factory rules are review-enforced: `PT` has no rule for test classes, module `pytestmark`, or factory determinism.

## Layout and fixtures

- Tests live next to the code they test: `course_repository.py` is tested by `test_course_repository.py`, and an endpoint by `rating_app/views/test_<resource>.py` next to its view. Two exceptions: a test module never goes inside the `rating_app/models/` package, because pytest then imports it as top-level `models.*` and Django raises `Model class models.comment.Comment doesn't declare an explicit app_label` — cross-model tests sit at the app root next to `test_signals.py`. `rating_app/tests/` holds no tests, only `factories.py` and `semester_dates.py`.
- A test file is named after the unit it covers, or after a concern of that unit when one file would be unwieldy: `test_rating_cache_invalidation.py` splits off the rating views, `test_microsoft_account_linking.py` covers the linking flows of the adapter that `test_microsoft_account_adapters.py` also tests. Never name a file after how its tests run — a `_integration.py` suffix duplicates the marker, and drifts the moment one test in it stops needing the database.
- A fixture lives in the narrowest scope that needs it: module-level `@pytest.fixture` first, `src/backend/conftest.py` only once a second file needs it, a package-level `conftest.py` (as in `scraper/services/deduplication/`) when the need is package-wide.
- Factories reach tests as fixtures, never as imports. `conftest.py` registers each factory once with `pytest-factoryboy`'s `register(CourseFactory)`, which generates `course_factory` (the factory itself) and `course` (one built instance). Prefer `course_factory`: the bare fixture is a single shared instance, so two tests wanting two rows need the factory. Never `from rating_app.tests.factories import CourseFactory`, and never hand-write `def course_factory(): return CourseFactory`.
- Those fixtures exist only at runtime, so grep will not find a definition. List them with `grep -n '^register(' src/backend/conftest.py` or `uv run pytest --fixtures | grep _factory`.
- Factory fixtures take the same arguments as the factory class: `course_offering_factory(course=course)`, `course_factory.create_batch(3)`, and double-underscore traversal into a `SubFactory` such as `rating_factory(course_offering__semester=semester)`. Override a registered default with the `fixture__field` form: `conftest.py` sets `user__email` to the UKMA-domain address the OAuth adapter accepts, and a test can do the same locally.
- A module-level helper that builds rows cannot take fixtures, so it becomes a fixture returning the builder: `def make_rating(rating_factory, student_factory)` returning `_make`. Plain `_make_*` functions stay for pure DTO construction, which needs no database.
- `autouse` is for global environment swaps only (`mock_cache_manager` replaces redis for the whole suite). An autouse fixture that builds test data hides the arrange block.
- Views gated on the semester calendar need frozen time. `rating_app/tests/semester_dates.py` holds the shared semester: `@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)` for a rating window that is open, `DEFAULT_BEFORE_MIDTERM_DATE` for one that is closed. Import them from there — a test module never imports another test module.

## Structure

- Both shapes are allowed: module-level `def test_*` functions, and `class Test*` grouping related tests. Pick per module and stay consistent inside it; do not convert an existing module from one shape to the other as a drive-by, and do not mix the two in one file.
- Reach for a class when a module covers several behaviours of one unit and the group wants a name, its own fixtures, or its own markers — `TestCachePrimitives` / `TestCacheInvalidation` in `test_cache.py`, or the mixed modules where one group needs the database and another does not. A class holding a single test groups nothing; that one is a function.
- Class fixtures are function-scoped. `@pytest.fixture(scope="class")` cannot touch the ORM: pytest-django's `db` is function-scoped, so requesting it from a class-scoped fixture fails with `ScopeMismatch`. Write `@pytest.fixture` (default scope) as a method taking `self`, and let each test build its own rows.
- Never `setup_method` holding state that tests mutate — that is shared state between tests, which is what fixtures exist to prevent. `setup_method` also loses `parametrize`, `yield` teardown, and reuse across modules.
- A class marker covers every method, including ones added later, and it is invisible from inside the method. Put the marker where it is true: on the class when the whole group needs it, on the test when only that test does. `test_cache.py` once had four marked classes and one unmarked, which is how three tests silently dropped out of `-m integration`.
- Never `unittest.TestCase`: no fixtures, no `parametrize`, no `pytest.raises(match=)`.
- Large modules still split by concern; that is what keeps a file navigable, and a class is not a substitute for it. `test_rating_cache_invalidation.py` is already a split off the rating views.
- One behaviour per test. Name it after the unit and the outcome: `test_<method>_<expected>_when_<condition>`. Add a docstring only for non-obvious rationale (a boundary, an invariant, a trap the test guards).
- Body in three blocks separated by blank lines: arrange, act, assert.
- `pytest.mark.parametrize` takes a tuple of names, not a comma-separated string. Use it for the same path with different inputs, not for unrelated behaviours.

## Markers

- Markers are written where they apply, above the test they describe. A test that touches the database carries both, in this order:

  ```python
  @pytest.mark.django_db
  @pytest.mark.integration
  def test_course_returns_offerings(course_factory): ...
  ```

- No module-level `pytestmark`. Hoisting a marker to the top of the file, or deriving it in a `conftest` hook, saves a few hundred lines and costs the thing that matters: you can no longer tell from a test whether it hits the database. Two lines per test is cheap.
- On a `class Test*` the markers may sit on the class, but only when every method in it needs them. A method that does not is marked on its own, not covered by the group.
- `integration` without `django_db` is for a test that leaves the process another way: `rateukma/caching/test_cache.py` exercises the cache against a mocked redis client and never touches the ORM.
- Select with `-m integration` or `-m "not integration"`. `--strict-markers` is on, so a mistyped marker fails collection instead of silently dropping out of the selection. Nothing in CI filters by marker today; the split exists for local runs and the pyramid in `testing-strategy.md`.
- `@pytest.mark.e2e` is reserved for Playwright flows in `src/webapp`; backend tests do not use it.

## Test data by layer

| Layer | Data source | Reason |
| --- | --- | --- |
| Repositories, mappers, views | registered factory fixtures (`course_factory`, `rating_factory`, ...) | The contract is the query and the serialized shape; only a real database proves it. |
| Services, event listeners, adapters | `MagicMock` / `SimpleNamespace` standing in for repository and service protocols | Services are wired through `rateukma.ioc` protocols; a unit test asserts the calls the service makes, not the ORM. |
| Scraper parsers and dedup | Inline fixtures and sample payloads | Pure functions over parsed HTML; no database. |

Rules that apply to all layers:

- Never create fixtures in the order the assertion expects. Ordering tests must insert out of order so a dropped `order_by` fails the test (see `test_course_repository.py::five_courses_out_of_order`).
- Assert on what a consumer observes: returned DTOs, response JSON, raised exception, repository calls. Do not assert a mock echoing its own input, `hasattr`, or `len(result) > 0`.
- Query-count invariants use `django_assert_num_queries`; that is the only place where implementation detail is asserted on purpose.
- Values that look like production data (real names, emails, ids) never appear in tests; invent them or generate them with `factory.Faker`.

## Factories

`factory_boy` builds every model instance a test needs, and a model that tests touch needs a factory. Raw `Model.objects.create` survives in two places only: `waffle.Flag` rows, which belong to a third-party app, and `FeedEvent` index rows, where the point of the test is that the row was written without the service layer.

- Defaults are deterministic. `factory.Sequence` for anything `unique=True` or used as a `django_get_or_create` key, fixed values for anything a test might assert on. `factory.Faker` only where the value is irrelevant to every test. A fuzzy `django_get_or_create` key is the worst case: `SemesterFactory` keyed on `(year, term)` across 27 combinations returned the same semester for two calls about 5% of the time, failing as a wrong assertion rather than an error.
- One source of randomness: `factory.Faker`, which draws from `factory.random` and can be pinned with `factory.random.reseed_random()`. Never stdlib `random` or a module-level `Faker()`; those sit outside factory_boy's control, so a failure cannot be reproduced from a seed.
- Choice fields use the enum member (`InstructorRole.LECTURE_INSTRUCTOR`, `ExamType.EXAM`), never the string literal.
- Recurring variants are traits: `student_factory(with_user=True)` links a fresh user through `class Params`. Repeating the same kwargs across files instead is how variants drift.

## Endpoint baseline

Every HTTP endpoint gets the same six scenarios, so a reviewer can tell from the test names what is proven. Skipping one is fine; skipping it silently is not — say which scenario is N/A and why.

| # | Scenario | Assert |
| --- | --- | --- |
| 1 | Happy path | Status plus the response body a client actually reads — read the serializer for the keys, since they differ per route (`data["course_offerings"]` vs `data["items"]`/`data["total"]`). Status-only is not coverage. |
| 2 | Unauthenticated | Bare `api_client` gets `403` — `SessionAuthentication` sits first in `DEFAULT_AUTHENTICATION_CLASSES`, so DRF sends no `WWW-Authenticate` header and returns `403`, not `401`. `auth/session/` returns `401` by design. Skip only for routes whose view sets `permission_classes = [AllowAny]`. |
| 3 | Authenticated but not entitled | Wrong owner, not enrolled, or not a student gets `403`. Test ownership separately from enrolment: a caller who is enrolled and still not the owner must be its own test. |
| 4 | Validation | Write endpoints reject a bad body with `400`, asserting which field failed. |
| 5 | Not found | Detail routes return `404` for an unknown id and `400` for a malformed one. |
| 6 | List contract | Paginated routes prove a second page; ordered routes prove the order with fixtures inserted out of order. |

- `token_client` is the authenticated client and `api_client` the anonymous one; never hand-roll `APIClient()` plus `force_authenticate`. `token_client.user` has **no** `Student` row, so an endpoint behind `require_student` or an enrolment check needs `student_factory(user=token_client.user)` and `enrollment_factory(offering=..., student=...)` first — otherwise the happy path returns `403` and looks like an auth misconfiguration (`test_vote.py` has the full arrange).
- Assert the exact status code. `assert response.status_code in (401, 403)` passes whether the endpoint requires login or rejects the caller, so it cannot catch a permission regression in either direction.
- Build URLs with `reverse()` and the route name from `rating_app/ioc_container/web.py`; if a route has no `name=`, add one. A hardcoded `f"/api/v1/..."` string does not fail when a route moves — it 404s, and a test asserting 404 keeps passing.
- Ownership and entitlement checks live in `rating_app/views/decorators.py` (`require_rating_ownership`, `require_comment_ownership`, `require_student`). A view relying on the DRF default `IsAuthenticated` alone has no scenario 3.

## Exceptions

- Pass `match=` with a stable fragment of the real message. Bare `pytest.raises(ValueError)` accepts any `ValueError`, including one raised by a typo in the arrange block. When the exception carries no message (a bare domain error such as `InvalidCursorError`), a bare `pytest.raises` is acceptable.
- Never assert inside an `except` block; a test that never raises would pass silently.

## Running

```bash
cd src/backend
uv sync --extra test --extra linting
cp ../.env.sample .env                 # settings read DJANGO_SECRET_KEY even under settings.testing
uv run pytest rating_app/repositories/test_course_repository.py -q
uv run pytest -m integration -q
uv run ruff check --select PT .
```

`settings.testing` swaps the database for in-memory SQLite, so PostgreSQL-only behaviour (collation, JSON operators, `select_for_update`) is not covered by the suite. `--reuse-db` is on by default in `pytest.ini`; pass `--create-db` after changing migrations.
