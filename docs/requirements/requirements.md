# Requirements Specification

This document defines the **Functional Requirements (FR)** and **Non-Functional Requirements (NFR)** for the _Rate UKMA_ system.

## Functional Requirements

| ID | Description |
| --- | --- |
| FR-001 | The system shall allow students to log in using their official NaUKMA corporate email. |
| FR-002 | The system shall provide a catalog of all courses with pagination or "load more" functionality. |
| FR-003 | The system shall display course metadata (name, professor, faculty, semester, credits) on each course’s detail page. |
| FR-004 | The system shall allow searching for courses by full or partial name. |
| FR-005 | The system shall allow filtering courses by attributes (rating, instructor, faculty, semester, credits, type, level of study). |
| FR-006 | The system shall allow students to submit ratings (difficulty 1–5, usefulness 1–5) and optional text reviews anonymously. |
| FR-007 | The system shall allow students to edit or delete their own feedback on a course after submission. |
| FR-008 | The system shall display aggregated course ratings (averages, counts) and reviews on each course’s detail page, including existing text reviews. |
| FR-009 | The system shall display an interactive scatter plot of courses with usefulness on the x-axis and difficulty on the y-axis. Each course shall correspond to a point on the plot, and interactions (hover, click) shall reveal details or navigate to the course page. |
| FR-010 | The system shall provide personalized course recommendations based on student activity. Recommendations shall be shown on course detail pages and on the home page. |
| FR-011 | The system shall show students their evaluation history and progress (total completed and per semester), including completion percentage. |
| FR-012 | The system shall provide administrators with evaluation statistics (counts, filters, and trends over time). |

## Non-Functional Requirements (NFR)

| Category | ID | Description | Measurable Metric |
|--------------|------------|--------------------|------------------------|
| **Performance Efficiency** | NFR-PE-001 | The system shall load any page within 1.5 seconds under normal network conditions. | Page load time ≤ 1.5 sec |
| | NFR-PE-002 | The system shall display search results in real-time with a maximum response time of 1 second. | Response time ≤ 1 sec after input |
| | NFR-PE-003 | The scatter plot on the home page shall render completely within 2 seconds for up to 500 courses. | Scatter plot rendering ≤ 2 sec |
| | NFR-PE-004 | Filtering on scatter plot or course list shall update results within 1.5 seconds. | Filter response ≤ 1.5 sec |
| **Reliability** | NFR-R-001 | The system shall ensure that no data is lost during a course evaluation submission. | 100% data persistence confirmation |
| | NFR-R-002 | The system shall achieve 99.5% uptime monthly to ensure continuous availability. | Monthly uptime ≥ 99.5% |
| | NFR-R-003 | When a failure occurs during rating submission, the system shall retry automatically up to 3 times before showing an error. | Automatic retry count = 3 |
| | NFR-R-004 | Backups of all ratings and comments shall occur every 24 hours. | Backup frequency = daily |
| **Usability** | NFR-U-001 | 90% of first-time users shall be able to successfully log in and find a course within 3 minutes without external help. | Success rate ≥ 90% in usability test |
| | NFR-U-002 | Ratings and reviews shall be clearly visible and readable on desktop and mobile devices. | Readability test score ≥ 90% |
| **Robustness** | NFR-RB-001 | The system shall correctly handle cases when a user has no data available without errors or broken UI. | System returns valid empty state within ≤ 1 sec |
| **Security** | NFR-S-001 | The system shall require corporate email login using secure authentication. | 100% authentication via secure protocol |
| | NFR-S-002 | Student ratings must remain anonymous to other users. | 0 data leaks in security tests |
| | NFR-S-003 | User sessions shall expire after 30 minutes of inactivity. | Session timeout = 30 minutes |
|
