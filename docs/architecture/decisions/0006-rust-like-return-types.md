# ADR-0006: Rust-like Return Types (Result<T, E> Pattern)

## Status

Proposed

*This ADR proposes a significant architectural change and requires team review and approval before implementation.*

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

**Detailed Implementation Examples:**

#### 1. Error Type Definitions

Define explicit error types for each layer with clear semantics:

```python
# rating_app/domain_errors.py
from dataclasses import dataclass
from typing import Literal

# Base error types
@dataclass(frozen=True)
class DomainError:
    """Base class for all domain errors"""
    message: str

# Repository Layer Errors
@dataclass(frozen=True)
class CourseNotFoundError(DomainError):
    course_id: int

    def __post_init__(self):
        object.__setattr__(self, 'message', f"Course with ID {self.course_id} not found")

@dataclass(frozen=True)
class StudentNotFoundError(DomainError):
    student_id: int

    def __post_init__(self):
        object.__setattr__(self, 'message', f"Student with ID {self.student_id} not found")

@dataclass(frozen=True)
class InvalidCourseIdentifierError(DomainError):
    course_id: int
    reason: str

    def __post_init__(self):
        object.__setattr__(self, 'message', f"Invalid course ID {self.course_id}: {self.reason}")

# Service Layer Errors
@dataclass(frozen=True)
class NotEnrolledError(DomainError):
    student_id: int
    course_id: int

    def __post_init__(self):
        object.__setattr__(self, 'message',
            f"Student {self.student_id} is not enrolled in course {self.course_id}")

@dataclass(frozen=True)
class DuplicateRatingError(DomainError):
    student_id: int
    course_id: int

    def __post_init__(self):
        object.__setattr__(self, 'message',
            f"Student {self.student_id} already rated course {self.course_id}")

@dataclass(frozen=True)
class InvalidRatingValueError(DomainError):
    value: int

    def __post_init__(self):
        object.__setattr__(self, 'message',
            f"Rating value {self.value} must be between 1 and 5")

# Union types for each layer
RepositoryError = CourseNotFoundError | StudentNotFoundError | InvalidCourseIdentifierError
ServiceError = NotEnrolledError | DuplicateRatingError | InvalidRatingValueError | RepositoryError
```

#### 2. Repository Layer: Creating Errors

Repository methods return `Result[T, RepositoryError]` and create errors explicitly:

```python
# rating_app/repositories/course_repository.py
from returns.result import Result, Success, Failure
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
import structlog

logger = structlog.get_logger(__name__)

class CourseRepository:
    def get_course(self, course_id: int) -> Result[Course, RepositoryError]:
        """
        Retrieve a course by ID.

        Returns:
            Success(Course) if found
            Failure(CourseNotFoundError) if course doesn't exist
            Failure(InvalidCourseIdentifierError) if ID is invalid
        """
        try:
            course = Course.objects.get(id=course_id)
            logger.info("course_retrieved", course_id=course_id)
            return Success(course)

        except Course.DoesNotExist:
            logger.warning("course_not_found", course_id=course_id)
            return Failure(CourseNotFoundError(course_id=course_id))

        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.error("invalid_course_id", course_id=course_id, error=str(exc))
            return Failure(InvalidCourseIdentifierError(
                course_id=course_id,
                reason=str(exc)
            ))

    def get_student(self, student_id: int) -> Result[Student, RepositoryError]:
        """Get student by ID."""
        try:
            student = Student.objects.get(id=student_id)
            return Success(student)
        except Student.DoesNotExist:
            return Failure(StudentNotFoundError(student_id=student_id))
        except (ValueError, TypeError) as exc:
            return Failure(InvalidCourseIdentifierError(
                course_id=student_id,  # Reuse error type
                reason=f"Invalid student ID: {exc}"
            ))
```

#### 3. Service Layer: Composing Operations with Error Propagation

Service methods compose repository operations and add business logic validation:

