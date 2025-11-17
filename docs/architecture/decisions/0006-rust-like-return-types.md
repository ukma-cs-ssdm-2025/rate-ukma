# ADR-0006: Rust-like Return Types (Result<T, E> Pattern)

## Status

Accepted

## Date

2025-11-17

## Context

### Current Error Handling

The project currently uses **exception-based error handling** in both the Python backend (Django/DRF) and TypeScript frontend (React), which is idiomatic for both ecosystems:

**Backend (Python/Django):**
- Custom exception hierarchy (`CourseNotFoundError`, `NotEnrolledException`, `DuplicateRatingException`, etc.)
- Layered exception translation (repository → service → view)
- Global DRF exception handler normalizing responses
- Pydantic validation with structured error messages
- Well-documented error contract (see ADR-0004)

**Frontend (TypeScript/React):**
- Axios interceptors for network errors
- React Error Boundaries for render errors
- Dedicated error pages with retry logic
- Type-safe error handling with TypeScript guards

### What Are Rust-like Return Types?

**Rust-like return types** refer to the `Result<T, E>` pattern from Rust, where functions return an explicit success/failure type instead of throwing exceptions:

```rust
// Rust example
fn divide(a: i32, b: i32) -> Result<i32, String> {
    if b == 0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}
```

This approach makes error handling **explicit** and **type-safe**—callers must handle both success and error cases, preventing forgotten error handling.

