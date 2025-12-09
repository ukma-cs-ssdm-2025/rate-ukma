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
- **Testing:** Playwright (E2E), pytest (Backend Unit/Integration), Jest (Frontend Unit/Integration)
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

See [Requirements Traceability Matrix](../docs/traceability-matrix.md) for detailed tracking (91.7% coverage).

### Core Features (Production)

#### 1. Course Catalog & Search (US-002, US-003)

Full-text search and filtering by department, professor and course type with sorting by rating/difficulty/usefulness. Optimized for 300+ concurrent users, <1.5s response time.

#### 2. Interactive Scatter Plot Visualization (US-005)

Explore courses by usefulness and difficulty with bubble sizing by rating count. Features D3 zoom (1x-8x), smart label placement, hover tooltips, faculty color-coding and responsive design. Handles 300+ concurrent users.

#### 3. Smart Rating & Review System (US-009, US-010)

Rate courses on difficulty and usefulness (1-5 scales) with optional anonymous reviews. Full edit/delete capability, aggregate statistics and personal progress tracking per semester.

#### 4. Secure Authentication (US-001)

NaUKMA Outlook OAuth integration with token-based auth, 30-minute timeout, automatic enrollment linking. HTTPS/TLS encryption, 99.5% uptime target (Sentry monitored).

### Partial/Pending Features

#### 5. Admin Statistics & Monitoring (US-012)

Partially Implemented - basic dashboard exists.
Pending: large dataset optimization, full filter support, backup recovery verification.

---

## Deployment & Access

- **Staging:** <https://staging.rateukma.com>
- **Production:** <https://rateukma.com>
- **Repository:** <https://github.com/ukma-cs-ssdm-2025/rate-ukma>

**Infrastructure:** AWS (EC2, RDS, ElastiCache), Docker Compose, PostgreSQL + Redis, GitHub Actions CI/CD, CloudWatch monitoring

---

## Project Statistics

### Requirements Coverage

- **Overall Traceability:** 91.7% coverage (see [Requirements Traceability Matrix](../docs/traceability-matrix.md))
  - ✅ **10 Fully Implemented** (83.3%): Authentication, search, filtering, visualization, ratings and user profiles
  - ⚠️ **1 Partially Implemented** (8.3%): Admin statistics dashboard (low priority; queries available when needed)
  - 🔄 **1 In Progress** (8.3%): Course recommendations engine (foundation being built)

**Focus:** Prioritized user-facing features and stability. Pre-release effort concentrated on bug fixes, performance optimization and production readiness rather than admin analytics or recommendations.

### Development Metrics

- **Team:** 4 members over 10 labs + midterm + final
- **Coverage:** 10 of 12 user stories (83.3%), 11 of 12 functional requirements (91.7%)
- **Testing:** E2E (Playwright), Unit/Integration (pytest, Jest), [Reliability Report](../docs/reliability/reliability-report.md)
- **Code Quality:** [SonarCloud](../docs/refactor/sonarcloud-report.md), [Static Analysis](../docs/code-quality/static-analysis.md)
- **Releases:** [Latest releases](https://github.com/ukma-cs-ssdm-2025/rate-ukma/releases)

### Process Metrics (DORA)

- **Deployment Frequency, Lead Time, MTTR:** See [CI/CD metrics](../docs/ci-cd/dora-summary.md) and [reliability reports](../docs/reliability/reliability-report.md)

## Next Steps & Roadmap

RateUKMA has delivered core functionality with 91.7% requirements coverage. Future development focuses on stabilization and user engagement expansion:

### Immediate Priorities

- **User Interaction** (#281): Upvote/downvote for ratings, review helpfulness voting
- **Review Management** (#251, #318): Comments/replies, content filtering, abuse reporting
- **Personalization** (US-007, US-008): Course recommendations engine, home page suggestions, saved courses
- **UI Polish** (#261, #225, #247): Highlight attended courses, display academic year, mobile optimization

### Extended Development

- **Academic Planning**: Build next-year course plans with RateUKMA guidance, curriculum builder, course scheduler
- **Advanced Analytics**: Trend analysis over time, instructor performance metrics, department statistics
- **Institutional Integration**: Course registration sync, admin dashboard (#177), analytics export
- **Platform Scaling**: Kubernetes, CDN, database optimization, mobile apps (iOS/Android)
