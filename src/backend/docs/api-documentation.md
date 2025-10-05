# OpenAPI Documentation Setup

This project uses `drf-spectacular` for automatic OpenAPI 3.0 schema generation and interactive API documentation.

## Configuration

### Settings

- `drf_spectacular` is added to `INSTALLED_APPS` in `rateukma/settings/_base.py:55`
- `DEFAULT_SCHEMA_CLASS` is set to `drf_spectacular.openapi.AutoSchema` in `rateukma/settings/_base.py:171`
- `SPECTACULAR_SETTINGS` are configured with project metadata in `rateukma/settings/_base.py:174-179`

### URLs

The following documentation endpoints are available:

- **OpenAPI Schema**: `/api/schema/` - Returns the OpenAPI 3.0 schema in YAML format
- **Swagger UI**: `/api/docs/` - Interactive API documentation interface
- **ReDoc**: `/api/redoc/` - Alternative API documentation interface

## Usage

### Local Development

1. Start the Django development server:

   ```bash
   python manage.py runserver
   ```

2. Access the interactive documentation:
   - Swagger UI: http://localhost:8000/api/docs/
   - ReDoc: http://localhost:8000/api/redoc/

3. Export the schema directly:

   ```bash
   curl http://localhost:8000/api/schema/ -o openapi-generated.yaml
   ```

### CI/CD Integration

Generate the OpenAPI schema without starting the server:

```bash
python manage.py spectacular --file openapi-generated.yaml
```

This command is ideal for CI/CD pipelines as it:

- Does not require the Django development server to be running
- Generates the complete OpenAPI schema file
- Can be automated in build processes
- Works with the same configuration as the running application

### Frontend Integration

The generated schema file `openapi-generated.yaml` can be used for:

- Auto-generating frontend API client code
- Type generation for TypeScript/JavaScript
- API testing automation
- Documentation synchronization

For frontend autogeneration, the schema file should be available at:
```
/docs/api/openapi-generated.yaml
```

## Adding New Endpoints

When adding new API endpoints, ensure proper documentation by:

1. **Use GenericAPIView**: Extend from DRF's generic view classes when possible
2. **Add serializer_class**: Specify the serializer class for automatic schema generation
3. **Use @extend_schema**: For custom documentation, use the `@extend_schema` decorator:

   ```python
   from drf_spectacular.utils import extend_schema

   @extend_schema(
       summary="Brief description",
       description="Detailed description",
       tags=["endpoint-group"]
   )
   def get(self, request):
       # your code
   ```

## Testing Documentation

After making changes, verify the schema:

```bash
python manage.py spectacular --validate --file openapi-generated.yaml
```

This will validate the generated schema and report any issues.
