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
- Good Pyright/type checker support
- Railway-oriented programming style

**Migration Path:**
1. Start with new features using Result types in service/repository layers
2. Gradually refactor existing critical paths (e.g., rating creation, enrollment checks)
3. Maintain exceptions in views (unwrap Results, let DRF handle)
4. No changes required to frontend code

**Detailed Implementation Examples:**

## Real Codebase Example: Rating Creation

Let's refactor the **actual rating creation flow** from your codebase to use Result types.

### Current Code (Exceptions)

```python
# rating_app/services/rating_service.py (BEFORE)
class RatingService:
    def create_rating(self, params: RatingCreateParams):
        student_id = str(params.student)
        offering_id = str(params.course_offering)

        # Check enrollment - raises NotEnrolledException
        is_enrolled = self.enrollment_repository.is_student_enrolled(
            student_id=student_id, offering_id=offering_id
        )
        if not is_enrolled:
            raise NotEnrolledException()

        # Check duplicate - raises DuplicateRatingException
        rating_exists = self.rating_repository.exists(
            student_id=student_id, course_offering_id=offering_id
        )
        if rating_exists:
            raise DuplicateRatingException()

        # Create rating - may raise IntegrityError
        return self.rating_repository.create(params)
```

**Problems:**
- Function signature doesn't show what can fail
- Implicit error paths (you must read the code to know exceptions)
- Nested if-statements
- No type-level guarantee errors are handled

---

### Refactored Code (Result Types)

#### Step 1: Define Error Types

```python
# rating_app/domain_errors.py (NEW FILE)
from dataclasses import dataclass

@dataclass(frozen=True)
class DomainError:
    message: str

# Service-level errors
@dataclass(frozen=True)
class NotEnrolledError(DomainError):
    student_id: str
    offering_id: str

    def __post_init__(self):
        object.__setattr__(
            self, 'message',
            f"Student {self.student_id} not enrolled in offering {self.offering_id}"
        )

@dataclass(frozen=True)
class DuplicateRatingError(DomainError):
    student_id: str
    offering_id: str

    def __post_init__(self):
        object.__setattr__(
            self, 'message',
            f"Student {self.student_id} already rated offering {self.offering_id}"
        )

@dataclass(frozen=True)
class CourseOfferingNotFoundError(DomainError):
    offering_id: str

    def __post_init__(self):
        object.__setattr__(self, 'message', f"Offering {self.offering_id} not found")

# Union type for service layer
ServiceError = NotEnrolledError | DuplicateRatingError | CourseOfferingNotFoundError
```

#### Step 2: Refactor Repository Layer

```python
# rating_app/repositories/rating_repository.py (AFTER)
from returns.result import Result, Success, Failure

class RatingRepository:
    def create(self, params: RatingCreateParams) -> Result[Rating, DuplicateRatingError]:
        try:
            rating = Rating.objects.create(
                student_id=str(params.student),
                course_offering_id=str(params.course_offering),
                difficulty=params.difficulty,
                usefulness=params.usefulness,
                comment=params.comment,
                is_anonymous=params.is_anonymous,
            )
            logger.info("rating_created", rating_id=rating.id)
            return Success(rating)  # ✅ Explicit success

        except IntegrityError:
            logger.warning("duplicate_rating_attempt",
                student_id=str(params.student),
                offering_id=str(params.course_offering)
            )
            return Failure(DuplicateRatingError(  # ✅ Explicit error
                student_id=str(params.student),
                offering_id=str(params.course_offering)
            ))

    def find_existing(
        self,
        student_id: str,
        offering_id: str
    ) -> Result[Rating | None, Never]:  # Can't fail, returns None if not found
        rating = Rating.objects.filter(
            student_id=student_id,
            course_offering_id=offering_id,
        ).first()
        return Success(rating)  # Always succeeds, rating may be None


# rating_app/repositories/enrollment_repository.py (AFTER)
class EnrollmentRepository:
    def check_enrollment(
        self,
        student_id: str,
        offering_id: str
    ) -> Result[bool, Never]:  # Always succeeds, returns bool
        is_enrolled = Enrollment.objects.filter(
            student_id=student_id,
            offering_id=offering_id,
            status__in=[EnrollmentStatus.ENROLLED, EnrollmentStatus.FORCED],
        ).exists()
        return Success(is_enrolled)
```

#### Step 3: Refactor Service Layer with Railway-Oriented Programming

