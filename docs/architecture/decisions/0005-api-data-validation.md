# ADR-0005: API Data Validation

## Status

Accepted

## Date

2025-11-08

## Context

During SRE review, we discovered several issues:

- Current API incoming data validation is not consistent. Filters are validated in API, service and repository layers. This breaks separation of concerns and makes it unclear where to catch proper validation errors. This applies to checking immutable fields, guardrail-ing pagination parameters etc.
- Lower-level repositories are not catching database errors. On the contrary, they are ignored up to API layer and are caught here. It couples database errors handling logic to the API layer.
- Sometimes service and repository are ignored and database methods are called directly in the API layer.

## Decision

1. **Introduce Pydantic models for API input validation**. Client-provided data is validated at the highest level of abstraction - the API layer - and then passed as a correct, validated object to lower layers.
   - Separate Pydantic models for different operations (create, update, patch) to enforce immutability at schema level
   - Use `model_validate()` for automatic type coercion and validation
   - Validation errors are caught and re-raised as DRF ValidationError with detailed error context

2. **Catch database errors in the repository layer** and propagate model-specific error wrappers to higher layers.
   - Repository methods wrap Django ORM exceptions (e.g., `IntegrityError`, `DoesNotExist`) into domain-specific exceptions
   - Domain exceptions inherit from DRF exception classes for automatic HTTP status code mapping
   - This prevents database implementation details from leaking into service and API layers

## Consequences

### Positive

- Less error-prone code due to automatic type coercion and validation
- Clear separation of concerns: validation at API boundary, business logic in services, data access in repositories
- Type-safe data flow throughout the application stack
- Reduced code duplication through reusable validation models
- Better error messages with structured validation feedback
- Immutable fields protected at schema level (no manual filtering needed)

### Negative

- Additional dependency (Pydantic) alongside DRF serializers
- DRF serializers still used for response serialization and API schema generation

### Additional Improvements Made During Refactoring

- **Decorator pattern for authorization**: `@require_student` and `@require_rating_ownership` decorators eliminate duplicate ownership checking code (~60% code reduction)
- **Custom exception hierarchy**: Domain-specific exceptions (e.g., `RatingNotFoundError`, `OnlyStudentActionAllowedError`) provide clear error semantics and automatic HTTP status mapping
- **Service layer refactoring**: Entity-specific services implement `IFilterable` protocol for reusable filter options, adhering to Single Responsibility Principle
- **Type safety improvements**: Protocol interfaces (`IRating`, `ICourse`) decouple business logic from Django ORM models; explicit type hints for decorator-injected parameters
- **Structured logging**: Consistent logging with `structlog` for better observability and audit trails

## Considered Alternatives

### Alternative 1: Keep Django REST Framework Serializers for All Validation

Continue using DRF serializers for input validation, field filtering, and data transformation.

**Pros**:

- Native DRF integration
- Single validation approach across the entire API
- Built-in support for nested serialization

**Cons**:

- Serializers are designed for both input validation AND output serialization, leading to mixed responsibilities
- Less explicit validation rules (hidden in Meta classes and field definitions)
- Harder to reuse validation logic outside of API layer
- Difficult to exclude immutable fields cleanly (requires manual `.pop()` calls)
- Type hints are not as robust as Pydantic's

**Reason for rejection**: Pydantic provides clearer separation of concerns, better type safety, and more explicit validation rules at the API boundary.

### Alternative 2: Keep Validation Logic in Service Layer

**Description**: Allow services to validate input parameters and filter criteria.

**Pros**:

- Business logic validation lives close to business logic

**Cons**:

- Services receive potentially invalid data from API
- Harder to generate API documentation (OpenAPI/Swagger) automatically
- Validation errors mixed with business logic errors
- Violates single responsibility principle (services do validation + business logic)

**Reason for rejection**: Validation should happen at the API boundary to fail fast and keep services focused on business logic.
