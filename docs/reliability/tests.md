# Test Suite Categorization

## 1. Error-Handling Tests ✅

**Description**: Check that the system doesn't crash when an exception occurs (graceful error handling)

### [test_rating.py](../../src/backend/rating_app/views/test_rating.py)

- `test_retrieve_rating_invalid_uuid` - Invalid UUID format handling
- `test_create_rating_validation_error_missing_difficulty` - Missing required field
- `test_create_rating_validation_error_invalid_difficulty` - Invalid field value (out of range)
- `test_create_duplicate_rating_same_offering` - Duplicate record exception (409 Conflict)
- `test_create_rating_not_enrolled` - Business logic validation failure (403 Forbidden)
- `test_update_rating_not_enrolled` - Authorization check failure
- `test_patch_rating_not_enrolled` - Authorization check failure
- `test_delete_rating_not_enrolled` - Authorization check failure
- `test_create_rating_without_student_record` - Missing related entity
- `test_retrieve_nonexistent_rating` - Resource not found (404)
- `test_update_rating_with_immutable_field_attempt` - Immutable field modification attempt

### [test_course.py](../../src/backend/rating_app/views/test_course.py)

- `test_course_retrieve_invalid_uuid_format` - Invalid UUID format handling
- `test_invalid_semester_term` - Invalid enum value
- `test_non_existent_department` - Non-existent foreign key
- `test_non_existent_course_retrieve` - Resource not found (404)
- `test_course_list_with_invalid_page_default_value` - Invalid pagination parameter

### [test_catalog.py](../../src/backend/scraper/parsers/test_catalog.py) (Catalog Parsing)

- `test_course_link_parser_skips_urlparse_errors` - URL parsing exceptions handled gracefully
- `test_course_link_parser_requires_base_url` - Validates required base_url parameter
- `test_catalog_parser_handles_invalid_query_encoding` - Gracefully degrades on invalid URL encoding
- `test_catalog_parser_requires_base_url` - Validates required base_url for CatalogParser

### [test_catalog_service.py](../../src/backend/scraper/services/test_catalog_service.py) (Catalog Service)

- `test_fetch_catalog_page_partial_wait_failures` - Continues despite some Playwright timeouts
- `test_fetch_catalog_page_all_wait_failures` - Resilient even when all wait operations fail

---

## 2. External Failure Tests 🌐

**Description**: Simulates external system failures (API down, database unavailable, network issues)

### [networkError.integration.test.tsx](../../src/webapp/src/lib/api/networkError.integration.test.tsx) (Frontend Integration)

- `redirects to error page when API call fails due to network issues` - Connection loss handling
- `redirects with offline reason when user is offline` - Network unavailable detection
- `does not redirect on successful API call` - Normal operation when API is healthy
- `does not redirect on 404 errors` - Client errors are handled locally, not as system failures
- `simulates user on authenticated page (courses) making request that triggers connection error` - Error context preservation during redirect

### [networkError.test.ts](../../src/webapp/src/lib/api/networkError.test.ts) (Frontend Unit Tests)

- `redirects with offline reason when navigator reports offline` - Offline detection via navigator API
- `does not treat 5xx responses as connection issues` - Ensures server errors alone don't trigger connection-error redirect
- `redirects with offline reason when ERR_NETWORK occurs and user is offline` - Network error with offline state
- `redirects with server reason when ERR_NETWORK happens but user is online` - Network error with online state (server issue)
- `returns false when the error is not an axios error` - Non-Axios errors are ignored
- `ignores canceled axios requests identified by code` - Request cancellation is not a failure
- `ignores axios cancel instances even without a specific code` - Graceful handling of all cancellation types
- `returns false when response status is 4xx` - Client errors are not external failures
- `prevents multiple redirects from race conditions` - Ensures only single redirect during simultaneous errors
- `does not redirect if already on connection error page` - Prevents redirect loops
- `allows redirect after resetRedirectFlag is called` - Supports recovery after error state

---

## 3. Boundary Tests 🎯

**Description**: Boundary cases for input (edge cases, limits, constraints)

### [test_rating.py](../../src/backend/rating_app/views/test_rating.py)

