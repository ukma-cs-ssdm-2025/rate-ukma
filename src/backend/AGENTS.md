# Backend conventions

## API spec

The OpenAPI spec at `docs/api/openapi-generated.yaml` is the source of truth for frontend API types. After changing serializers or endpoints, regenerate it with:

```bash
.venv/bin/python manage.py spectacular --file ../../docs/api/openapi-generated.yaml
```

## Logging style

Start log calls with a snake_case event name, then pass structured context via keyword args so tools can parse them.

Example:

```python
logger.debug("pagination_href_extract_failed", err=exc, href=str(href))
```
