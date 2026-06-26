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

## Logging style

Start log calls with a snake_case event name, then pass structured context via keyword args so tools can parse them.

Example:

```python
logger.debug("pagination_href_extract_failed", err=exc, href=str(href))
```