- `test_ratings_list_pagination` - Pagination boundaries (page 2, page_size=5)
- `test_create_rating_validation_error_invalid_difficulty` - **Boundary**: difficulty value outside valid range [1-5]
- `test_ratings_list_empty_for_course_with_no_ratings` - Empty result set boundary
- `test_create_rating` - Standard valid input (baseline)
- `test_update_rating` - Full update boundary case
- `test_patch_rating` - Partial update boundary (single field)
- `test_partial_update_single_field` - Minimal update (1 field)

### [test_course.py](../../src/backend/rating_app/views/test_course.py)

- `test_courses_paging` - Pagination boundaries (page=1, page_size=5, total=15)
- `test_course_list_pagination_last_page` - **Boundary**: Last page pagination
- `test_sorting_params` - **Boundary**: Sorting order constraints (asc/desc)
- `test_filter_by_multiple_parameters` - Multiple filter combinations (edge case)
- `test_course_list_with_avg_filters` - **Boundary**: Rating average filters (1-5 range)
- `test_courses_list_no_filters` - Minimal input (no filters)

---

## Detailed Examples

### Example 1: Error-Handling Test (API Input Validation)

```python
@pytest.mark.django_db
def test_retrieve_rating_invalid_uuid(token_client, course_factory):
    course = course_factory()
    url = f"/api/v1/courses/{course.id}/ratings/invalid-uuid/"
    response = token_client.get(url)
    # Expects graceful error response, not crash
    assert response.status_code == 400
```

### Example 2: Error-Handling Test (Catalog Parsing - URL Parsing Exception)

```python
def test_course_link_parser_skips_urlparse_errors():
    """Verifies parser handles malformed URLs gracefully without crashing."""
    html = '<a href="http://invalid[url">Course</a>'
    base_url = "http://example.com"

    # Simulate URL parsing failure
    with patch("scraper.parsers.catalog.urlparse", side_effect=ValueError("broken href")):
        result = CourseLinkParser().parse(html, base_url=base_url)

    # Returns empty list instead of crashing
    assert result == []
```

### Example 3: External Failure Test (Server Error Detection)

```typescript
it("redirects to error page when API call fails with 500", async () => {
    // Arrange: Mock API to return server error
    const user = userEvent.setup();
    mockAxios.onGet("/api/courses").reply(500);

    render(<TestComponent endpoint="/api/courses" />);

    // Act: User attempts to fetch data while API is down
    const button = screen.getByRole("button", { name: /Fetch Data/i });
    await user.click(button);

    // Assert: Verify system gracefully handles failure and redirects
    await vi.waitFor(() => {
        expect(mockWindowReplace).toHaveBeenCalledOnce();
    });
    const redirectUrl = new URL(mockWindowReplace.mock.calls[0][0]);
    expect(redirectUrl.pathname).toBe(CONNECTION_ERROR_PATH);
    expect(redirectUrl.searchParams.get("reason")).toBe("server");
});
```

### Example 4: External Failure Test (Offline Detection)

```typescript
it("redirects with offline reason when user is offline", async () => {
    // Arrange: Simulate user being offline
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { onLine: false } as Navigator);
    mockAxios.onGet("/api/data").networkError();

    render(<TestComponent endpoint="/api/data" />);

    // Act: User attempts to fetch while offline
    const button = screen.getByRole("button", { name: /Fetch Data/i });
    await user.click(button);

    // Assert: Verify offline detection and appropriate error handling
    await vi.waitFor(() => {
        expect(mockWindowReplace).toHaveBeenCalledOnce();
    });
    const redirectUrl = new URL(mockWindowReplace.mock.calls[0][0]);
    expect(redirectUrl.searchParams.get("reason")).toBe("offline");
});
```

### Example 5: Boundary Test (Input Range Validation)

```python
@pytest.mark.django_db
def test_create_rating_validation_error_invalid_difficulty(token_client, ...):
    payload = {
        "difficulty": 6,  # BOUNDARY: Outside valid range [1-5]
        "usefulness": 5,
        # ...
    }
    response = token_client.post(url, data=payload, format="json")
    assert response.status_code == 400
```

---

## Summary Statistics

| Category                   | Count | Purpose                                          |
|----------------------------|-------|--------------------------------------------------|
| **Error-Handling Tests**   | 22    | Verify system stability under exceptions         |
| **External Failure Tests** | 16    | Simulate external system failures & dependencies |
| **Boundary Tests**         | 12    | Verify constraints and edge cases                |
| **Happy Path Tests**       | 15+   | Standard functionality validation                |