**Python implementations:**
- [`returns`](https://github.com/dry-python/returns) library (comprehensive functional programming toolkit)
- [`result`](https://github.com/rustedpy/result) library (lightweight Rust-style Result)
- Custom discriminated unions with dataclasses

**TypeScript implementations:**
- [`neverthrow`](https://github.com/supermacro/neverthrow) (popular Result type library)
- [`oxide.ts`](https://github.com/traverse1984/oxide.ts) (Rust-inspired Option/Result)
- Native discriminated unions with type guards

### Forces Influencing This Decision

1. **Ecosystem Conventions:** Python and TypeScript communities predominantly use exceptions
2. **Framework Integration:** Django/DRF and React are designed around exception-based error handling
3. **Team Familiarity:** Current exception patterns are well-understood and consistently applied
4. **Existing Investment:** Significant code already uses exception-based patterns effectively
5. **Error Explicitness:** Result types force explicit error handling at every call site
6. **Type Safety:** Result types provide compile-time guarantees that errors are handled
7. **API Boundaries:** Current REST API uses HTTP status codes, which map naturally to exceptions
8. **Code Verbosity:** Result types can increase boilerplate at every function call
9. **Third-party Integration:** Most libraries in Python and TypeScript ecosystems use exceptions

## Decision

We will **continue using exception-based error handling** as our primary error handling strategy for both backend and frontend code. We will **not adopt Rust-like Result types** as a standard pattern.

### Rationale

1. **Strong Existing Patterns:** Our current exception hierarchy is well-designed, consistent, and maintainable
2. **Framework Alignment:** Django/DRF exception handling integrates seamlessly with our REST API (automatic HTTP status codes, error serialization)
3. **Ecosystem Fit:** Exceptions are idiomatic in Python and TypeScript; Result types would create friction with third-party libraries
4. **Minimal Benefit:** Our layered architecture with clear exception boundaries already provides good error handling structure
5. **High Migration Cost:** Retrofitting Result types would require massive refactoring with questionable ROI
6. **Team Productivity:** Exception patterns are familiar to the team and well-documented in ADRs

### When Exceptions Are Appropriate (Our Use Cases)

- **Repository layer:** Database operations that rarely fail in expected ways (translate ORM exceptions to domain exceptions)
- **Service layer:** Business logic validation (enrollment checks, duplicate detection)
- **API boundaries:** DRF automatically converts exceptions to HTTP responses
- **React components:** Error boundaries catch rendering errors globally
- **Network requests:** Axios interceptors handle HTTP errors centrally

### Limited Adoption for Specific Scenarios

While we won't adopt Result types broadly, they **may be considered** for:

1. **Parser/Validator Functions:** Where multiple validation errors are expected (e.g., scraper data validation)
2. **Pure Computation:** Mathematical or data transformation functions where errors are part of normal flow
3. **External Integration:** When wrapping third-party APIs that might fail frequently

**Implementation guideline:** If adopting Result types for specific modules:
- Use `returns` library for Python (well-maintained, comprehensive)
- Use `neverthrow` for TypeScript (popular, good TypeScript integration)
- Document the decision in code comments explaining why Result is used instead of exceptions
- Keep Result types contained within module boundaries; convert to exceptions at architectural boundaries

## Consequences

### ✅ Positive Consequences

- **Consistency:** Continues using proven patterns already established across the codebase
- **Maintainability:** No learning curve for new team members familiar with Python/TypeScript conventions
- **Framework Integration:** DRF exception handler, React Error Boundaries, and Axios interceptors continue working seamlessly
- **Lower Boilerplate:** Exception handling code remains concise; no need to unwrap Results at every call site
- **Third-party Compatibility:** No impedance mismatch when integrating libraries that use exceptions
- **Faster Development:** No migration effort; team can focus on features instead of refactoring

### ⚠️ Trade-offs

- **Implicit Error Paths:** Exceptions can be thrown from any function without explicit type signatures
- **Forgotten Error Handling:** Developers might forget to catch exceptions (though type hints can help document expected exceptions)
- **Debugging Complexity:** Exception stack traces can be harder to follow than explicit Result returns
- **No Compiler Enforcement:** Type system doesn't force handling of potential errors (unlike Result types)

### ❌ Negative Consequences

- **Missed Type Safety:** We won't get compile-time guarantees that all error cases are handled
- **Less Explicit:** Function signatures don't always indicate potential failure modes
- **Potential Inconsistency:** Without Result types, developers must rely on documentation and conventions to know which exceptions a function might raise

## Considered Alternatives

### 1. Full Adoption of Result Types (Python + TypeScript)

**Description:** Refactor the entire codebase to use Result<T, E> types for all operations that can fail.

**Rejection Reason:**
- **Massive refactoring effort:** Would require rewriting thousands of lines of code
- **Framework incompatibility:** Django/DRF are built around exceptions; would need extensive adapter code
- **Ecosystem friction:** Most Python/TypeScript libraries use exceptions, creating constant conversion overhead
- **Team disruption:** Requires learning functional programming concepts unfamiliar to many developers
- **Questionable value:** Our current exception patterns already provide good error handling structure

### 2. Hybrid Approach (Exceptions + Results)

**Description:** Use exceptions for "exceptional" cases and Result types for expected failures.

**Rejection Reason:**
- **Cognitive overhead:** Developers must decide which pattern to use in each situation
- **Inconsistency:** Two error handling patterns increase maintenance burden
- **Unclear boundaries:** Difficult to define clear rules for when to use each approach
- **Partial benefits:** Doesn't fully leverage the type safety advantages of Result types
- **Already achievable:** We can distinguish exceptional vs. expected errors using different exception types

### 3. Result Types Only in Backend

**Description:** Adopt Result types in Python backend while keeping exceptions in TypeScript frontend.

**Rejection Reason:**
- **API boundary mismatch:** REST API returns HTTP status codes, which map naturally to exceptions
- **Django incompatibility:** DRF's ViewSets, serializers, and exception handler expect exceptions
- **Split patterns:** Creates inconsistency between backend and frontend mental models
- **Limited value:** Backend exception handling is already well-structured with clear layers

### 4. Enhanced Exception Documentation with Type Hints

**Description:** Keep exceptions but document them better using PEP 484 type hints and docstrings.

**Status:** **Recommended complementary approach** (not mutually exclusive)

**Example:**
```python
def get_course(course_id: int) -> Course:
    """
    Retrieve a course by ID.

    Raises:
        CourseNotFoundError: If no course exists with the given ID
        InvalidCourseIdentifierError: If course_id is invalid
    """
    # implementation
```

**Advantages:**
- Improves discoverability of potential exceptions
- No architectural changes required
- Compatible with existing patterns
- Low implementation cost
- Tools like MyPy can check for documented exceptions

## References

- [ADR-0004: REST API Format](./0004-api-format.md) - Documents our error handling contract
- [Django Exception Handling Best Practices](https://docs.djangoproject.com/en/5.0/ref/exceptions/)
- [`returns` library for Python](https://github.com/dry-python/returns)
- [`neverthrow` library for TypeScript](https://github.com/supermacro/neverthrow)
- [Python PEP 3134: Exception Chaining and Embedded Tracebacks](https://peps.python.org/pep-3134/)
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)

## Notes

This ADR documents a **research and evaluation** task. The decision preserves our current patterns while remaining open to limited adoption of Result types in specific scenarios where they provide clear value.

If future experience reveals significant issues with exception-based error handling (e.g., frequent forgotten error cases, debugging difficulties), this decision can be revisited with concrete evidence.
