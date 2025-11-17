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

We will adopt **Result types in backend service and repository layers**, while maintaining **exception-based error handling at API boundaries and in the frontend**.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React/TypeScript)                                 │
│ ✗ Exceptions: Axios interceptors, Error Boundaries         │
└─────────────────────────────────────────────────────────────┘
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ View Layer (Django ViewSets)                                │
│ ✗ Exceptions: Convert Result → Exception → HTTP Response   │
│                                                             │
│   def list(request):                                        │
│       result = course_service.get_all_courses(filters)      │
│       return result.unwrap()  # raises if Err               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Service Layer                                               │
│ ✓ Result Types: Compose operations, explicit error flow    │
│                                                             │
│   def create_rating(...) -> Result[Rating, ServiceError]:   │
│       return (                                              │
│           repo.check_enrollment(student, course)            │
│           .and_then(lambda _: repo.check_duplicate(...))    │
│           .and_then(lambda _: repo.create_rating(...))      │
│       )                                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Repository Layer                                            │
│ ✓ Result Types: Translate ORM errors to domain errors      │
│                                                             │
│   def get_course(id) -> Result[Course, RepoError]:          │
│       try:                                                  │
│           return Success(Course.objects.get(id=id))         │
│       except Course.DoesNotExist:                           │
│           return Failure(CourseNotFound(id))                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Database (PostgreSQL)                                       │
└─────────────────────────────────────────────────────────────┘
```

### Rationale

1. **Best of Both Worlds:** Result types where they add value (business logic), exceptions where idiomatic (API boundaries)
2. **Explicit Business Logic:** Service layer operations clearly declare success/failure modes via type signatures
3. **Better Composition:** Chain repository operations cleanly with `.and_then()`, `.map()`, etc.
4. **Maintains DRF Compatibility:** Views convert Results to exceptions; DRF exception handler works unchanged
5. **Frontend Unchanged:** No learning curve or migration needed for React code
6. **Type Safety Where It Matters:** Service and repository layers get compile-time error handling guarantees
7. **Clear Boundaries:** Result types stay internal; architectural boundaries use exceptions

### Implementation Strategy

**Library:** Use [`returns`](https://github.com/dry-python/returns) for Python
- Battle-tested, well-maintained
- Provides `Result[T, E]`, `Maybe[T]`, and functional combinators
- Good MyPy/type checker support
- Railway-oriented programming style

**Migration Path:**
1. Start with new features using Result types in service/repository layers
2. Gradually refactor existing critical paths (e.g., rating creation, enrollment checks)
3. Maintain exceptions in views (unwrap Results, let DRF handle)
4. No changes required to frontend code

**Example Pattern:**

```python
# Repository Layer
from returns.result import Result, Success, Failure

class CourseRepository:
    def get_course(self, course_id: int) -> Result[Course, CourseNotFoundError]:
        try:
            course = Course.objects.get(id=course_id)
            return Success(course)
        except Course.DoesNotExist:
            return Failure(CourseNotFoundError(course_id))

# Service Layer
class RatingService:
    def create_rating(
        self,
        student_id: int,
        course_id: int,
        rating: int
    ) -> Result[Rating, ServiceError]:
        return (
            self._check_enrollment(student_id, course_id)
            .and_then(lambda _: self._check_duplicate(student_id, course_id))
            .and_then(lambda _: self._repo.create_rating(student_id, course_id, rating))
        )

# View Layer
class RatingViewSet(ViewSet):
    def create(self, request):
        result = self.rating_service.create_rating(...)

        # Unwrap converts Failure to exception
        rating = result.unwrap()  # Raises ServiceError if failed

        # DRF exception handler converts to HTTP response
        return Response(RatingSerializer(rating).data, status=201)
