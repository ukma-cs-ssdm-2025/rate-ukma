# Requirements Traceability Analysis

This document provides a detailed analysis of each requirement in the traceability matrix, mapping it to actual implementation in the codebase.

**Generated:** 2025-12-02  
**Repository:** rate-ukma  
**Scope:** Full codebase analysis for requirement coverage

---

## Summary Statistics

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Fully Covered | 10 | 83.3% |
| ⚠️ Partially Covered | 1 | 8.3% |
| ❌ Not Implemented | 1 | 8.3% |

### Changes Since Previous Analysis (Nov 18, 2025)

| Requirement | Previous | Current | Change |
|-------------|----------|---------|--------|
| FR-009 (Scatter Plot) | ❌ Missing | ✅ Covered | **+** Full implementation |
| FR-006/FR-007 (Rating Forms) | ⚠️ Partial | ✅ Covered | **+** Frontend forms added |
| FR-011 (Student Progress) | ⚠️ Partial | ✅ Covered | **+** Full UI implementation |
| Overall Coverage | 66.7% | 91.7% | **+25%** |

---

## FR-001: Login with Corporate Email

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/auth/microsoft_account_adapters.py`
  - Lines 17-18: `ALLOWED_DOMAINS = ["ukma.edu.ua"]` enforces corporate email restriction
  - Lines 27-44: `pre_social_login()` handles OAuth authentication flow
  - Lines 64-65: `_is_email_allowed()` validates email domain

- **File:** `src/backend/rating_app/views/auth.py`
  - Lines 23-43: `microsoft_login()` view initiates Microsoft OAuth2
  - Lines 63-92: `login()` view with session authentication
  - Lines 94-108: `logout()` view

- **File:** `src/backend/rateukma/settings/_base.py`
  - Lines 66-69: Authentication backends for allauth
  - Lines 208-232: Microsoft OAuth2 provider configuration

#### Frontend
- **File:** `src/webapp/src/components/login/MicrosoftLoginButton.tsx`
- **File:** `src/webapp/src/lib/auth/AuthContext.tsx`
- **File:** `src/webapp/src/lib/auth/withAuth.tsx`
- **File:** `src/webapp/src/routes/login.index.tsx`

#### Tests
- **File:** `src/backend/rating_app/auth/test_oauth_integration.py` - OAuth integration tests

### NFR Coverage
- **NFR-S-001:** ✅ Domain validation enforced
- **NFR-S-003:** ⚠️ Session timeout not explicitly configured (using Django defaults)
- **NFR-U-001:** ✅ Simple OAuth flow

---

## FR-002: Browse Courses with Pagination

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/views/course_viewset.py`
  - Lines 41-159: `list()` method with pagination support

- **File:** `src/backend/rating_app/repositories/course_repository.py`
  - Lines 28-126: `filter()` method with Django Paginator

#### Frontend
- **File:** `src/webapp/src/routes/index.tsx`
  - Complete course browsing page with pagination
  - Lines 17-20: Filter state including page and page_size
  - Line 22: API integration with `useCoursesList(filters)`

- **File:** `src/webapp/src/features/courses/components/CoursesTable.tsx`
  - Full table implementation with pagination controls

#### Tests
- **File:** `src/webapp/src/features/courses/components/CoursesTable.test.tsx`

---

## FR-003: Display Course Metadata

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/models/course.py`
  - Course model with title, description, department, status

- **File:** `src/backend/rating_app/repositories/course_repository.py`
  - Lines 16-26: `get_by_id()` with complete relations and aggregations

#### Frontend
- **File:** `src/webapp/src/routes/courses.$courseId.tsx`
  - Complete course detail page with metadata display

- **File:** `src/webapp/src/features/courses/components/CourseDetailsHeader.tsx`
- **File:** `src/webapp/src/features/courses/components/CourseStatsCards.tsx`

---

## FR-004: Search Courses by Name

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/repositories/course_repository.py`
  - Line 59: `q_filters["title__icontains"] = filters.name` - Case-insensitive search

- **File:** `src/backend/rating_app/filters/course_filters.py`
  - Line 9: `name: str | None = None`

#### Frontend
- **File:** `src/webapp/src/features/courses/components/CourseFiltersPanel.tsx`
  - Search input with real-time filtering

#### Tests
- **File:** `src/webapp/src/features/courses/components/CourseFiltersPanel.test.tsx`

---

