# Feature flags

How to add, toggle, and remove feature flags in rate-ukma. The rationale lives
in [ADR-0009](architecture/decisions/0009-feature-flags.md); this is the how-to.

## Model in one minute

- Backend uses [**django-waffle**](https://waffle.readthedocs.io/). Flags are DB
  rows (`Flag`) evaluated **per request user** via `waffle.flag_is_active(request, name)`.
- `GET /api/v1/flags/` returns `{ "flags": { name: bool } }` for the current
  user, but **only for flags listed in the `PUBLIC_FEATURE_FLAGS` allowlist**
  (`src/backend/rateukma/settings/_base.py`). The endpoint is `AllowAny` and
  intentionally uncached.
- The frontend consumes it through `src/webapp/src/lib/feature-flags/`:
  `useFeatureFlag(name)` returns a boolean; `useFeatureFlags()` also gives
  `isReady`.

### Two kinds of flags

| | Where it lives | Exposed to the browser? |
|---|---|---|
| **Client-facing** | name in `PUBLIC_FEATURE_FLAGS`, conventionally `fe_<name>` | Yes, via `/api/v1/flags/` |
| **Server-only** | any flag **not** in the allowlist | No — never serialized |

`PUBLIC_FEATURE_FLAGS` is the **security boundary** (fails closed). A flag is
public only when a developer adds it to that list in a reviewed PR — a naming
mistake cannot leak a server-only flag. `fe_` is a readability convention, not
the boundary. **Never add a sensitive/server-only flag to the allowlist.**

## Add a new client-facing flag

Exposing a *new* flag name is a code change (allowlist + frontend consumer), so
it ships with a deploy. **Toggling** an already-exposed flag is runtime-only
(Django admin), no deploy.

1. **Allowlist it** — add the name to `PUBLIC_FEATURE_FLAGS` in
   `src/backend/rateukma/settings/_base.py`:
   ```python
   PUBLIC_FEATURE_FLAGS = ["fe_test_header", "fe_my_new_flag"]
   ```
   No new endpoint, serializer, or OpenAPI regen needed — the response schema is
   a dynamic `Record<string, boolean>`, so it does not change when flags are
   added.

2. **Create the `Flag` row** in each environment (default off): Django admin
   (Waffle ▸ Flags) or CLI —
   ```bash
   .venv/bin/python manage.py waffle_flag fe_my_new_flag --everyone off
   ```
   For a reproducible demo across envs, ship a data migration that creates it.

3. **Gate the UI** in the frontend:
   ```tsx
   import { useFeatureFlag } from "@/lib/feature-flags";

   const isOn = useFeatureFlag("fe_my_new_flag");
   return isOn ? <NewThing /> : <OldThing />;
   ```
   For non-trivial content where a flash of the wrong variant matters, wait for
   `isReady` so you do not render the OFF state before flags resolve:
   ```tsx
   import { useFeatureFlags } from "@/lib/feature-flags";

   const { flags, isReady } = useFeatureFlags();
   if (!isReady) return null; // or a skeleton
   return flags.fe_my_new_flag ? <NewThing /> : <OldThing />;
   ```

## Server-only flags

For backend-only behaviour, create a `Flag` **not** in `PUBLIC_FEATURE_FLAGS`
and check it in a view/service:
```python
from waffle import flag_is_active

if flag_is_active(request, "new_pipeline"):
    ...
```
It is never exposed through the API.

## Toggle / target a flag

Runtime, no deploy. Django admin (Waffle ▸ Flags) or CLI. A `Flag` supports:

- `everyone` — master on/off for all users.
- `users` / `groups` — explicit allowlists.
- `percent` — sticky percentage rollout.
- `staff` / `superusers` / `authenticated` — role targeting.

```bash
.venv/bin/python manage.py waffle_flag fe_my_new_flag --everyone on
.venv/bin/python manage.py waffle_flag fe_my_new_flag --percent 25
```

> Live env runs `sudo docker exec <backend-container> ...`; dump the DB before
> any write. Anonymous users get waffle's `AnonymousUser` defaults
> (`WAFFLE_FLAG_DEFAULT`, currently off).

## Override a flag in the browser (QA / Playwright)

Waffle evaluates flags per user on the server, so you cannot flip one from the
browser by editing a cookie. The frontend adds a thin client-side override layer
(`src/webapp/src/lib/feature-flags/overrides.ts`) that **wins over** the
`/api/v1/flags/` response, so QA and E2E can force a flag on/off without touching
the backend.

Overrides live in `localStorage` under `ff:overrides` and are enabled in
**every** environment, including live. They only change client-side display
gating — the write path is validated server-side regardless — so this is a
convenience affordance, **not** a security boundary.

**From the browser console** (helpers exposed on `window`):
```js
featureFlags.set("fe_instructor_multiselect", true)   // force on,  then reload
featureFlags.set("fe_instructor_multiselect", false)  // force off, then reload
featureFlags.clear("fe_instructor_multiselect")        // back to the server value
featureFlags.clearAll()                                // drop all overrides
featureFlags.list()                                    // inspect current overrides
```

**From Playwright** — seed before navigation (runs on every page load):
```ts
import { setFeatureFlagOverride } from "../shared/feature-flags";

await setFeatureFlagOverride(page, "fe_instructor_multiselect", true);
await page.goto(...);
```
Cover both variants by setting the flag on in one spec and off in another (see
`tests/e2e/ratings/instructor-multiselect.spec.ts` for the on path and
`instructor-legacy.spec.ts` for the legacy off path).

## Test

- **Backend** — force a state without DB rows, and pin the allowlist:
  ```python
  from waffle.testutils import override_flag

  @override_flag("fe_my_new_flag", active=True)
  def test_on(api_client, settings):
      settings.PUBLIC_FEATURE_FLAGS = ["fe_my_new_flag"]
      ...
  ```
  Always test **both** states. See `src/backend/rating_app/views/test_flags.py`.
- **Frontend** — pass `flags` to `renderWithProviders`, which seeds the
  `FeatureFlagsContext` directly (no network, no mock):
  ```tsx
  render(<RatingForm />, { flags: { fe_instructor_multiselect: true } });
  ```
  Default is all-off. Test **both** states (see `RatingForm.test.tsx` /
  `RatingCardBody.test.tsx`). For hook/provider internals, mirror
  `src/webapp/src/lib/feature-flags/FeatureFlagsContext.test.tsx`.

## Remove a flag (do not skip)

Flags are temporary debt. Once a feature is fully rolled out or dropped:

1. Delete the consumer code on both sides (the `flag_is_active` /
   `useFeatureFlag` call and the dead branch).
2. Remove the name from `PUBLIC_FEATURE_FLAGS`.
3. Delete the `Flag` row in each environment.
