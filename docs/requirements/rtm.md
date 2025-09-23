# Requirements Traceability Matrix
This document defines the **Requirements Traceability Matrix** for the *Rate UKMA* system.

See also: [requirements.md](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/main/docs/requirements/requirements.md)



| **User Story ID** | **Requirement ID** | **Requirement Description** | **Non-Functional Requirement ID** | **Potential Test Case** | 
|-------------|---------------|----------------------------------------------------------------|----------------------------|--------------------------------------------------------------------------------|
|[US-001](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-001-login-with-corporate-email) |FR-001 |Login with corporate email |NFR-S-001 |Test-01: Authenticated user accesses protected page |
| |FR-001 |Login with corporate email |NFR-S-001 |Test-02: User provides correct creditentials |
| |FR-001 |Login with corporate email |NFR-S-001 |Test-03: User provides incorrect creditentials |
| |FR-001 |Login with corporate email |NFR-S-003 |Test-04: Authenticated user is inactive for 30+ minutes |
|[US-002](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-002-course-browsing) |FR-002 |User browses courses |NFR-PE-001 |Test-01: 300 users access courses' list |
| |FR-002 |User browses courses |NFR-PE-002 |Test-02: 300 users paginate courses |
|[US-003](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-003-course-search) |FR-004 |User searches courses |NFR-PE-002 |Test-01: 300 users attempt course searching |
| |FR-004 |User searches courses |NFR-PE-002 |Test-02: Search for partial course name |
| |FR-004 |User searches courses |NFR-PE-002 |Test-03: Search with no match |
| |FR-004 |User searches courses |NFR-PE-002 , NFR-RB-001 |Test-04: Clear search input |
| |FR-004 |User searches courses |NFR-PE-002 |Test-05: Case-insensitive search |
|[US-004](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-004-course-filtering) |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-01: 300 users attempt filtering queries |
| |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-02: No filter search |
| |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-03: Search + filters |
| |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-04: Filter with no match |
| |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-05: Separate filters |
| |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-06: Multiple filters at the same time |
| |FR-005 |User applies filters to list of courses |NFR-PE-002 |Test-07: Clear filters |
|[US-005](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-005-scatter-plot-of-courses) |FR-009 |User sees/interacts with scatter plot of courses |NFR-PE-003 |Test-01: 300 users attempt rendering scatter plot |
| |FR-009 |User sees/interacts with scatter plot of courses |NFR-PE-004 |Test-02: 300 users attempt rendering scatter plot with filters applied |
| |FR-009 |User sees/interacts with scatter plot of courses |NFR-PE-004 |Test-03: Apply filter returning zero courses |
| |FR-009 |User sees/interacts with scatter plot of courses |NFR-PE-003 |Test-04: Hovering over points to display metadata |
| |FR-009 |User sees/interacts with scatter plot of courses |NFR-PE-003 |Test-05: Navigate to the course's page via point |
|[US-006](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-006-course-ratings-and-reviews-on-course-page) |FR-003 / FR-008 |User sees course's page (inc. metadata, ratings) |NFR-PE-001 |Test-01: 300 users access courses' pages |
| |FR-003 / FR-008 |User sees course's page (inc. metadata, ratings) |NFR-U-002 |Test-02: Automated readability |
| |FR-003 / FR-008 |User sees course's page (inc. metadata, ratings) |NFR-U-002 |Test-03: UI desktop |
| |FR-003 / FR-008 |User sees course's page (inc. metadata, ratings) |NFR-U-002 |Test-04: UI mobile |
| |FR-003 / FR-008 |User sees course's page (inc. metadata, ratings) |NFR-R-004 |Test-05: Course ratings display correctly after backup restoration |
|[US-007](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-007-course-recommendations-on-course-page) |FR-010 |User sees personalized course recommendation on course's page |NFR-RB-001 |Test-01: Not enough rating/enroll data for proper algorithm work |
|[US-008](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-008-course-recommendations-on-home-page) |FR-010 |User sees personalized course recommendation on home page |NFR-RB-001 |Test-01: User has not rated any course yet |
|[US-009](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-009-course-grading) |FR-006 |Student submits ratings and optional reviews |NFR-R-001 |Test-01: User submits a rating |
| |FR-006 |Student submits ratings and optional reviews |NFR-R-003 |Test-02: Submission failure occurs during rating/review submission |
| |FR-006 |Student submits ratings and optional reviews |NFR-S-002 |Test-03: User submits review anonymously |
| |FR-007 |Student submits ratings and optional reviews |NFR-R-001 |Test-04: User edits an existing review |
| |FR-007 |Student submits ratings and optional reviews |NFR-R-003 |Test-05: User deletes an existing review |
| |FR-007 |Student submits ratings and optional reviews |NFR-R-004 |Test-06: Daily backup includes newly submitted ratings and comments|
|[US-010](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-010-students-total-evaluated-courses) |FR-011 |Student sees his overall progress in course rating |NFR-PE-001 |Test-01: 300 users attempt viewing their profile |
| |FR-011 |Student sees his progress in course rating |NFR-R-001 |Test-02: Verify that no ratings or feedback data are lost when loading profile |
| |FR-011 |Student sees his progress in course rating |NFR-RB-001 |Test-03: Student has not rated any courses yet |
| |FR-011 |Student sees his progress in course rating |NFR-R-004 |Test-04: Student progress data is recoverable from daily backups |
|[US-011](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-011-students-evaluated-courses-per-semester) |FR-011 |Student sees information about courses rated in current semester |NFR-PE-001 |Test-01: 300 students opens ratings page |
| |FR-011 |Student sees information about courses rated in current semester |NFR-U-002 |Test-02: Progress bar visible and readable on desktop/mobile |
| |FR-011 |Student sees information about courses rated in current semester |NFR-PE-004 |Test-03: Filter updates results < 1.5 sec |
|[US-012](https://github.com/ukma-cs-ssdm-2025/rate-ukma/blob/docs/%2314-add-requirements-traceability-matrix/docs/requirements/user-stories.md#us-012-course-evaluation-statistics-for-admin) |FR-012 |Admin sees evaluating statistics |NFR-PE-001 |Test-01: Admin opens statistics page |
| |FR-012 |Admin sees evaluating statistics |NFR-PE-004 |Test-02: Admin applies filters on statistics |
| |FR-012 |Admin sees evaluating statistics |NFR-PE-004 |Test-03: Statistics include data restored from backups. |
