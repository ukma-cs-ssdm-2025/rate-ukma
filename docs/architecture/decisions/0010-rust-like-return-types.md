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
  most per-domain modules in `src/backend/rating_app/exception/` subclass DRF's
  `NotFound`/`ValidationError`, so HTTP status mapping is automatic. This
  layering is the accepted ADR-0005 settlement. The mapping is convention, not
  total: `vote`/`rating` modules also use `PermissionDenied`/`APIException`,
  and `SemesterDoesNotExistError` is still a plain `Exception` (an unhandled
  semester-missing path escapes as 500 today) — the reviewer rule below covers
  keeping new exceptions inside the DRF hierarchy.
- **One envelope normalizes dict-shaped errors.** `rating_app/exception/exception_handler.py`
  converts dict-shaped DRF errors into `{detail, status, fields?}`. It does
  *not* cover list-detail errors: several views raise
  `ValidationError(detail=e.errors())`, which pass through as bare lists.
  That inconsistency predates this decision and is out of scope here — but it
  means a Result type would face the same single-choke-point work, not less:
  every `Err` would still need conversion into whatever the envelope becomes.
- **The frontend already depends on thrown errors.** The react-query defaults in
  `src/webapp/src/integrations/tanstack-query/RootProvider.tsx` retry on thrown
  query errors (never on 401/403); components consume the rest through
  `isError` (no `throwOnError` is configured anywhere, so query rejections
  never reach `components/ErrorBoundary.tsx` — that boundary is for render
  crashes), and transport failures redirect through the `apiClient`
  interceptor to the `connection-error.tsx` route. Returning `{ok, error}`
  objects from API hooks would silently disable retry (it operates on
  rejection) and force every call site to branch — the failure mode is a
  swallowed error, the worst kind.
- **Python has no language-level Result.** No `?` operator, no exhaustive
  `match` enforcement. A hand-rolled `Result` is a convention the type checker
  cannot enforce at every call site, so adoption would be partial by default.

## Decision

We will **keep exceptions as the error-signalling mechanism across layer and
network boundaries** and will not adopt Rust-like Result types codebase-wide.

Narrowly allowed, no migration needed: the `tuple[X, bool]` created/existing
idiom already exists and stays — `get_or_create`/`get_or_upsert` per
`rating_app/repositories/protocol.py` (also `comment_repository.py`),
`vote_service.upsert`. Same for tuples carrying plain data (paginated payloads,
year ranges) and internal pure helpers returning `None` where the outcome is
ordinary control flow (cache miss, cursor absent). The rule is semantic, not a
site list: if the caller must translate the outcome into an HTTP status or a
user-visible error, it arrives as an exception; if both outcomes are normal
control flow inside one layer, a plain return type is fine.

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

## Considered Alternatives

1. **Result<T, E> everywhere (backend services and repositories).**
   Honest benefits: fallibility visible in signatures, no hidden control flow,
   forces callers to decide; a single view-boundary adapter could translate
   `Err` into DRF exceptions in one place. Rejection reason: the adapter
   collapses to re-raising domain exceptions — Result with extra steps, while
   every service and repository method still changes signature and every
   caller still unwraps. All cost, and the one real benefit (exhaustiveness)
   is unenforceable in Python without a strict wrapper plus lint rules nobody
   maintains.
2. **Result only at the service layer, exceptions at the API boundary.**
   Honest benefit: explicit outcomes where business rules live, with one
   mapper translating `Err` to a DRF exception at the seam. Rejection reason:
   the mapper does not remove the exception handler, it prefaces it — every
   service returns Result only for views to immediately convert back into the
   exceptions the handler already understands. Splits the codebase's mental
   model for no observable gain.
3. **Frontend discriminated-union returns from API hooks, fetcher-wrapped.**
   Honest benefit: transport errors keep throwing (retry and `isError`
   preserved) while only domain errors ride the union. Rejection reason: two
   error channels — thrown transport failures vs returned domain failures —
   and every hook, component, and test must learn which is which. The orval
   generated layer would need a permanent fork to sustain it. Rejected
   outright.