```python
# rating_app/services/rating_service.py
from returns.result import Result, Success, Failure
from returns.pipeline import flow
from returns.pointfree import bind

class RatingService:
    def __init__(self, course_repo: CourseRepository, rating_repo: RatingRepository):
        self._course_repo = course_repo
        self._rating_repo = rating_repo

    def create_rating(
        self,
        student_id: int,
        course_id: int,
        rating_value: int
    ) -> Result[Rating, ServiceError]:
        """
        Create a new rating for a course.

        Returns:
            Success(Rating) if created successfully
            Failure(InvalidRatingValueError) if rating value is invalid
            Failure(NotEnrolledError) if student not enrolled
            Failure(DuplicateRatingError) if rating already exists
            Failure(CourseNotFoundError) if course doesn't exist
            Failure(StudentNotFoundError) if student doesn't exist
        """
        # First validate rating value (service-level validation)
        if not (1 <= rating_value <= 5):
            return Failure(InvalidRatingValueError(value=rating_value))

        # Chain repository operations using railway-oriented programming
        return (
            self._validate_enrollment(student_id, course_id)
            .and_then(lambda _: self._check_no_duplicate(student_id, course_id))
            .and_then(lambda _: self._rating_repo.create_rating(
                student_id=student_id,
                course_id=course_id,
                rating=rating_value
            ))
        )

    def _validate_enrollment(
        self,
        student_id: int,
        course_id: int
    ) -> Result[bool, ServiceError]:
        """Check if student is enrolled in course."""
        # Repository errors propagate automatically
        student_result = self._course_repo.get_student(student_id)
        course_result = self._course_repo.get_course(course_id)

        # Combine two Results - fails if either fails
        return (
            student_result
            .and_then(lambda student: course_result.map(lambda course: (student, course)))
            .and_then(lambda pair: self._check_enrollment_status(pair[0], pair[1], course_id))
        )

    def _check_enrollment_status(
        self,
        student: Student,
        course: Course,
        course_id: int
    ) -> Result[bool, NotEnrolledError]:
        """Business logic: verify enrollment."""
        is_enrolled = course.enrolled_students.filter(id=student.id).exists()

        if is_enrolled:
            return Success(True)
        else:
            return Failure(NotEnrolledError(
                student_id=student.id,
                course_id=course_id
            ))

    def _check_no_duplicate(
        self,
        student_id: int,
        course_id: int
    ) -> Result[bool, ServiceError]:
        """Check if rating already exists."""
        return (
            self._rating_repo.find_rating(student_id, course_id)
            .map(lambda rating: rating is not None)
            .and_then(lambda exists: (
                Failure(DuplicateRatingError(student_id=student_id, course_id=course_id))
                if exists
                else Success(False)
            ))
        )
```

#### 4. View Layer: Exhaustive Error Handling

Views must handle **all possible error cases** explicitly using pattern matching:

