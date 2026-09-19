# Backend conventions

## API spec

The OpenAPI spec at `docs/api/openapi-generated.yaml` is the source of truth for frontend API types. After changing serializers or endpoints, regenerate it with:

```bash
.venv/bin/python manage.py spectacular --file ../../docs/api/openapi-generated.yaml
```

## Feature flags

Runtime toggles via [django-waffle](https://waffle.readthedocs.io/), evaluated
per request user. Backend: a flag is exposed to the frontend only if its name is
in `PUBLIC_FEATURE_FLAGS` (`rateukma/settings/_base.py`) — that allowlist is the
security boundary, so never put a server-only/sensitive flag there. Check
server-only flags with `waffle.flag_is_active(request, name)`. See
[docs/feature-flags.md](../../docs/feature-flags.md) for adding, toggling, and
removing flags, and [ADR-0009](../../docs/architecture/decisions/0009-feature-flags.md)
for the rationale.

## Typechecking

Pyright runs in `standard` mode over `rating_app` and `rateukma`. Always invoke it through uv so it picks up the project interpreter (the config deliberately has no `venvPath`):

```bash
uv sync --extra typecheck  # once, or after dependency changes
uv run pyright
```

CI runs the same commands in the `typecheck-backend` job and must stay at 0 errors. Tests, migrations, and `generate_mock_data.py` are excluded for now; ratcheting tests in (~100 errors, mostly django test-client stub gaps) is a follow-up under #628.

### Writing simple, typesafe code

Escapes are a last resort, in order of preference:

1. **Fix the type, not the checker.** If pyright flags a mismatch, first ask whether the annotation is lying. A field that can hold `None` at runtime must be typed `| None` — don't `cast()` the `None` away.
2. **Annotate Django relations on the model**, not at call sites. Reverse FK / M2M managers are invisible to pyright; declare them once as class-level annotations with stub-only types:

   ```python
   if TYPE_CHECKING:
       from django.db.models.manager import RelatedManager

   class Course(models.Model):
       offerings: RelatedManager[CourseOffering]
   ```

   `RelatedManager` exists only in the stubs — the import must stay under `TYPE_CHECKING`.
3. **Small `Protocol` at untyped-library boundaries.** When a third-party client is untyped or too wide (redis), define a Protocol with just the methods you use and `cast` once where the real client is injected — never per call site.
4. **`cast()` only at real boundaries** (untyped library, cooperative mixin), never to silence a relation or an optional. Each cast should be explainable in one sentence.
5. **`# pyright: ignore[specificRule]`** — always rule-scoped, always with a one-line reason comment. Never bare `# type: ignore`.
6. **No hand-rolled Protocols for things stubs already type** — they drift the moment someone calls another method.

Don't widen a shared type (protocol return, DTO field) to make one implementer pass — fix the implementer or remove the false inheritance.

## Tests

Full conventions: [docs/testing/backend-tests.md](../../docs/testing/backend-tests.md). The rules that are cheapest to get wrong:

- Tests sit next to the code under test, as module-level `def test_*` functions or `class Test*` groups — both are fine, but stay consistent within a module and never convert one to the other as a drive-by. Never `unittest.TestCase`. A class is not a setup mechanism: `scope="class"` fixtures cannot touch the ORM (`db` is function-scoped, you get `ScopeMismatch`), so use plain `@pytest.fixture` methods and never `setup_method` holding mutable state. A class marker covers every method including ones added later, so put markers where they are actually true.
- A database test carries `@pytest.mark.django_db` and `@pytest.mark.integration`, in that order, directly above the test — no module-level `pytestmark`, no hook deriving one from the other. On a class the pair may sit on the class when every method needs it. `integration` alone is for a test that leaves the process without the ORM, as `rateukma/caching/test_cache.py` does.
- Factories arrive as `pytest-factoryboy` fixtures registered in `conftest.py` (`course_factory`, `course`, `rating_factory`, ...); they exist only at runtime, so list them with `grep -n '^register(' conftest.py`. Never import a factory class into a test, and never write a fixture that returns one. They take factory arguments: `course_offering_factory(course=course)`, `.create_batch(3)`, `rating_factory(course_offering__semester=semester)`, and the `user__email` form for defaults. Services and listeners stay unit-tested against `MagicMock` protocols.
- Factory defaults stay deterministic: `Sequence` for unique fields and `django_get_or_create` keys, fixed values for anything asserted on, randomness only via `factory.Faker` (never stdlib `random`), enum members over string literals, variants as traits.
- Endpoint tests follow the six-scenario baseline in the doc: happy path with a body assertion, unauthenticated (`403` here, not `401` — `SessionAuthentication` comes first), authenticated-but-not-entitled `403` with ownership tested apart from enrolment, validation `400`, `404`/`400` on detail routes, and pagination or ordering on list routes. Build URLs with `reverse()` and a route name from `ioc_container/web.py`; a hardcoded path 404s silently when a route moves.
- `token_client.user` has no `Student` row, so anything behind `require_student` or an enrolment check needs `student_factory(user=token_client.user)` plus `enrollment_factory(...)` first, or the happy path returns `403`. Views gated on the semester calendar also need `@freeze_time` with a date from `rating_app/tests/semester_dates.py`.
- Insert ordering fixtures out of order; a test whose fixtures already sit in the expected order passes without the `order_by` it claims to cover.
- `pytest.raises` takes `match=` with a message fragment, unless the exception carries no message. Ruff `PT` enforces the `parametrize`/`raises`/fixture-syntax rules; the structure and factory rules above are review-enforced.
- Run `uv run pytest <file> -q` from `src/backend`; needs `uv sync --extra test` and a `.env` copied from `src/.env.sample`.

## Logging style

Start log calls with a snake_case event name, then pass structured context via keyword args so tools can parse them.

Example:

```python
logger.debug("pagination_href_extract_failed", err=exc, href=str(href))
```
