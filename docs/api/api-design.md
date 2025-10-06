# API Design Documentation

## Architecture Overview

- **Base URL**: `http://localhost:3000/api/v1`
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
- **Typical Operations**: `GET /courses/{courseId}/ratings` for anonymized reviews, `POST`/`PATCH`/`DELETE` on the same collection for student-owned feedback.

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

- **Endpoint Roots**: `/analytics/course-scatter`
- **Description**: Data projections for scatter plot visualization.
- **Key Attributes**: scatter coordinates, rating totals, time-series points.
- **Typical Operations**: `GET /analytics/course-scatter` for student scatter view.

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
