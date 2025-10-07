# API Quality Attributes

This document outlines the primary quality attributes for the Rate UKMA API. Each attribute influences architectural decisions, implementation tactics, and validation activities across the backend services. Detailed mappings between API quality attributes, non-functional requirements (NFRs), and tests are maintained in the [traceability matrix](../traceability-matrix.md).

## API-QA-001 Performance

- **Target**: 95th percentile latency ≤ 1s for standard endpoints; analytics payloads (e.g., `/analytics/course-scatter`) respond ≤ 2s.
- **Implementation**:
  - Offset pagination (max 100 items) with default page size 20
  - Database indexing and query optimization for catalog and analytics endpoints
  - Precomputed aggregates with asynchronous recalculation for rating metrics
  - Response compression and planned caching of filter metadata
- **Measurement**: Lightweight load runs using k6 smoke scripts and review of basic server response logs.

## API-QA-002 Security

- **Target**: Pass OWASP API Security Top 10 checks, enforce Microsoft OIDC sessions, maintain 0 anonymization leaks.
- **Implementation**:
  - Input validation and sanitization on all endpoints
  - Session-based authentication with HttpOnly cookies, CSRF tokens, and role-aware middleware
  - Planned rate limiting at 100 req/min per client and secure secrets storage
  - HTTPS-only deployments with security headers and sanitized error payloads
- **Measurement**: Security-related pull requests are peer reviewed against the OWASP API checklist with CodeRabbit PR rules enforcing the required checks.

## API-QA-003 Reliability

- **Target**: ≥ 99.5% monthly uptime, zero data loss on submissions, successful automated retries.
- **Implementation**:
  - Health check endpoints and infrastructure monitoring
  - Idempotent handlers with retry logic for transient failures
  - Daily backups for ratings and progress data, verified restoration procedures
  - Clear, structured error responses enabling graceful client recovery
- **Measurement**: Simple heartbeat monitoring, log-based incident review, and quarterly smoke tests that restore the daily pg_dump + rsync backups defined in the [deployment diagram](../architecture/uml/deployment-diagram.puml).

## API-QA-004 Usability

- **Target**: Developers can integrate core endpoints using the OpenAPI spec without direct backend assistance; error payloads remain readable and actionable.
- **Implementation**:
  - Stable OpenAPI specification with examples and schema descriptions
  - Consistent resource naming, pagination conventions, and filter semantics across endpoints
  - Rich error responses following the standard error contract with field-level guidance
  - Peer review with CodeRabbit automation keeps naming, pagination, and error guidelines consistent in trunk-based development
- **Measurement**: Peer-reviewed API documentation updates with CodeRabbit validations and manual verification of example requests before merge.

## API-QA-005 Maintainability & Evolvability

- **Target**: Expand API fields without breaking consumers while keeping the regression suite green.
- **Implementation**:
  - N-tier architecture with clear service boundaries per [ADR-0001](../architecture/decisions/0001-n-tier-arch.md)
  - OpenAPI contract first approach backed by automated contract tests
  - Shared DTOs and typed interfaces aligned with [ADR-0003](../architecture/decisions/0003-tech-stack.md)
  - ADR-governed change process for API format decisions (see [ADR-0004](../architecture/decisions/0004-api-format.md))
- **Measurement**: CI contract tests plus generated client and frontend builds must stay green on every PR, catching schema regressions before merge.

## Trade-offs Analysis

| Quality                            | Trade-off                        | Impact                   | Mitigation                                                     |
| ---------------------------------- | -------------------------------- | ------------------------ | -------------------------------------------------------------- |
| Security (validation)              | +20ms latency                    | Minimal                  | Optimize validators, reuse cached reference data               |
| Performance (pagination)           | Limited data per request         | Multiple requests needed | Provide elevated limits for admins, evaluate cursor pagination |
| Reliability (error detail)         | Potential information disclosure | Security concern         | Sanitize messages                                              |
| Maintainability (strict contracts) | Upfront documentation effort     | Slower initial iteration | Automate contract generation, integrate schema linting         |
