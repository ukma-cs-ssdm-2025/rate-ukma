# Requirements Traceability Matrix

This document defines the **Requirements Traceability Matrix** for the *Rate UKMA* system.

See also:

- [requirements.md](./requirements.md)
- [user-stories.md](./user-stories.md)
- [component-diagram.puml](../architecture/uml/component-diagram.puml)

| **User Story ID** | **Requirement ID** | **Requirement Description** | **Non-Functional Requirement ID** | **Potential Test Case** | **Component** |
|-------------|---------------|----------------------------------------------------------------|----------------------------|--------------------------------------------------------------------------------|-------------|
|[US-001](./user-stories.md#us-001-login-with-corporate-email) |[FR-001](./requirements.md#fr-001) |Login with corporate email |[NFR-S-001](./requirements.md#nfr-s-001) |Test-01: Authenticated user accesses protected page | WebApp, AuthMiddleware, MicrosoftOIDC |
| |[FR-001](./requirements.md#fr-001) |Login with corporate email |[NFR-S-001](./requirements.md#nfr-s-001) |Test-02: User provides correct credentials | WebApp, AuthMiddleware, MicrosoftOIDC |
| |[FR-001](./requirements.md#fr-001) |Login with corporate email |[NFR-S-001](./requirements.md#nfr-s-001) |Test-03: User provides incorrect credentials | WebApp, AuthMiddleware, MicrosoftOIDC |
| |[FR-001](./requirements.md#fr-001) |Login with corporate email |[NFR-S-003](./requirements.md#nfr-s-003) |Test-04: Authenticated user is inactive for 30+ minutes | WebApp, AuthMiddleware, MicrosoftOIDC |
| |[FR-001](./requirements.md#fr-001) |Login with corporate email |[NFR-U-001](./requirements.md#nfr-u-001) |Test-05: Most first-time users (9/10) spend less than 3 minutes logging in| WebApp, AuthMiddleware, MicrosoftOIDC |
| |[FR-001](./requirements.md#fr-001) |Login with corporate email | [NFR-R-002](./requirements.md#nfr-r-002) | Test-06: Monitor login endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, AuthMiddleware, MicrosoftOIDC |
|[US-002](./user-stories.md#us-002-course-browsing) |[FR-002](./requirements.md#fr-002) |User browses courses |[NFR-PE-001](./requirements.md#nfr-pe-001) |Test-01: 300 users access courses' list | WebApp, CourseService |
| |[FR-002](./requirements.md#fr-002) |User browses courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-02: 300 users paginate courses | WebApp, CourseService |
|[US-003](./user-stories.md#us-003-course-search) |[FR-004](./requirements.md#fr-004) |User searches courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-01: 300 users attempt course searching | WebApp, CourseService |
| |[FR-004](./requirements.md#fr-004) |User searches courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-02: Search for partial course name | WebApp, CourseService |
| |[FR-004](./requirements.md#fr-004) |User searches courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-03: Search with no match | WebApp, CourseService |
| |[FR-004](./requirements.md#fr-004) |User searches courses |[NFR-PE-002](./requirements.md#nfr-pe-002) , [NFR-RB-001](./requirements.md#nfr-rb-001) |Test-04: Clear search input | WebApp, CourseService |
| |[FR-004](./requirements.md#fr-004) |User searches courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-05: Case-insensitive search | WebApp, CourseService |
| |[FR-004](./requirements.md#fr-004) |User searches courses | [NFR-R-002](./requirements.md#nfr-r-002) | Test-06: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, CourseService |
|[US-004](./user-stories.md#us-004-course-filtering) |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-01: 300 users attempt filtering queries | WebApp, CourseService |
| |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-02: No filter search | WebApp, CourseService |
| |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-03: Search + filters | WebApp, CourseService |
| |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-04: Filter with no match | WebApp, CourseService |
| |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-05: Separate filters | WebApp, CourseService |
| |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-06: Multiple filters at the same time | WebApp, CourseService |
| |[FR-005](./requirements.md#fr-005) |User applies filters to list of courses |[NFR-PE-002](./requirements.md#nfr-pe-002) |Test-07: Clear filters | WebApp, CourseService |
|[US-005](./user-stories.md#us-005-scatter-plot-of-courses) |[FR-009](./requirements.md#fr-009) |User sees/interacts with scatter plot of courses |[NFR-PE-003](./requirements.md#nfr-pe-003) |Test-01: 300 users attempt rendering scatter plot | WebApp, RatingService, CourseService |
| |[FR-009](./requirements.md#fr-009) |User sees/interacts with scatter plot of courses |[NFR-PE-004](./requirements.md#nfr-pe-004) |Test-02: 300 users attempt rendering scatter plot with filters applied | WebApp, RatingService, CourseService |
| |[FR-009](./requirements.md#fr-009) |User sees/interacts with scatter plot of courses |[NFR-PE-004](./requirements.md#nfr-pe-004) |Test-03: Apply filter returning zero courses | WebApp, RatingService, CourseService |
| |[FR-009](./requirements.md#fr-009) |User sees/interacts with scatter plot of courses |[NFR-PE-003](./requirements.md#nfr-pe-003) |Test-04: Hovering over points to display metadata | WebApp, RatingService, CourseService |
| |[FR-009](./requirements.md#fr-009) |User sees/interacts with scatter plot of courses |[NFR-PE-003](./requirements.md#nfr-pe-003) |Test-05: Navigate to the course's page via point | WebApp, RatingService, CourseService |
| |[FR-009](./requirements.md#fr-009) |User sees/interacts with scatter plot of courses | [NFR-R-002](./requirements.md#nfr-r-002) | Test-06: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, RatingService, CourseService |
|[US-006](./user-stories.md#us-006-course-ratings-and-reviews-on-course-page) |[FR-003](./requirements.md#fr-003) / [FR-008](./requirements.md#fr-008) |User sees course's page (inc. metadata, ratings) |[NFR-PE-001](./requirements.md#nfr-pe-001) |Test-01: 300 users access courses' pages | WebApp, CourseService, RatingService |
| |[FR-003](./requirements.md#fr-003) / [FR-008](./requirements.md#fr-008) |User sees course's page (inc. metadata, ratings) |[NFR-U-002](./requirements.md#nfr-u-002) |Test-02: Automated readability | WebApp, CourseService, RatingService |
| |[FR-003](./requirements.md#fr-003) / [FR-008](./requirements.md#fr-008) |User sees course's page (inc. metadata, ratings) |[NFR-U-002](./requirements.md#nfr-u-002) |Test-03: UI desktop | WebApp, CourseService, RatingService |
| |[FR-003](./requirements.md#fr-003) / [FR-008](./requirements.md#fr-008) |User sees course's page (inc. metadata, ratings) |[NFR-U-002](./requirements.md#nfr-u-002) |Test-04: UI mobile | WebApp, CourseService, RatingService |
| |[FR-003](./requirements.md#fr-003) / [FR-008](./requirements.md#fr-008) |User sees course's page (inc. metadata, ratings) |[NFR-R-004](./requirements.md#nfr-r-004) |Test-05: Course ratings display correctly after backup restoration | WebApp, CourseService, RatingService |
| |[FR-003](./requirements.md#fr-003) / [FR-008](./requirements.md#fr-008) |User sees course's page (inc. metadata, ratings) |[NFR-R-002](./requirements.md#nfr-r-002) | Test-06: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, CourseService, RatingService |
|[US-007](./user-stories.md#us-007-course-recommendations-on-course-page) |[FR-010](./requirements.md#fr-010) |User sees personalized course recommendation on course's page |[NFR-RB-001](./requirements.md#nfr-rb-001) |Test-01: Not enough rating/enroll data for proper algorithm work | WebApp, RecommendationService |
|[US-008](./user-stories.md#us-008-course-recommendations-on-home-page) |[FR-010](./requirements.md#fr-010) |User sees personalized course recommendation on home page |[NFR-RB-001](./requirements.md#nfr-rb-001) |Test-01: User has not rated any course yet | WebApp, RecommendationService |
|[US-009](./user-stories.md#us-009-course-grading) |[FR-006](./requirements.md#fr-006) |Student submits ratings and optional reviews |[NFR-R-001](./requirements.md#nfr-r-001) |Test-01: User submits a rating | WebApp, RatingService |
| |[FR-006](./requirements.md#fr-006) |Student submits ratings and optional reviews |[NFR-R-003](./requirements.md#nfr-r-003) |Test-02: Submission failure occurs during rating/review submission | WebApp, RatingService |
| |[FR-006](./requirements.md#fr-006) |Student submits ratings and optional reviews |[NFR-S-002](./requirements.md#nfr-s-002) |Test-03: User submits review anonymously | WebApp, RatingService |
| |[FR-007](./requirements.md#fr-007) |Student submits ratings and optional reviews |[NFR-R-001](./requirements.md#nfr-r-001) |Test-04: User edits an existing review | WebApp, RatingService |
| |[FR-007](./requirements.md#fr-007) |Student submits ratings and optional reviews |[NFR-R-003](./requirements.md#nfr-r-003) |Test-05: User deletes an existing review | WebApp, RatingService |
| |[FR-007](./requirements.md#fr-007) |Student submits ratings and optional reviews |[NFR-R-004](./requirements.md#nfr-r-004) |Test-06: Daily backup includes newly submitted ratings and comments| WebApp, RatingService |
| |[FR-007](./requirements.md#fr-007) |Student submits ratings and optional reviews | [NFR-R-002](./requirements.md#nfr-r-002) | Test-07: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, RatingService |
|[US-010](./user-stories.md#us-010-students-total-evaluated-courses) |[FR-011](./requirements.md#fr-011) |Student sees his overall progress in course rating |[NFR-PE-001](./requirements.md#nfr-pe-001) |Test-01: 300 users attempt viewing their profile | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees his progress in course rating |[NFR-R-001](./requirements.md#nfr-r-001) |Test-02: Verify that no ratings or feedback data are lost when loading profile | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees his progress in course rating |[NFR-RB-001](./requirements.md#nfr-rb-001) |Test-03: Student has not rated any courses yet | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees his progress in course rating |[NFR-R-004](./requirements.md#nfr-r-004) |Test-04: Student progress data is recoverable from daily backups | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees his progress in course rating | [NFR-R-002](./requirements.md#nfr-r-002) | Test-05: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, UserService, RatingService |
|[US-011](./user-stories.md#us-011-students-evaluated-courses-per-semester) |[FR-011](./requirements.md#fr-011) |Student sees information about courses rated in current semester |[NFR-PE-001](./requirements.md#nfr-pe-001) |Test-01: 300 students opens ratings page | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees information about courses rated in current semester |[NFR-U-002](./requirements.md#nfr-u-002) |Test-02: Progress bar visible and readable on desktop/mobile | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees information about courses rated in current semester |[NFR-PE-004](./requirements.md#nfr-pe-004) |Test-03: Filter updates results < 1.5 sec | WebApp, UserService, RatingService |
| |[FR-011](./requirements.md#fr-011) |Student sees information about courses rated in current semester| [NFR-R-002](./requirements.md#nfr-r-002) | Test-04: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, UserService, RatingService |
|[US-012](./user-stories.md#us-012-course-evaluation-statistics-for-admin) |[FR-012](./requirements.md#fr-012) |Admin sees evaluating statistics |[NFR-PE-001](./requirements.md#nfr-pe-001) |Test-01: Admin opens statistics page | WebApp, RatingService, CourseService |
| |[FR-012](./requirements.md#fr-012) |Admin sees evaluating statistics |[NFR-PE-004](./requirements.md#nfr-pe-004) |Test-02: Admin applies filters on statistics | WebApp, RatingService, CourseService |
| |[FR-012](./requirements.md#fr-012) |Admin sees evaluation statistics |[NFR-R-004](./requirements.md#nfr-r-004) |Test-03: Statistics include data restored from backups. | WebApp, RatingService, CourseService |
| |[FR-012](./requirements.md#fr-012) |Admin sees evaluating statistics | [NFR-R-002](./requirements.md#nfr-r-002) |Test-04: Monitor endpoint for 14 days; ensure ≥ 99.5% availability | WebApp, RatingService, CourseService |
