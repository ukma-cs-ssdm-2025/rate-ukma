# ADR-0010: Error Handling — Exceptions over Rust-like Result Types

## Status

Proposed

## Date

2026-09-09

## Context

The issue asks whether Rust-like return types (`Result<T, E>`, where every
fallible call returns either a value or an error the caller must unwrap) would
benefit this codebase. The forces that decide this are already in the tree:

- **Backend errors cross three layers as exceptions.** Repositories catch ORM
  failures and re-raise domain exceptions (`Rating.DoesNotExist` →
  `RatingNotFoundError` in `src/backend/rating_app/repositories/rating_repository.py`);
  services raise business-rule exceptions (`NotEnrolledException`,
  `DuplicateRatingException` in `src/backend/rating_app/services/rating_service.py`);
  per-domain modules in `src/backend/rating_app/exception/` subclass DRF's
  `NotFound`/`ValidationError`, so HTTP status mapping is automatic. This
  layering is the accepted ADR-0005 settlement.
- **One envelope normalizes everything.** `rating_app/exception/exception_handler.py`
  converts any DRF exception into `{detail, status, fields?}`. A Result type
  would still need a single choke point that converts `Err` into exactly this
  envelope — i.e. it re-implements the handler.
- **The frontend already depends on thrown errors.** The react-query defaults in
  `src/webapp/src/integrations/tanstack-query/RootProvider.tsx` retry on thrown
  query errors (never on 401/403), and `components/ErrorBoundary.tsx` plus the
  `connection-error.tsx` route catch what propagates. Returning `{ok, error}`
  objects from API hooks would silently disable retry and boundary handling
  unless every call site unwraps — the failure mode is a swallowed error, the
  worst kind.
- **Python has no language-level Result.** No `?` operator, no exhaustive
  `match` enforcement. A hand-rolled `Result` is a convention the type checker
  cannot enforce at every call site, so adoption would be partial by default.

## Decision

We will **keep exceptions as the error-signalling mechanism across layer and
network boundaries** and will not adopt Rust-like Result types codebase-wide.

Narrowly allowed, no migration needed: two Result-shaped idioms already exist
and stay. Repository `get_or_create`/`get_or_upsert` return
`tuple[T_DTO, bool]` per `rating_app/repositories/protocol.py`, and internal
pure helpers may return `None` / tuples where the "error" is an ordinary,
expected outcome (e.g. cache miss, cursor absent). The rule: if the caller must
translate the outcome into an HTTP status or a user-visible error, it arrives
as an exception; if both outcomes are normal control flow inside one layer, a
plain return type is fine.

## Consequences

- ✅ Zero migration cost; ADR-0005's validation/repository/service split is untouched.
- ✅ DRF status mapping, the error envelope, react-query retry, and error
  boundaries keep working with no call-site changes.
- ✅ Newcomers meet one rule (raise domain exceptions, let the handler shape
  them) instead of two competing conventions.
- ⚠️ Discipline stays convention-based: in review, any service/repository
  method that returns `None`, `False`, or an empty collection to signal
  *failure* (as opposed to a legitimate empty result) must raise a domain
  exception instead. Returning `None` for "not found" is the exact bug shape
  this ADR bans.
- ❌ We forgo compiler-enforced exhaustiveness — accepted because Python cannot
  provide it without a heavyweight wrapper type.

## When to Revisit

If Python gains enforced exhaustiveness (or the team adopts a validated
`Result` wrapper with lint rules that actually fire), reopen this ADR and
re-run the cost analysis. Until then, new "Result-like" helpers are rejected
in review by citing this record.

## Considered Alternatives

1. **Result<T, E> everywhere (backend services and repositories).**
   Rejection reason: every service and repository method changes signature;
   every caller must unwrap; the DRF handler must still convert `Err` to HTTP —
   all cost, and the one real benefit (exhaustiveness) is unenforceable in
   Python without a strict wrapper plus lint rules nobody maintains.
2. **Result only at the service layer, exceptions at the API boundary.**
   Rejection reason: two conventions with a translation seam in the views, and
   the seam duplicates the existing exception handler. Splits the codebase's
   mental model for no observable gain.
3. **Frontend discriminated-union returns from API hooks.**
   Rejection reason: breaks react-query retry semantics and error boundaries by
   default; every existing hook and test would need unwrap logic. Rejected
   outright.