## FR-005: Filter Courses by Attributes

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/filters/course_filters.py`
  - Lines 8-20: Complete filter dataclass with all attributes
  - Supports: type_kind, instructor, faculty, department, speciality, semester_year, semester_term

- **File:** `src/backend/rating_app/repositories/course_repository.py`
  - Lines 56-76: Complete filter application logic
  - Lines 79-105: Sorting with rating aggregations

#### Frontend
- **File:** `src/webapp/src/features/courses/components/CourseFiltersPanel.tsx`
- **File:** `src/webapp/src/features/courses/filterSchema.ts`
- **File:** `src/webapp/src/features/courses/filterTransformations.ts`
- **File:** `src/webapp/src/features/courses/urlSync.ts`

#### Tests
- **File:** `src/webapp/src/features/courses/filterTransformations.test.ts`
- **File:** `src/webapp/src/features/courses/urlSync.test.ts`
- **File:** `src/webapp/src/features/courses/hooks/useCourseFiltersData.test.ts`

---

## FR-006: Submit Ratings and Reviews

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/models/rating.py`
  - Lines 11-21: Rating model with difficulty, usefulness, comment, is_anonymous

- **File:** `src/backend/rating_app/services/rating_service.py`
  - Lines 15-42: `create_rating()` with validation

- **File:** `src/backend/rating_app/views/rating_viewset.py`
  - Lines 103-144: `create()` view for rating submission

#### Frontend
- **File:** `src/webapp/src/features/ratings/components/RatingForm.tsx` (211 lines)
  - Complete rating form with difficulty/usefulness sliders
  - Anonymous submission support
  - Comment field

- **File:** `src/webapp/src/features/ratings/components/RatingModal.tsx` (142 lines)
  - Modal wrapper for rating submission

- **File:** `src/webapp/src/features/ratings/components/RatingButton.tsx` (72 lines)
  - Button to trigger rating flow

- **File:** `src/webapp/src/features/ratings/definitions/ratingDefinitions.ts`
  - Rating scale definitions and descriptions

#### Tests
- **File:** `src/webapp/tests/e2e/rating/rate-course.test.ts` (65 lines)
- **File:** `src/webapp/tests/e2e/components/rating-modal.ts` (184 lines)

---

## FR-007: Edit/Delete Own Feedback

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/views/rating_viewset.py`
  - Lines 159-194: `update()` method
  - Lines 195-236: `partial_update()` method
  - Lines 238-260: `destroy()` method
  - Lines 50-51: `_check_ownership()` verification

- **File:** `src/backend/rating_app/services/rating_service.py`
  - Lines 57-63: `update_rating()`
  - Lines 65-67: `delete_rating()`

#### Frontend
- **File:** `src/webapp/src/features/ratings/components/DeleteRatingDialog.tsx`
  - Confirmation dialog for rating deletion

- **File:** `src/webapp/src/features/ratings/components/MyRatingCard.tsx`
  - Edit/delete controls on rating cards

- **File:** `src/webapp/src/features/ratings/components/MyRatingCard/RatingCardHeader.tsx`
- **File:** `src/webapp/src/features/ratings/components/MyRatingCard/RatingCommentDisplay.tsx`
- **File:** `src/webapp/src/features/ratings/components/MyRatingCard/RatingMetric.tsx`

#### Tests
- **File:** `src/webapp/tests/e2e/rating/rate-course.test.ts`

---

## FR-008: Display Aggregated Ratings and Reviews

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/repositories/course_repository.py`
  - Lines 21-24: Aggregation with avg_difficulty, avg_usefulness, ratings_count

- **File:** `src/backend/rating_app/views/rating_viewset.py`
  - Lines 81-101: `list()` returns paginated ratings

#### Frontend
- **File:** `src/webapp/src/features/ratings/components/CourseRatingsList.tsx`
  - Infinite scroll implementation for ratings

- **File:** `src/webapp/src/features/ratings/components/RatingCard.tsx`
  - Individual rating display

- **File:** `src/webapp/src/features/courses/components/CourseStatsCards.tsx`
  - Aggregated statistics display

#### Tests
- **File:** `src/webapp/tests/e2e/rating/view-ratings.test.ts` (35 lines)

---

## FR-009: Interactive Scatter Plot

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Frontend
- **File:** `src/webapp/src/features/courses/components/CoursesScatterPlot.tsx` (676 lines)
  - Full scatter plot implementation using @visx library
  - Lines 1-14: Imports for @visx/axis, @visx/grid, @visx/scale, @visx/tooltip
  - Interactive tooltips with course metadata
  - Zoom and pan functionality with d3-zoom
  - Faculty-based color coding
  - Click navigation to course detail pages