```python
# rating_app/views/rating_viewset.py
from rest_framework import status
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.exceptions import (
    NotFound, ValidationError, PermissionDenied, APIException
)
from returns.result import Result

class RatingViewSet(ViewSet):
    def create(self, request):
        """
        Create a new rating.

        Request body:
            {
                "student_id": 123,
                "course_id": 456,
                "rating": 5
            }
        """
        # Extract and validate request data (could use Pydantic here)
        student_id = request.data.get('student_id')
        course_id = request.data.get('course_id')
        rating_value = request.data.get('rating')

        # Call service layer
        result = self.rating_service.create_rating(
            student_id=student_id,
            course_id=course_id,
            rating_value=rating_value
        )

        # Handle all error cases explicitly with pattern matching
        return result.lash(
            lambda error: self._handle_create_rating_error(error)
        ).map(
            lambda rating: Response(
                RatingSerializer(rating).data,
                status=status.HTTP_201_CREATED
            )
        ).unwrap()  # Safe to unwrap because we handled errors with .lash()

    def _handle_create_rating_error(self, error: ServiceError) -> Response:
        """
        Convert domain errors to DRF exceptions.
        Pattern match on error type to handle each case.
        """
        match error:
            # Service-level validation errors → 400 Bad Request
            case InvalidRatingValueError(value=val):
                raise ValidationError({
                    "rating": f"Rating must be between 1 and 5, got {val}"
                })

            # Business rule violations → 403 Forbidden
            case NotEnrolledError(student_id=sid, course_id=cid):
                raise PermissionDenied(
                    f"Student {sid} is not enrolled in course {cid}"
                )

            # Duplicate operations → 409 Conflict
            case DuplicateRatingError(student_id=sid, course_id=cid):
                raise APIException(
                    detail=f"Student {sid} has already rated course {cid}",
                    code=status.HTTP_409_CONFLICT
                )

            # Repository errors → 404 Not Found
            case CourseNotFoundError(course_id=cid):
                raise NotFound(f"Course with ID {cid} not found")

            case StudentNotFoundError(student_id=sid):
                raise NotFound(f"Student with ID {sid} not found")

            # Invalid identifiers → 400 Bad Request
            case InvalidCourseIdentifierError(course_id=cid, reason=reason):
                raise ValidationError({
                    "course_id": f"Invalid course ID {cid}: {reason}"
                })

            # Exhaustiveness check: if we add new error types, MyPy will warn
            case _:
                # This should never happen if error types are properly defined
                logger.error("unhandled_error_type", error=error)
                raise APIException("An unexpected error occurred")

    def list(self, request):
        """Get all ratings with filtering."""
        # Get filters from query params
        course_id = request.query_params.get('course_id')

        if course_id:
            result = self.rating_service.get_ratings_for_course(int(course_id))

            # Handle potential CourseNotFoundError
            return result.lash(lambda error: match error:
                case CourseNotFoundError(course_id=cid) =>
                    raise NotFound(f"Course {cid} not found"),
                case _ =>
                    raise APIException("Unexpected error")
            ).map(
                lambda ratings: Response(RatingSerializer(ratings, many=True).data)
            ).unwrap()

        # No filtering - always succeeds
        ratings = self.rating_service.get_all_ratings()
        return Response(RatingSerializer(ratings, many=True).data)
```

**Key Benefits of This Approach:**

1. **Type Safety:** MyPy enforces that all error cases in the union type are handled
2. **Explicit Error Flow:** Function signatures declare exactly what can fail
3. **No Forgotten Errors:** Pattern matching with `match/case` ensures exhaustiveness
4. **Clear Boundaries:** Domain errors in service/repo, HTTP exceptions in views
5. **Railway-Oriented:** Errors propagate automatically through `.and_then()` chains
6. **Self-Documenting:** Return types show all possible failures without reading docs

### Guidelines

**Error Type Design:**
- Define errors as frozen dataclasses with descriptive fields
- Use union types (`|`) to declare all possible errors per layer
- Repository errors: `CourseNotFoundError | InvalidIdentifierError | ...`
- Service errors: Include all repository errors + business logic errors
- Each error type should be self-explanatory with context fields

**Repository Layer:**
- Return `Result[Model, RepositoryError]` from all methods
- Catch ORM exceptions and convert to domain errors
- Use `Success(value)` for successful operations
- Use `Failure(ErrorType(...))` with descriptive error instances
- Log error context with structlog before returning Failure

**Service Layer:**
- Return `Result[T, ServiceError]` from all public methods
- Validate business rules and return `Failure(...)` early if invalid
- Chain repository operations with `.and_then()` for sequential operations
- Use `.map()` for transformations that don't fail
- Repository errors automatically propagate through the chain
- Document all possible error types in function docstring

**View Layer:**
- Call service methods and get `Result[T, ServiceError]`
- Use `.lash(handler)` to convert errors to DRF exceptions
- Use `match/case` for exhaustive error handling
- Map each domain error to appropriate HTTP status code:
  - `404 NotFound` for entity not found errors
  - `400 ValidationError` for invalid input
  - `403 PermissionDenied` for business rule violations
  - `409 Conflict` for duplicate/conflict errors
- After `.lash()`, safe to call `.unwrap()` since errors are handled
- Include `case _:` fallback for unhandled errors (defensive programming)

**Type Checking:**
- Enable strict MyPy checking in `pyproject.toml`:
  ```toml
  [tool.mypy]
  strict = true
  warn_return_any = true
  warn_unreachable = true
  ```
- MyPy will warn if Result types aren't handled properly
- Use `# type: ignore` sparingly and document why

