# Requirements Specification

This document defines the **Functional Requirements (FR)** and **Non-Functional Requirements (NFR)** for the _Rate UKMA_ system.

## Functional Requirements

### FR-001

The system shall allow students to log in using their official NaUKMA corporate email.

### FR-002

The system shall provide a catalog of all courses with pagination or "load more" functionality.

### FR-003

The system shall display course metadata (name, professor, faculty, semester, credits) on each course’s detail page.

### FR-004

The system shall allow searching for courses by full or partial name.

### FR-005

The system shall allow filtering courses by attributes (rating, instructor, faculty, semester, credits, type, level of study).

### FR-006

The system shall allow students to submit ratings (difficulty 1–5, usefulness 1–5) and optional text reviews anonymously.

### FR-007

The system shall allow students to edit or delete their own feedback on a course after submission.

### FR-008

The system shall display aggregated course ratings (averages, counts) and reviews on each course’s detail page, including existing text reviews.

### FR-009

The system shall display an interactive scatter plot of courses with usefulness on the x-axis and difficulty on the y-axis. Each course shall correspond to a point on the plot, and interactions (hover, click) shall reveal details or navigate to the course page.

### FR-010

The system shall provide personalized course recommendations based on student activity. Recommendations shall be shown on course detail pages and on the home page.

### FR-011

The system shall show students their evaluation history and progress (total completed and per semester), including completion percentage.

### FR-012

The system shall provide administrators with evaluation statistics (counts, filters, and trends over time).

## Non-Functional Requirements (NFR)

### NFR-PE-001

- **Category**: Performance Efficiency
- **Description**: The system shall load any page within 1.5 seconds under normal network conditions.
- **Measurable Metric**: Page load time ≤ 1.5 sec

### NFR-PE-002

- **Category**: Performance Efficiency
- **Description**: The system shall display search results in real-time with a maximum response time of 1 second.
- **Measurable Metric**: Response time ≤ 1 sec after input

### NFR-PE-003

- **Category**: Performance Efficiency
- **Description**: The scatter plot on the home page shall render completely within 2 seconds for up to 500 courses.
- **Measurable Metric**: Scatter plot rendering ≤ 2 sec

### NFR-PE-004

- **Category**: Performance Efficiency
- **Description**: Filtering on scatter plot or course list shall update results within 1.5 seconds.
- **Measurable Metric**: Filter response ≤ 1.5 sec

### NFR-R-001

- **Category**: Reliability
- **Description**: The system shall ensure that no data is lost during a course evaluation submission.
- **Measurable Metric**: 100% data persistence confirmation

### NFR-R-002

- **Category**: Reliability
- **Description**: The system shall achieve 99.5% uptime monthly to ensure continuous availability.
- **Measurable Metric**: Monthly uptime ≥ 99.5%

### NFR-R-003

- **Category**: Reliability
- **Description**: When a failure occurs during rating submission, the system shall retry automatically up to 3 times before showing an error.
- **Measurable Metric**: Automatic retry count = 3

### NFR-R-004

- **Category**: Reliability
- **Description**: Backups of all ratings and comments shall occur every 24 hours.
- **Measurable Metric**: Backup frequency = daily

### NFR-U-001

- **Category**: Usability
- **Description**: 90% of first-time users shall be able to successfully log in and find a course within 3 minutes without external help.
- **Measurable Metric**: Success rate ≥ 90% in usability test

### NFR-U-002

- **Category**: Usability
- **Description**: Ratings and reviews shall be clearly visible and readable on desktop and mobile devices.
- **Measurable Metric**: Readability test score ≥ 90%

### NFR-RB-001

- **Category**: Robustness
- **Description**: The system shall correctly handle cases when a user has no data available without errors or broken UI.
- **Measurable Metric**: System returns valid empty state within ≤ 1 sec

### NFR-S-001

- **Category**: Security
- **Description**: The system shall require corporate email login using secure authentication.
- **Measurable Metric**: 100% authentication via secure protocol

### NFR-S-002

- **Category**: Security
- **Description**: Student ratings must remain anonymous to other users.
- **Measurable Metric**: 0 data leaks in security tests

### NFR-S-003

- **Category**: Security
- **Description**: User sessions shall expire after 30 minutes of inactivity.
- **Measurable Metric**: Session timeout = 30 minutes