```python
# rating_app/services/rating_service.py (AFTER)
from returns.result import Result, Success, Failure

class RatingService:
    def create_rating(
        self,
        params: RatingCreateParams
    ) -> Result[Rating, ServiceError]:  # ✅ Explicit return type showing all errors
        student_id = str(params.student)
        offering_id = str(params.course_offering)

        # Railway-oriented programming: chain operations
        return (
            self._verify_enrollment(student_id, offering_id)      # Step 1
            .and_then(lambda _: self._check_no_duplicate(student_id, offering_id))  # Step 2
            .and_then(lambda _: self.rating_repository.create(params))  # Step 3
        )
        # If ANY step returns Failure, the chain stops and returns that error
        # If ALL steps return Success, we get Success(Rating) at the end

    def _verify_enrollment(
        self,
        student_id: str,
        offering_id: str
    ) -> Result[None, NotEnrolledError]:
        return (
            self.enrollment_repository.check_enrollment(student_id, offering_id)
            .and_then(lambda is_enrolled:
                Success(None) if is_enrolled else Failure(NotEnrolledError(student_id, offering_id))
            )
        )

    def _check_no_duplicate(
        self,
        student_id: str,
        offering_id: str
    ) -> Result[None, DuplicateRatingError]:
        return (
            self.rating_repository.find_existing(student_id, offering_id)
            .and_then(lambda rating:
                Failure(DuplicateRatingError(student_id, offering_id))
                if rating is not None
                else Success(None)
            )
        )
```

---

## How Result Operations Work (Detailed Explanation)

### `.and_then()` - Chain Operations That Can Fail

**Signature:** `Result[A, E].and_then(fn: A -> Result[B, E]) -> Result[B, E]`

**What it does:**
- If the Result is `Success(value)`, call `fn(value)` and return its Result
- If the Result is `Failure(error)`, skip `fn` and propagate the error

**Think of it like:** "If this succeeds, try the next operation; otherwise stop"

```python
# Example with real values
result: Result[bool, NotEnrolledError] = Success(True)  # Enrollment check passed

# .and_then() unwraps the True, calls the lambda, and returns its Result
next_result = result.and_then(lambda is_enrolled:
    self._check_no_duplicate(student_id, offering_id)  # Returns Result[None, DuplicateRatingError]
)
# next_result: Result[None, DuplicateRatingError | NotEnrolledError]

# ---

# If the first result failed:
result: Result[bool, NotEnrolledError] = Failure(NotEnrolledError(...))

# .and_then() SKIPS the lambda entirely, just returns the Failure
next_result = result.and_then(lambda is_enrolled:
    self._check_no_duplicate(student_id, offering_id)  # NEVER CALLED
)
# next_result: Result[None, NotEnrolledError]  ← Same error propagated
```

**Railway Analogy:**
```
Success track:  ═══╦═══ .and_then() ═══╦═══ continues...
                   ║                   ║
Failure track:  ═══╩═══════════════════╩═══ derails and stays on failure track
```

### `.map()` - Transform Success Value (Can't Fail)

**Signature:** `Result[A, E].map(fn: A -> B) -> Result[B, E]`

**What it does:**
- If the Result is `Success(value)`, call `fn(value)` and wrap result in Success
- If the Result is `Failure(error)`, skip `fn` and keep the error
- **Different from `.and_then()`:** The function returns a regular value (not Result)

```python
# Example: Transform rating to just its ID
result: Result[Rating, ServiceError] = Success(rating)

rating_id = result.map(lambda r: r.id)  # fn returns str, not Result
# rating_id: Result[str, ServiceError] = Success("uuid-123")

# ---

# If failed:
result: Result[Rating, ServiceError] = Failure(NotEnrolledError(...))

rating_id = result.map(lambda r: r.id)  # NEVER CALLED
# rating_id: Result[str, ServiceError] = Failure(NotEnrolledError(...))
```

**When to use:**
- `.map()` for transformations that can't fail (e.g., `rating.id`, `course.title`)
- `.and_then()` for operations that can fail (e.g., database queries, validation)

### `.lash()` - Handle Errors (View Layer)

**Signature:** `Result[A, E].lash(fn: E -> Result[A, E2]) -> Result[A, E2]`

**What it does:**
- If the Result is `Success(value)`, skip `fn` and keep the success
- If the Result is `Failure(error)`, call `fn(error)` to transform the error

**Use case:** Convert domain errors to HTTP exceptions in views

