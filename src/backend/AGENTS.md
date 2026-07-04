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

## Logging style

Start log calls with a snake_case event name, then pass structured context via keyword args so tools can parse them.

Example:

```python
logger.debug("pagination_href_extract_failed", err=exc, href=str(href))
```
