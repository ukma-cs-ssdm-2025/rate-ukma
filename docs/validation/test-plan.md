# Rate UKMA Test Plan

## General Information

**Version:** 1.0  
**Date:** 23.10.2025  
**Status:** Draft  

This document describes the testing plan for the Rate UKMA system according to the requirements defined in [requirements.md](../requirements/requirements.md) and the testing strategy described in [testing-strategy.md](../testing/testing-strategy.md).

## Testing Levels

Testing will be conducted at the following levels according to the testing pyramid:

- **Unit Tests (60%)** - testing individual components and functions
- **Integration Tests (30%)** - testing interactions between components
- **End-to-End Tests (10%)** - testing complete usage scenarios


## Test Coverage Requirements

- **Backend:** 75% line coverage, 60% branch coverage
- **Frontend:** 70% line coverage, 50% branch coverage
- **Critical Paths:** 90% coverage for authentication and rating processes


## Test Cases Description

| # | Component/Function | Test Level | Test Case | Type (Positive/Negative) | Expected Result / Acceptance Criteria (NFR) |
| --- | --- | --- | --- | --- | --- |
| 1 | Authentication (corporate login) | e2e | Valid corporate credentials authenticate and redirect to home | Positive | [US-001](../requirements/user-stories.md#us-001-login-with-corporate-email) |
| 2 | Authentication (invalid credentials) | e2e | Invalid email/password shows error | Negative | [US-001](../requirements/user-stories.md#us-001-login-with-corporate-email) |
| 3 | Auth Backend: corporate domain validation | unit | Non-corporate domain is rejected | Negative | [US-001](../requirements/user-stories.md#us-001-login-with-corporate-email) |
| 4 | Auth session timeout | integration | Session expires after inactivity | Positive | [NFR-S-003](../requirements/requirements.md#nfr-s-003) |
| 5 | Courses list (catalog) | e2e | Shows list with names and instructors | Positive | [US-002](../requirements/user-stories.md#us-002-course-browsing) |
| 6 | Courses list pagination | integration | Load more/scroll fetches additional courses | Positive | [US-002](../requirements/user-stories.md#us-002-course-browsing) |
| 7 | Courses list empty state | unit | Shows "No courses available" when none exist | Negative | [US-002](../requirements/user-stories.md#us-002-course-browsing) |
| 8 | Course details: metadata | integration | Displays name, professor, faculty, semester, credits | Positive | [FR-003](../requirements/requirements.md#fr-003) |
| 9 | Course page: aggregated ratings | e2e | Shows averages, counts, reviews | Positive | [US-006](../requirements/user-stories.md#us-006-course-ratings-and-reviews-on-course-page) |
| 10 | Course page: not rated yet | e2e | Shows message when no ratings | Negative | [US-006](../requirements/user-stories.md#us-006-course-ratings-and-reviews-on-course-page) |
| 11 | Search: partial match | e2e | Partial name shows matching courses | Positive | [US-003](../requirements/user-stories.md#us-003-course-search) |
| 12 | Search: no results | e2e | Shows "No courses found" | Negative | [US-003](../requirements/user-stories.md#us-003-course-search) |
| 13 | Search: clear input | integration | Clearing input restores full list | Positive | [US-003](../requirements/user-stories.md#us-003-course-search) |
| 14 | Filters: rating | integration | List updates by rating criterion | Positive | [US-004](../requirements/user-stories.md#us-004-course-filtering) |
| 15 | Filters: combine filters | integration | Items match all selected filters | Positive | [US-004](../requirements/user-stories.md#us-004-course-filtering) |
| 16 | Filters: no results state | e2e | Shows "No courses match your filters" | Negative | [US-004](../requirements/user-stories.md#us-004-course-filtering) |
| 17 | Submit rating: required fields | e2e | Difficulty and usefulness (1–5) saved | Positive | [US-009](../requirements/user-stories.md#us-009-course-grading) |
| 18 | Submit rating: validation | unit | Missing/invalid fields block submission | Negative | [US-009](../requirements/user-stories.md#us-009-course-grading) |
| 19 | Ratings anonymity | integration | Responses contain no PII | Positive | [NFR-S-002](../requirements/requirements.md#nfr-s-002) |
| 20 | Edit own feedback | e2e | Student can edit prior feedback | Positive | [US-009](../requirements/user-stories.md#us-009-course-grading) |
| 21 | Profile: total evaluated | integration | Total count visible on profile | Positive | [US-010](../requirements/user-stories.md#us-010-students-total-evaluated-courses) |
| 22 | Performance: page load | e2e | Courses page loads ≤ 1.5 sec | Positive | [NFR-PE-001](../requirements/requirements.md#nfr-pe-001) |
| 23 | Performance: search latency | integration | Results update ≤ 1 sec | Positive | [NFR-PE-002](../requirements/requirements.md#nfr-pe-002) |
| 24 | Reliability: auto-retry | integration | Retries up to 3 times on failure | Positive | [NFR-R-003](../requirements/requirements.md#nfr-r-003) |
| 25 | Reliability: backups restore | integration | Ratings/comments present after restore | Positive | [NFR-R-004](../requirements/requirements.md#nfr-r-004) |