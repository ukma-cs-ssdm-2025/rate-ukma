# ADR-0005: API Data Validation

## Status

In progress

## Date

2025-11-08

## Context

During SRE review, we discovered several issues:

- Current API incoming data validation is not consistent. Filters are validated in API, service and repository layers. This breaks separation of concerns and makes it unclear where to catch proper validation errors.
- Lower-level repositories are not catching database errors close to the source. On the contrary, they are ignored up to API layer and are caught there. This leads to tight coupling of errors processing logic to the API layer.

## Decision

We introduced Pydantic models for API input validation. This way client-provided data is validated in the highest level of abstraction - API layer, and the passed correctly to lower ones.

We catch the models-specific database errors in the repository layer and propagate a model-specific error wrapper to the higher layers.

## Consequences

Additionally, during the refactoring, these issues were fixed:

- Models should not know anything about repositories that access them. Therefore, some repository-specific checks were refactored as well.
- To decouple business logic from database entities, we added domain model interfaces that match the Django model signature. They allow to use the data without coupling to the concrete database model functions and constraints.

## Considered Alternatives
