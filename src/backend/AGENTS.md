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

Prefer real typing fixes over escapes: no `cast()` to paper over model relations (annotate `RelatedManager[...]` on the model instead), and any `# pyright: ignore[rule]` must be rule-scoped with a one-line reason.

## Logging style

Start log calls with a snake_case event name, then pass structured context via keyword args so tools can parse them.

Example:

```python
logger.debug("pagination_href_extract_failed", err=exc, href=str(href))
```
