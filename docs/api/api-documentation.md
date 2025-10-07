# OpenAPI Documentation Setup

This project uses `drf-spectacular` for automatic OpenAPI 3.0 schema generation and interactive API documentation.

## Configuration

### Settings

- `drf_spectacular` is added to `INSTALLED_APPS`
- `DEFAULT_SCHEMA_CLASS` is set to `drf_spectacular.openapi.AutoSchema`
- `SPECTACULAR_SETTINGS` are configured with project metadata

### URLs

The following documentation endpoints are available:

- **OpenAPI Schema**: `/api/schema/` - Returns the OpenAPI 3.0 schema in YAML format
- **Swagger UI**: `/api/docs/` - Interactive API documentation interface
- **ReDoc**: `/api/redoc/` - Alternative API documentation interface

### API Versioning

This API uses URL path versioning. All API endpoints are prefixed with the version number:

- **Current Version**: `v1`
- **Base URL**: `http://localhost:8000/api/v1/`
- **Example Endpoint**: `/api/v1/courses/`

The API is configured to only allow version `v1`. Future versions will be added as `/api/v2/`, etc.

## Usage

### Local Development

1. Start the Django development server:

   ```bash
   python manage.py runserver
   ```

2. Access the interactive documentation:
   - Swagger UI: `http://localhost:8000/api/docs/`
   - ReDoc: `http://localhost:8000/api/redoc/`

3. Export the schema directly:

   ```bash
   curl http://localhost:8000/api/schema/ -o ../../docs/api/openapi-generated.yaml
   ```

   The generated schema will show versioned paths (e.g., `/api/v1/courses/`) and include version information in the API metadata.

### CI/CD Integration

Generate the OpenAPI schema without starting the server:

```bash
python manage.py spectacular --file ../../docs/api/openapi-generated.yaml
```

This command is ideal for CI/CD pipelines as it:

- Does not require the Django development server to be running
- Generates the complete OpenAPI schema file
- Can be automated in build processes
- Works with the same configuration as the running application

### Frontend Integration

The generated schema file `openapi-generated.yaml` contains versioned endpoints and can be used for:

- Auto-generating frontend API client code with versioned URLs
- Type generation for TypeScript/JavaScript
- API testing automation
- Documentation synchronization

For frontend autogeneration, the schema file should be available at: [`docs/api/openapi-generated.yaml`](./openapi-generated.yaml)

**Important**: When generating frontend clients, ensure the base URL includes the version prefix (e.g., `/api/v1/`).

## Adding New Endpoints

When adding new API endpoints, ensure proper documentation by:

1. **Use GenericAPIView**: Extend from DRF's generic view classes when possible
2. **Add serializer_class**: Specify the serializer class for automatic schema generation
3. **Use @extend_schema_view**: For generic views, use the class-level decorator:

   ```python
   from drf_spectacular.utils import extend_schema_view, extend_schema

   @extend_schema_view(
       list=extend_schema(
           summary="Brief description",
           description="Detailed description",
           tags=["endpoint-group"],
           operation_id="endpoint_v1_list",
       )
   )
   class MyListView(generics.ListAPIView):
       queryset = MyModel.objects.all()
       serializer_class = MySerializer
   ```

   For custom view methods, use `@extend_schema`:

   ```python
   @extend_schema(
       summary="Brief description",
       description="Detailed description",
       tags=["endpoint-group"],
       operation_id="endpoint_v1_action"
   )
   def get(self, request, *args, **kwargs):
       # your code
   ```

   Include version information in operation IDs and descriptions for clarity.

## Testing Documentation

After making changes, verify the schema:

```bash
python manage.py spectacular --validate --file ../../docs/api/openapi-generated.yaml
```

This will validate the generated schema and report any issues.

## Versioning Strategy

### Current Version (v1)

- **URL Pattern**: `/api/v1/`
- **Status**: Active and stable
- **Backward Compatibility**: Maintained until v2 release

### Future Versions

When introducing new API versions:

1. **Add new version to settings**:

   ```python
   REST_FRAMEWORK = {
       "ALLOWED_VERSIONS": ["v1", "v2"],
       # ... other settings
   }
   ```

2. **Create versioned URL patterns**:

   ```python
   urlpatterns = [
       path("api/v1/", include("rating_app.urls.v1")),
       path("api/v2/", include("rating_app.urls.v2")),
       # ... other URLs
   ]
   ```

3. **Deprecate old versions** when they're no longer needed

### Client Considerations

- Always include the version in API requests
- Expect breaking changes when major versions increment
- Use version-specific operation IDs in generated clients
- Monitor deprecation warnings in API responses
