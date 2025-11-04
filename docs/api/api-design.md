# API Design Documentation

## Architecture Overview

- **Base URL**: `http://localhost:8000/api/v1`
- **API Style**: RESTful
- **Authentication**: HttpOnly session cookie issued after Microsoft OIDC login, protected with CSRF token
- **Response Format**: JSON
- **Versioning Strategy**: URL path versioning (`/v1`, `/v2`)

## Resource Model

The API covers course discovery, evaluation, recommendation, and analytics capabilities required by the current user stories.

### Users Resource

- **Endpoint Root**: `/users`
- **Description**: Authenticated NaUKMA accounts with associated roles.
- **Key Attributes**: `id`, `email`, `role`, `createdAt`
- **Relationships**: Owns at most one student profile.
- **Typical Operations**: `GET /users/me` to retrieve the current user, session lifecycle handled via `/auth/*` endpoints.

### Students Resource

- **Endpoint Root**: `/students`
- **Description**: Student records with academic metadata and evaluation progress.
- **Key Attributes**: `id`, `userId`, `firstName`, `lastName`, `educationLevel`, `overallRatedCourses`, `ratedCoursesThisSem`
- **Relationships**: Linked to enrollments and ratings, receives recommendations.
- **Typical Operations**: `GET /students/me` for profile, `GET /students/me/progress` for completion stats, `GET /students/me/ratings` for history, `GET /students/me/evaluations` for checklist.

### Courses Resource

- **Endpoint Root**: `/courses`
- **Description**: Course catalog entries enriched with aggregated rating metrics and filter facets.
- **Key Attributes**: `id`, `code`, `title`, `status`, `typeKind`, `avgDifficulty`, `avgUsefulness`, `ratingsCount`, `faculty`, `department`, `specialties`
- **Relationships**: Has many ratings, offerings, and related recommendations.
- **Typical Operations**: `GET /courses` for listing with filters (response embeds available filter facets), `GET /courses/{courseId}` for details.

### Ratings Resource

- **Endpoint Root**: `/courses/{courseId}/ratings`
- **Description**: Difficulty/usefulness evaluations created by students.
- **Key Attributes**: `id`, `difficulty`, `usefulness`, `comment`, `createdAt`
- **Relationships**: Belongs to students, contributes to course aggregates.
- **Typical Operations**: `GET /courses/{courseId}/ratings` for anonymized reviews, `POST /courses/{courseId}/ratings` for creating new ratings, `PATCH /courses/{courseId}/ratings/{ratingId}` and `DELETE /courses/{courseId}/ratings/{ratingId}` for mutating existing ratings. These mutation endpoints require ownership/authorization checks - only the student who created the rating may update or delete it.

### Recommendations Resource

- **Endpoint Roots**: `/students/me/recommendations`, `/courses/{courseId}/recommendations`
- **Description**: Personalized or contextual course suggestions.
- **Key Attributes**: `courseId`, `score`, `reason`, `context`
- **Typical Operations**: `GET` on either endpoint returns relevant recommendation lists.

### Evaluation Progress Resource

- **Endpoint Root**: `/students/me/evaluations`
- **Description**: Tracks completed vs. pending course evaluations per semester.
- **Key Attributes**: `courseId`, `semester`, `rated`, `completionPercent`
- **Typical Operations**: `GET /students/me/evaluations` with `semesterId`/`rated` filters to drive checklist UX.

### Analytics Resource

- **Endpoint Root**: `/analytics`
- **Description**: Data projections for scatter plot visualization.
- **Key Attributes**: `id`, `avg_usefulness`, `avg_difficulty`, `ratings_count`, `name`, `faculty_name` - per course.
- **Typical Operations**: `GET /analytics/` for student scatter view.
- **Filtering**: Is supported by the same filters as the courses list endpoint.
- **Pagination**: Disabled.

## Design Decisions

### Filters Delivery

- Filter options displayed on the courses and scatter-plot views are returned alongside primary payloads (`filters` metadata) instead of dedicated endpoints, reducing round-trips while keeping data dynamic.

### Pagination Strategy

- Offset-based pagination (`page`, `pageSize`) is used across list endpoints for predictable UX and simpler integration with existing UI components.
- Default `pageSize` is 20 with a maximum of 100 to balance response size and latency.

### Rating Anonymity & Ownership

- Ratings never expose student identifiers; mutation endpoints rely on the authenticated subject for ownership checks.
- Aggregated course metrics are recalculated asynchronously to keep reads fast while guaranteeing eventual consistency for averages and counts.

### Session-Based Security

- Microsoft OIDC login exchanges codes for server-side sessions; the backend issues HttpOnly cookies and CSRF tokens validated by the authentication middleware (see component diagram).
- Session cookies simplify SPA integration with the existing Django stack while protecting against XSS/CSRF through HttpOnly flags and double-submit token strategy.

### Access Control

- Microsoft OIDC provides identity proofing; session state stores the user identifier and role used by the API gateway for authorization.
- All student-centric endpoints require authenticated student role.

### Error Handling Contract

The API follows a standardized error response format based on Django REST Framework conventions. All errors return consistent JSON responses with clear status codes and human-readable messages.

#### Error Response Format

All errors return JSON responses with the following structure:

```json
{
  "detail": "Human-readable error description",
  "status": 400,
  "fields": {
    "fieldName": ["Field-specific validation errors"]
  }
}
```

**Response Fields:**

- **detail** (string, required): Human-readable description of the error suitable for display in UI
- **status** (number, required): HTTP status code matching the response status
- **fields** (object, optional): Object containing field-level validation errors, where keys are field names and values are arrays of error messages

#### Common Error Types

##### Validation Errors (400)

```json
{
  "detail": "Validation failed",
  "status": 400,
  "fields": {
    "email": ["This field is required"],
    "rating": ["Ensure this value is between 1 and 5"]
  }
}
```

##### Authentication Errors (401)

```json
{
  "detail": "Authentication credentials were not provided",
  "status": 401
}
```

##### Authorization Errors (403)

```json
{
  "detail": "You do not have permission to perform this action",
  "status": 403
}
```

##### Not Found Errors (404)

```json
{
  "detail": "Course not found",
  "status": 404
}
```

#### Standard Status Codes

| Status Code | Usage                 | Example Scenarios                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------- |
| **200**     | Success               | GET requests completed successfully                                  |
| **201**     | Created               | POST requests that create resources                                  |
| **204**     | No Content            | DELETE requests, successful updates with no response body            |
| **400**     | Bad Request           | Validation failures, malformed request data, missing required fields |
| **401**     | Unauthorized          | Missing or invalid authentication, session expired                   |
| **403**     | Forbidden             | Insufficient permissions, accessing another user's data              |
| **404**     | Not Found             | Requested resource does not exist                                    |
| **405**     | Method Not Allowed    | Using GET on a POST-only endpoint                                    |
| **429**     | Too Many Requests     | Rate limiting exceeded                                               |
| **500**     | Internal Server Error | Unexpected server errors, database failures                          |

#### Client Implementation Guidelines

1. **Always check the HTTP status code first** - it provides the most reliable error categorization
2. **Use the `detail` field for user-facing error messages** - these are designed to be human-readable
3. **Handle field-level validation errors** - when `fields` is present, display errors next to the corresponding form fields
4. **Implement retry logic** - for 5xx errors and 429 rate limiting, implement exponential backoff
5. **Handle authentication errors** - redirect users to login flow on 401 responses

This standardized format enables consistent client-side error handling and retry semantics across all API endpoints.