**Testing:**
- Test both success and all failure cases for each method
- Service layer tests should verify error propagation
- View layer tests should verify correct HTTP status codes for each error
- Example:
  ```python
  def test_create_rating_not_enrolled():
      result = service.create_rating(student_id=1, course_id=2, rating=5)
      assert result.is_failure()
      assert isinstance(result.failure(), NotEnrolledError)
  ```

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

## Quick Reference

### Cheat Sheet for Developers

**1. Creating Errors:**
```python
# ❌ Don't raise exceptions in service/repo layers
raise CourseNotFoundError(course_id)

# ✅ Do return Failure with error instance
return Failure(CourseNotFoundError(course_id=course_id))
```

**2. Repository Pattern:**
```python
def get_entity(self, id: int) -> Result[Entity, RepositoryError]:
    try:
        return Success(Entity.objects.get(id=id))
    except Entity.DoesNotExist:
        return Failure(EntityNotFoundError(entity_id=id))
```

**3. Service Composition:**
```python
# Sequential operations (railway-oriented)
return (
    repo.get_course(course_id)                    # Result[Course, RepoError]
    .and_then(lambda course: self.validate(course))  # Result[bool, ServiceError]
    .and_then(lambda _: repo.create(...))         # Result[Entity, RepoError]
)

# Early return on validation
if not (1 <= rating <= 5):
    return Failure(InvalidRatingValueError(value=rating))
```

**4. View Error Handling:**
```python
result = service.create_rating(...)
return result.lash(lambda error: match error:
    case CourseNotFoundError(course_id=cid) => raise NotFound(f"Course {cid} not found"),
    case NotEnrolledError(...) => raise PermissionDenied(...),
    case _ => raise APIException("Unexpected error")
).map(
    lambda rating: Response(RatingSerializer(rating).data, status=201)
).unwrap()
```

**5. Common Operations:**
```python
# Transform success value (doesn't change error)
result.map(lambda course: course.name)  # Result[str, Error]

# Chain operation that can fail
result.and_then(lambda course: repo.get_student(course.id))

# Provide default value on failure
result.value_or(default_value)

# Check if success/failure
if result.is_success():
    value = result.unwrap()
```

**6. Type Signatures:**
```python
# Repository
def get_course(self, id: int) -> Result[Course, RepositoryError]: ...

# Service
def create_rating(self, ...) -> Result[Rating, ServiceError]: ...

# View (returns DRF Response)
def create(self, request) -> Response: ...
```

**7. Testing:**
```python
# Test success case
result = service.create_rating(1, 2, 5)
assert result.is_success()
assert isinstance(result.unwrap(), Rating)

# Test failure case
result = service.create_rating(999, 2, 5)  # Non-existent course
assert result.is_failure()
assert isinstance(result.failure(), CourseNotFoundError)
```

### Common Pitfalls to Avoid

❌ **Don't unwrap Results in service/repo layers**
```python
# BAD: Defeats the purpose of Result types
course = repo.get_course(id).unwrap()  # Raises exception!
```

❌ **Don't mix exceptions and Results in service layer**
```python
# BAD: Inconsistent error handling
def create_rating(...) -> Result[Rating, ServiceError]:
    if invalid:
        raise InvalidRatingError()  # Should return Failure(...)
```

❌ **Don't forget to handle all error cases in views**
```python
# BAD: Missing error handling
result = service.create_rating(...)
return Response(result.unwrap())  # Might raise unexpected exception!

# GOOD: Explicit error handling with .lash()
return result.lash(self._handle_errors).map(...).unwrap()
```

❌ **Don't use generic Exception types**
```python
# BAD: Not specific enough
return Failure(Exception("Course not found"))

# GOOD: Specific error type with context
return Failure(CourseNotFoundError(course_id=course_id))
```

✅ **Do use type annotations everywhere**
```python
def create_rating(self, ...) -> Result[Rating, ServiceError]:
    # MyPy will check this!
```

✅ **Do document all possible errors in docstrings**
```python
def create_rating(...) -> Result[Rating, ServiceError]:
    """
    Returns:
        Success(Rating) if created
        Failure(InvalidRatingValueError) if rating invalid
        Failure(NotEnrolledError) if student not enrolled
        Failure(CourseNotFoundError) if course doesn't exist
    """
```
