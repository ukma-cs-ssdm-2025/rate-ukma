# RateUKMA - Final Project Report

## Project Overview

**Rate UKMA** is a web platform designed for students of NaUKMA (National University of Kyiv-Mohyla Academy) to share and view feedback on university courses. The platform empowers students to make informed academic decisions by providing centralized course ratings, detailed reviews and interactive analytics. Built with modern technologies and professional software engineering practices, RateUKMA demonstrates a complete software engineering lifecycle from requirements to deployment.

**Mission:** Rate. Review. Discover your best courses at NaUKMA.

### Team Members

| Name | Role | GitHub |
|------|------|--------|
| Anastasiia Aleksieienko | DevOps, CI/CD, Infrastructure | [@stasiaaleks](https://github.com/stasiaaleks) |
| Kateryna Bratiuk | Backend Core, Domain Model | [@katerynabratiuk](https://github.com/katerynabratiuk) |
| Andrii Valenia | Frontend, UX, Sentry | [@Fybex](https://github.com/Fybex) |
| Milana Horalevych | Documentation, Scraper, API Design | [@miqdok](https://github.com/miqdok) |

---

## Tech Stack

- **Backend:** Django (Python)
- **Frontend:** React (TypeScript)
- **Database:** PostgreSQL
- **Caching:** Redis
- **Infrastructure:** Docker, AWS
- **Testing:** Playwright (E2E), pytest (Unit/Integration)
- **API Contract:** OpenAPI/Swagger
- **CI/CD:** GitHub Actions

---

## Documentation Hub

### Project Management & Requirements

- [Team Charter](../TeamCharter.md) - Team structure, roles, responsibilities and collaboration guidelines
- [Project Description](../Project-Description.md) - Project vision, goals and key features
- [Requirements Document](../docs/requirements/requirements.md) - Detailed functional and non-functional requirements
- [User Stories](../docs/requirements/user-stories.md) - User-centric feature descriptions
- [Traceability Matrix](../docs/traceability-matrix.md) - Mapping requirements to implementation and tests

### Architecture & Design

- [Architecture Decisions Index](../docs/architecture/decisions/INDEX.md) - Overview of all ADRs
- [ADR 0000: Use ADRs](../docs/architecture/decisions/0000-use-adrs.md) - Decision to use Architecture Decision Records
- [ADR 0001: N-Tier Architecture](../docs/architecture/decisions/0001-n-tier-arch.md) - Layered architecture pattern selection
- [ADR 0002: Initial Deployment Strategy](../docs/architecture/decisions/0002-initial-deployment-strategy.md) - AWS deployment approach
- [ADR 0003: Tech Stack Selection](../docs/architecture/decisions/0003-tech-stack.md) - Technology choices rationale
- [ADR 0004: API Format](../docs/architecture/decisions/0004-api-format.md) - RESTful API with OpenAPI specification
- [ADR 0005: API Data Validation](../docs/architecture/decisions/0005-api-data-validation.md) - Validation strategy
- [ADR 0006: Server-Side Caching](../docs/architecture/decisions/0006-server-side-caching.md) - Redis caching implementation
- [High-Level Architecture](../docs/architecture/high-level-design.md) - System overview and design principles
- [API Design Documentation](../docs/api/api-design.md) - RESTful API design and endpoints
- [API Quality Attributes](../docs/api/api-quality-attributes.md) - Performance, security and reliability considerations
- [API Documentation](../docs/api/api-documentation.md) - Complete API reference
- [OpenAPI Specification](../docs/api/openapi-generated.yaml) - Machine-readable API contract

#### UML Diagrams

- [Component Diagram](../docs/architecture/uml/component-diagram.svg) - System components and interactions
- [Deployment Diagram](../docs/architecture/uml/deployment-diagram.svg) - Infrastructure and deployment topology
- [Domain Model](../docs/architecture/uml/domain-model.svg) - Core business entities and relationships
- [High-Level Design Diagram](../docs/architecture/uml/high-level-design.svg) - Visual system overview
- [Sequence Diagram: Login (US001)](../docs/architecture/uml/sequence-us001-login.svg) - Authentication flow
- [Sequence Diagram: Rate Course (US009)](../docs/architecture/uml/sequence-us009-rate-course.svg) - Rating submission process

### Quality Assurance & Testing

- [Test Plan](../docs/validation/test-plan.md) - Comprehensive testing strategy and scope
- [Testing Strategy](../docs/testing/testing-strategy.md) - Testing approach and levels
- [E2E Test Documentation](../docs/testing/e2e-tests.md) - End-to-end test cases and automation
- [Test IDs & Mapping](../docs/testing/test-ids.md) - Test identifiers and traceability
- [Reliability Report](../docs/reliability/reliability-report.md) - System reliability analysis and metrics
- [Reliability Tests](../docs/reliability/tests.md) - Reliability test cases and procedures
- [SonarCloud Report](../docs/refactor/sonarcloud-report.md) - Code quality analysis results
- [Static Analysis](../docs/code-quality/static-analysis.md) - Code review and analysis findings
- [Code Quality Progress](../docs/code-quality/progress.md) - Quality improvements tracking
- [Code Review Report](../docs/code-quality/review-report.md) - Peer review outcomes
- [Validation Review Log](../docs/validation/review-log.md) - Verification and validation records

### DevOps & Infrastructure

- [CI/CD Pipeline Overview](../docs/ci-cd/dora-summary.md) - Continuous integration and deployment metrics
- [DORA Summary Report](../docs/ci-cd/dora-summary-report.md) - Deployment frequency, lead time, MTTR, change failure rate
- [Metrics Raw Data](../docs/ci-cd/metrics-raw.md) - Detailed performance metrics
- [Profiling Report](../docs/reliability/profiling.md) - Application performance profiling
- [Debugging Log](../docs/testing/debugging-log.md) - Known issues and debugging records
- [Workflow Documentation](../docs/testing/workflows.md) - CI/CD workflow descriptions

### Reliability & Performance

- [Reliability Analysis](../docs/reliability/scavenger-hunt.md) - Fault injection and chaos engineering findings

---

## Key Features

### 1. Course Catalog & Search

Students can browse all available courses at NaUKMA and search using advanced filters:

- Filter by department, professor and course name
- Sort by rating, difficulty and usefulness
- View rating trends

### 2. Smart Rating & Review System

Authenticated students can:

- Rate courses on multiple dimensions (difficulty, usefulness)
- Write detailed text reviews
- View aggregate statistics and distribution charts
- Maintain anonymity to prevent bias

### 3. Secure Authentication

- NaUKMA Outlook OAuth integration
- Student-only access control
- Session management and token-based authentication
- Anonymous review submission

---

## Deployment & Access

**Staging Environment:** <https://staging.rateukma.com>

**Production Environment:** <https://rateukma.com>

**GitHub Repository:** <https://github.com/ukma-cs-ssdm-2025/rate-ukma>

### Infrastructure

- **Hosting:** AWS (EC2, RDS, ElastiCache)
- **Containerization:** Docker & Docker Compose
- **Database:** PostgreSQL (primary), Redis (caching)
- **CI/CD:** GitHub Actions (automated testing, building, deployment)
- **Monitoring:** AWS CloudWatch

---

## Project Statistics

### Development Metrics

- **Team Size:** 4 members
- **Project Duration:** 10 labs + 1 midterm + final
- **Code Coverage:** See [coverage badge](../coverage.svg)
- **Release Status:** See [latest releases](https://github.com/ukma-cs-ssdm-2025/rate-ukma/releases)

### Process Metrics (DORA)

- **Deployment Frequency:** Track in [CI/CD metrics](../docs/ci-cd/dora-summary.md)
- **Lead Time for Changes:** Document in metrics reports
- **Mean Time to Recovery (MTTR):** Monitor in [reliability reports](../docs/reliability/reliability-report.md)
- **Change Failure Rate:** Assess in quality reports

## Future Enhancements

RateUKMA has successfully established the foundation for a comprehensive course rating platform at NaUKMA. Areas for future expansion include:

- Comment and reply system for discussions on reviews
- Professor response mechanism to ratings
- Course recommendation engine based on user preferences
- Mobile application (iOS & Android)
