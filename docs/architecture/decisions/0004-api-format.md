# ADR-0004: REST API Format

## Status

Accepted

## Date

2025-10-05

## Context

For a Django-based web app, the API should favor simplicity, fast delivery, strong tooling, and team familiarity while keeping setup low and maintenance predictable over time, especially for a React/TypeScript client integrating via standard HTTP semantics and OpenAPI contracts. The team needs clearly scoped endpoints, straightforward debugging/testing, and a stable contract-first workflow with generated docs and client stubs validated in CI via an OpenAPI schema. Non-functional forces include predictable versioning and deprecation paths, consistent error handling, and compatibility with DRF conventions to reduce implementation risk and cognitive load.

## Decision

### API Design Overview

We will provide a **REST API** between the frontend and backend, with the following principles:

#### Versioning

- Use **URL path versioning** (`/v1/`, `/v2/`) enforced by Django REST Framework’s  
  `URLPathVersioning` or `NamespaceVersioning`.
- All client calls will be **version-pinned**.
- API versions will be **documented** and **explicitly deprecated** when needed.

#### API Specification & Documentation

- All endpoints will be defined and validated against a **canonical OpenAPI specification**.
- **Interactive documentation** (Swagger UI / ReDoc) will be published **per API version**.
- **Schema validation** will run in CI to support:
  - Contract testing
  - TypeScript client generation

#### ⚠️Error Handling

- Default **DRF exception handling** will be used for consistency and simplicity.
- Errors are returned as standard JSON responses with a `detail` message and, when needed, field-level validation errors.
- We may later **extend responses toward RFC 7807-like structure** (`application/problem+json`) if cross-service error consistency or standardization becomes beneficial.

**Example:**

```json
{
  "detail": "Missing required field: email",
  "status": 400,
  "fields": { "email": ["This field is required."] }
}
```

## Consequences

- ✅ Strong alignment with DRF enables rapid delivery, reliable routing, and first-class documentation via OpenAPI tooling.
- ✅ Predictable HTTP semantics, broad ecosystem support, and easier debugging/testing with generated docs and contract checks in CI.
- ✅ Clear versioning strategy with URL path versions simplifies client pinning and staged deprecations during migrations.
- ⚠️ Potential over/under-fetching and endpoint proliferation for complex nested data compared to GraphQL.
- ⚠️ Versioning and deprecation policies add maintenance overhead and require discipline in changelog and sunset practices.
- ❌ No built-in real-time; push updates require WebSockets/SSE beyond standard REST requests.

## Considered Alternatives

1. GraphQL

   - Rejection Reason: Added flexibility and schema complexity are unnecessary for limited, well-defined endpoints; REST offers faster delivery with existing team expertise and DRF integration.

2. gRPC
   - Rejection Reason: Protobuf/tooling overhead and binary transport are not justified for a browser-centric web client; better suited for internal service-to-service use cases with strict performance needs.