```

### Guidelines

- **Repository methods** return `Result[Model, RepositoryError]`
- **Service methods** return `Result[DomainObject, ServiceError]`
- **View methods** unwrap Results and let exceptions propagate to DRF
- Use **railway-oriented programming** for operation chaining
- Document error types in function signatures (self-documenting)
- Keep frontend and third-party integrations using exceptions

## Consequences

### ✅ Positive Consequences

- **Explicit Business Logic:** Service/repository function signatures clearly document error cases with `Result[T, E]` types
- **Type-Safe Composition:** Chain operations safely with `.and_then()`, `.map()`, avoiding nested try-catch blocks
- **Maintains Framework Integration:** DRF exception handler, React Error Boundaries continue working unchanged
- **Better Error Propagation:** Railway-oriented programming makes error flow through service layer explicit and traceable
- **Gradual Migration:** Can adopt incrementally for new features without massive refactoring
- **Frontend Unchanged:** No learning curve or changes needed for React/TypeScript code
- **Clear Architectural Boundaries:** Result types internal, exceptions at API boundaries (clean separation)
- **MyPy Enforcement:** Type checker ensures all error cases are handled in service/repo layers
- **Self-Documenting Code:** Return types show what can fail without reading documentation

### ⚠️ Trade-offs

- **Learning Curve:** Team needs to learn `returns` library and functional programming concepts
- **Mixed Paradigm:** Two error handling styles (Results internally, exceptions at boundaries)
- **Migration Effort:** Existing service/repository code needs refactoring to use Result types
- **Unwrap Boilerplate:** View layer must unwrap Results, though this is straightforward
- **Functional Programming:** Some developers may find `.and_then()` chains less familiar than try-catch
- **Library Dependency:** Adds `returns` as a core dependency

### ❌ Negative Consequences

- **Inconsistency During Migration:** Codebase will have mixed patterns until migration completes
- **Debugging Complexity:** Railway-oriented error chains might be harder to debug than exception stack traces
- **Performance Overhead:** Result types add minor overhead vs. direct exception raising (usually negligible)
- **Third-party Integration:** Must wrap library code that uses exceptions into Result-returning adapters

## Considered Alternatives

### 1. Keep Exception-Based Error Handling Everywhere

**Description:** Continue using exceptions throughout the entire stack (backend, frontend, all layers).

**Rejection Reason:**
- **Implicit error handling:** Service layer function signatures don't declare what can fail
- **No type safety:** MyPy can't enforce that errors are handled in business logic
- **Harder composition:** Chaining operations requires nested try-catch blocks
- **Less explicit:** Developers must rely on documentation to know which exceptions a function raises
- **Lost opportunity:** Doesn't leverage type system for better error handling where it matters most
- **Verdict:** While this works (our current approach), we can do better for business logic layers

### 2. Full Adoption of Result Types (All Layers + Frontend)

**Description:** Refactor the entire codebase to use Result<T, E> types everywhere, including views and frontend.

**Rejection Reason:**
- **Massive refactoring effort:** Would require rewriting thousands of lines of code
- **Framework incompatibility:** Django/DRF ViewSets are built around exceptions
- **Frontend ecosystem friction:** React Error Boundaries, Axios interceptors, and most TS libraries use exceptions
- **Team disruption:** Requires learning functional programming concepts for entire team
- **API boundary awkwardness:** HTTP responses map naturally to exceptions, not Results
- **Excessive overhead:** Unwrapping Results at every level adds boilerplate without clear value at boundaries

### 3. Result Types Only for "Expected" Failures

**Description:** Use exceptions for "exceptional" cases and Result types for expected failures, without clear layer boundaries.

**Rejection Reason:**
- **Cognitive overhead:** Developers must decide which pattern to use in each situation
- **Inconsistent boundaries:** Difficult to define clear rules for when to use each approach
- **Mixing patterns within layers:** Could have both Results and exceptions in the same service method
- **Partial benefits:** Doesn't fully leverage the type safety advantages of Result types
- **Already achievable:** We can distinguish exceptional vs. expected errors using different exception types
- **Verdict:** Layered approach (Alternative #4) provides clearer boundaries and rules

### 4. Result Types in Service/Repo + Exceptions at Boundaries ✅ SELECTED

**Description:** Use Result types internally (service and repository layers), convert to exceptions at architectural boundaries (views, frontend).

**Why Selected:**
- **Clear boundaries:** Result types for business logic, exceptions at API/UI boundaries
- **Best of both worlds:** Type safety where it matters, idiomatic patterns at boundaries
- **Gradual migration:** Can adopt incrementally without breaking existing code
- **Framework compatibility:** DRF views still use exceptions, frontend unchanged
- **Targeted benefits:** Gains type safety and composition in layers that benefit most
- **See "Decision" section above for full rationale**

### 5. Enhanced Exception Documentation with Type Hints

**Description:** Keep exceptions everywhere but document them better using PEP 484 type hints and docstrings.

**Status:** **Complementary approach** (can use alongside Result types for view layer)

**Example:**
```python
# View layer (still uses exceptions after unwrapping Results)
def get_course(course_id: int) -> Course:
    """
    Retrieve a course by ID.

    Raises:
        CourseNotFoundError: If no course exists with the given ID
        InvalidCourseIdentifierError: If course_id is invalid
    """
    result = self.course_service.get_course(course_id)
    return result.unwrap()  # Converts Failure to exception
```

**Advantages:**
- Improves discoverability at exception-using layers (views)
- Compatible with selected approach
- Low implementation cost
- Tools like MyPy can lint for documented exceptions
- **Verdict:** Use this for view layer alongside Result types in service/repo layers

## References

### Core Documentation
- [ADR-0004: REST API Format](./0004-api-format.md) - Documents our error handling contract
- [ADR-0001: N-tier Architecture](./0001-n-tier-arch.md) - Layered architecture that Result types align with

### Libraries
- [`returns` library for Python](https://github.com/dry-python/returns) - Recommended Result type implementation
- [`returns` documentation](https://returns.readthedocs.io/en/latest/) - Comprehensive guide and API reference
- [`result` library (alternative)](https://github.com/rustedpy/result) - Lightweight Rust-style Result for Python

### Concepts
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) - F# article introducing the concept (applies to Python)
- [Django Exception Handling Best Practices](https://docs.djangoproject.com/en/5.0/ref/exceptions/)
- [Python PEP 3134: Exception Chaining and Embedded Tracebacks](https://peps.python.org/pep-3134/)
- [MyPy Type Checking](https://mypy.readthedocs.io/) - Enforces Result type handling

### Related Patterns
- [Result Type Pattern](https://en.wikipedia.org/wiki/Result_type) - General concept across languages
- [Maybe/Option Types](https://returns.readthedocs.io/en/latest/pages/maybe.html) - Complementary pattern for nullable values

## Notes

### Implementation Timeline

This decision should be implemented **gradually**:

1. **Phase 1 (Immediate):** Add `returns` library to dependencies
2. **Phase 2 (New Features):** Use Result types for all new service/repository methods
3. **Phase 3 (Refactoring):** Migrate critical paths (rating creation, enrollment checks, course queries)
4. **Phase 4 (Complete):** Full migration of service and repository layers

### Team Onboarding

- Schedule a team session on `returns` library and railway-oriented programming
- Create internal examples and patterns document
- Add linting rules to enforce Result usage in service/repo layers
- Update contribution guidelines with Result type conventions

### Review Clause

After **6 months** of adoption, review this decision:
- Measure impact on bug reduction (especially forgotten error cases)
- Assess team satisfaction with the pattern
- Evaluate debugging experience with Result chains vs. exceptions
- Consider expanding or reverting based on concrete evidence

If the pattern proves problematic (difficult debugging, team resistance, minimal bug reduction), this decision can be revisited.