```python
# rating_app/views/rating_viewset.py
def create(self, request):
    params = RatingCreateParams(**request.data)
    result = self.rating_service.create_rating(params)  # Result[Rating, ServiceError]

    # Convert domain errors to DRF exceptions
    return result.lash(lambda error: self._handle_error(error))  # Convert error
                 .map(lambda rating: Response(  # On success, create response
                     RatingSerializer(rating).data,
                     status=201
                 ))
                 .unwrap()  # Safe because .lash() converted errors to exceptions

def _handle_error(self, error: ServiceError) -> NoReturn:  # Always raises
    match error:
        case NotEnrolledError(student_id=sid, offering_id=oid):
            raise PermissionDenied(f"Student {sid} not enrolled in {oid}")

        case DuplicateRatingError(student_id=sid, offering_id=oid):
            raise APIException(
                detail=f"Student {sid} already rated {oid}",
                code=409
            )

        case CourseOfferingNotFoundError(offering_id=oid):
            raise NotFound(f"Offering {oid} not found")
```

**Flow:**
```python
# Success case:
result = Success(rating)
result.lash(handle_error)  # Skips handle_error, keeps Success(rating)
      .map(create_response)  # Calls create_response(rating) → Success(Response)
      .unwrap()             # Returns Response

# Failure case:
result = Failure(NotEnrolledError(...))
result.lash(handle_error)  # Calls handle_error → raises PermissionDenied
      .map(create_response)  # NEVER REACHED (exception raised)
      .unwrap()             # NEVER REACHED
```

---

## Visual Example: Complete Flow

```python
# Let's trace create_rating step by step:

params = RatingCreateParams(student="s1", course_offering="o1", ...)

# Step 1: Check enrollment
result1 = self._verify_enrollment("s1", "o1")
# Returns: Success(None)  (student is enrolled)

# Step 2: Chain with .and_then() - check duplicate
result2 = result1.and_then(lambda _: self._check_no_duplicate("s1", "o1"))
# Since result1 is Success, lambda is called
# Returns: Success(None)  (no duplicate found)

# Step 3: Chain with .and_then() - create rating
result3 = result2.and_then(lambda _: self.rating_repository.create(params))
# Since result2 is Success, lambda is called
# Returns: Success(Rating(id="r1", ...))

# Final result: Success(Rating(...))

# ---

# Now imagine enrollment check fails:

result1 = self._verify_enrollment("s999", "o1")  # Student not enrolled
# Returns: Failure(NotEnrolledError(student_id="s999", offering_id="o1"))

result2 = result1.and_then(lambda _: self._check_no_duplicate("s999", "o1"))
# Since result1 is Failure, lambda is SKIPPED
# Returns: Failure(NotEnrolledError(...))  ← Same error propagated

result3 = result2.and_then(lambda _: self.rating_repository.create(params))
# Since result2 is Failure, lambda is SKIPPED
# Returns: Failure(NotEnrolledError(...))  ← Same error propagated

# Final result: Failure(NotEnrolledError(...))
# The chain "derailed" at step 1 and never tried steps 2 or 3
```

---

## Key Benefits in Real Code

**Before (Exceptions):**
```python
def create_rating(self, params):  # ❌ No idea what can fail
    is_enrolled = self.enrollment_repository.is_student_enrolled(...)
    if not is_enrolled:
        raise NotEnrolledException()  # Hidden in function body

    rating_exists = self.rating_repository.exists(...)
    if rating_exists:
        raise DuplicateRatingException()  # Hidden in function body

    return self.rating_repository.create(params)  # May raise IntegrityError
```

**After (Result Types):**
```python
def create_rating(
    self,
    params: RatingCreateParams
) -> Result[Rating, ServiceError]:  # ✅ Type shows exactly what can fail
    return (
        self._verify_enrollment(student_id, offering_id)
        .and_then(lambda _: self._check_no_duplicate(student_id, offering_id))
        .and_then(lambda _: self.rating_repository.create(params))
    )
    # Pyright enforces you handle all error cases in ServiceError union
```

**Benefits:**
1. **Type signature is documentation** - You know what can fail without reading code
2. **Pyright enforcement** - Can't forget to handle errors
3. **Cleaner composition** - No nested if-statements
4. **Explicit error flow** - Errors propagate automatically through `.and_then()` chains
5. **Railway-oriented** - Easy to see the "happy path" and "error path"

---

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
- Enable strict Pyright checking in `pyproject.toml`:
  ```toml
  [tool.pyright]
  typeCheckingMode = "strict"
  reportUnusedVariable = true
  reportUnusedImport = true
  ```
- Pyright will warn if Result types aren't handled properly
- Union types in error signatures enable exhaustiveness checking
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
- **Pyright Enforcement:** Type checker ensures all error cases are handled in service/repo layers
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
- **No type safety:** Pyright can't enforce that errors are handled in business logic
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
- [Pyright Type Checking](https://github.com/microsoft/pyright) - Enforces Result type handling

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
    # Pyright will check this!
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
