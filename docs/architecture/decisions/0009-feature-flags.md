# ADR-0009: Feature Flags with django-waffle

## Status

Proposed

## Date

2026-06-26

## Context

We want to ship behaviour behind runtime toggles (first real consumer: an
upcoming teacher text→file switch) without redeploying, and to gate the same
flag on both the Django/DRF backend and the Vite React SPA. The solution must
be self-hosted with no third-party SaaS egress, and evaluated per request user
so flags can be targeted (staff, groups, percentage rollout) later.

**Why we want this:**

- **Trunk-based development.** Merge unfinished or risky work to `main` behind a
  default-off flag, decoupling *deploy* from *release*. Avoids long-lived
  feature branches and the merge pain they create.
- **Safer rollouts.** Ship a feature dark, enable it gradually (percentage /
  staff first), and keep an instant **kill-switch** — a bad release is rolled
  back by flipping a flag in the admin, not by an emergency redeploy.
- **Click-through testing.** Toggle a flag in any environment (local, staging,
  prod) to exercise new behaviour on demand, instead of code-only or
  env-variable gates that need a restart.
- **Migration-gated code.** When new behaviour depends on a new field, keep it
  off until *after* the data migration that populates that field has run, then
  flip it on — closing the window where code expects data that does not exist
  yet.

## Decision

We will adopt **django-waffle** for flag storage and per-user evaluation, and
expose a read-only `GET /api/v1/flags/` DRF endpoint that returns a
`{flag_name: bool}` map.

- The endpoint serializes **only flags listed in a `PUBLIC_FEATURE_FLAGS`
  allowlist** (a `frozenset` in settings). A flag is public only when a
  developer adds it there in a reviewed PR, so the endpoint **fails closed** — a
  server-only flag can never leak through a naming mistake. (`fe_<feature>`
  remains a soft naming convention for readability, not the security boundary.)
- It is `AllowAny`: the header renders for anonymous visitors on `/`, so the
  flags fetch must not return 401 (which would trip the SPA's session-expiry
  interceptor). Anonymous callers get waffle's `AnonymousUser` defaults.
- The response is typed with `additionalProperties: boolean` so Orval generates
  `Record<string, boolean>` (a fixed-field serializer would freeze the key set
  at spec-generation time).

The frontend consumes it through a React Context provider
(`src/lib/feature-flags/`, mirroring `src/lib/auth/`) exposing
`useFeatureFlag(name)`. The provider exposes an `isReady` state; consumers gating
real content render nothing until flags resolve (no first-paint flash). A single
demo flag `fe_test_header` gates the literal "Test" text in the header.

## Consequences

### Positive

- ✅ Flags toggle at runtime via the Django admin, no redeploy.
- ✅ Self-hosted, no external egress or vendor lock-in.
- ✅ Reuses established patterns (IoC-wired DRF viewset; Context provider like
  auth), small surface area.
- ✅ `PUBLIC_FEATURE_FLAGS` allowlist keeps server-only flags off the public
  endpoint by construction: exposure is opt-in, fails closed, and is reviewed in
  a PR diff rather than enforced by a string match.

### Negative / Trade-offs

- ⚠️ Adds waffle DB tables (`Flag`/`Switch`/`Sample`) requiring a migration in
  dev/prod.
- ⚠️ Open SPA tabs only observe an admin toggle on the next flags refetch
  (provider sets `staleTime` + a refetch policy); they do not update instantly.
- ⚠️ The endpoint evaluates each flag in `PUBLIC_FEATURE_FLAGS` per request —
  fine at current flag counts, worth revisiting if it grows.

### Flag lifecycle

- **Exposure:** a flag is public only when listed in `PUBLIC_FEATURE_FLAGS`.
  `fe_<feature>` is a soft naming convention for readability; all other flags
  stay server-side regardless of name.
- **Temporary by default:** a flag and its code branches are debt. When a
  feature is fully rolled out (or dropped), remove it: delete the `Flag` row,
  delete the code consumer on both sides, and regenerate the OpenAPI spec.

## Considered Alternatives

### Alternative 1: Third-party flag SaaS (LaunchDarkly / Unleash / Flagsmith)

**Pros:** richer targeting UI, audit log out of the box.

**Cons:** external egress (or an extra self-hosted service + DB), cost, and
operational overhead.

**Reason for rejection:** disproportionate to current needs; waffle covers
admin UI, per-user targeting, and percentage rollout with zero new infra.

### Alternative 2: Hard-coded env/settings booleans

**Pros:** trivial, no dependency.

**Cons:** no runtime toggling, no per-user targeting, requires a redeploy per
change.

**Reason for rejection:** defeats the core goal of toggling without redeploy.

## References

- Issue [#623](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/623) —
  Introduce feature flags (django-waffle)
- [ADR-0006](0006-server-side-caching.md) — Server-Side Caching (the flags
  endpoint is intentionally left uncached so toggles are not served stale)