- **File:** `src/webapp/src/features/courses/components/scatterLabeling.ts`
  - Label computation and positioning

- **File:** `src/webapp/src/routes/explore.tsx` (216 lines)
  - Dedicated explore page with scatter plot
  - Filter integration
  - URL state synchronization

#### Features Implemented
- ✅ Scatter plot rendering (difficulty vs usefulness axes)
- ✅ Interactive tooltips showing course metadata on hover
- ✅ Click navigation to course pages
- ✅ Filter integration (applies course filters to plot)
- ✅ Faculty-based color coding
- ✅ Zoom and pan controls
- ✅ Responsive design

---

## FR-010: Personalized Course Recommendations

**Status:** ❌ **NOT IMPLEMENTED**

### Analysis
No recommendation system found in the codebase.

**Searched locations:**
- Backend services: No `recommendation_service.py`
- No recommendation algorithms
- No recommendation API endpoints
- No frontend recommendation components

---

## FR-011: Student Evaluation History and Progress

**Status:** ✅ **COVERED**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/models/student.py`
  - Lines 50-52: `overall_rated_courses` property
  - Lines 54-65: `rated_courses_this_sem` property

- **File:** `src/backend/rating_app/views/student_viewset.py`
  - Lines 24-31: `get_ratings()` endpoint
  - Lines 39-46: `get_detailed_ratings()` endpoint

- **File:** `src/backend/rating_app/services/student_service.py`
- **File:** `src/backend/rating_app/services/test_student_service.py`

#### Frontend
- **File:** `src/webapp/src/routes/my-ratings.tsx` (265 lines)
  - Full my-ratings page implementation
  - Groups ratings by year and semester
  - Shows progress (rated/total courses)
  - Integration with backend APIs

- **File:** `src/webapp/src/features/ratings/components/MyRatingsHeader.tsx`
  - Header with progress statistics

- **File:** `src/webapp/src/features/ratings/components/MyRatingsEmptyState.tsx`
  - Empty state handling

- **File:** `src/webapp/src/features/ratings/components/MyRatingsErrorState.tsx`
  - Error state handling

- **File:** `src/webapp/src/features/ratings/components/MyRatingsSkeleton.tsx`
  - Loading skeleton

#### Tests
- **File:** `src/webapp/tests/e2e/rating/no-ratings.test.ts` (26 lines)
- **File:** `src/webapp/tests/e2e/components/my-ratings-page.ts` (31 lines)

---

## FR-012: Administrator Evaluation Statistics

**Status:** ⚠️ **PARTIAL**

### Implementation Evidence

#### Backend
- **File:** `src/backend/rating_app/admin/models.py`
  - Lines 20-61: CourseAdmin with aggregated statistics
  - Lines 190-214: RatingAdmin with filtering

- **File:** `src/backend/rating_app/views/analytics.py`
  - Analytics API endpoints

#### Gap Analysis
- ✅ Django admin provides statistics
- ✅ Analytics API exists
- ❌ No dedicated admin dashboard frontend
- ❌ No custom admin UI

---

## Architecture & Quality

### ADR Compliance
- **ADR-0001 (N-tier Architecture):** ✅ Verified
- **ADR-0002 (Deployment Strategy):** ✅ Verified (staging/production URLs active)
- **ADR-0003 (Technology Stack):** ✅ Verified
- **ADR-0004 (API Format):** ✅ Verified

### Testing Coverage
- Backend unit tests: 40+ test files
- Frontend unit tests: 7+ test files
- E2E tests: 4 test suites for ratings

### New Components Since Last Analysis
1. **Scatter Plot Visualization** - Full @visx implementation
2. **Rating Forms** - Create/Edit/Delete with validation
3. **My Ratings Page** - Complete student progress view
4. **Course Offerings** - Backend service and views
5. **Faculty Colors** - Dynamic color system
6. **Filter URL Sync** - State persistence in URL

---

## Recommendations

### High Priority
1. **Implement FR-010 (Recommendations)** - Only missing major feature
   - Design recommendation algorithm
   - Create backend service
   - Add frontend components

### Medium Priority
2. **Complete FR-012 (Admin Dashboard)**
   - Create custom admin UI
   - Leverage existing analytics API

3. **Configure Session Timeout (NFR-S-003)**
   - Add `SESSION_COOKIE_AGE = 1800` to settings

### Low Priority
4. **Performance monitoring**
5. **Caching strategy**

---

**Analysis Completed:** 2025-12-02  
**Analyst:** GitHub Copilot
