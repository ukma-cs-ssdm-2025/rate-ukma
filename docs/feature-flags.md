# Feature flags

How to add, toggle, and remove feature flags in rate-ukma. The rationale lives
in [ADR-0009](architecture/decisions/0009-feature-flags.md); this is the how-to.

## When a flag is worth it

A flag is debt with a deletion date, not a default. A client-facing one costs an
allowlist entry, a branch in the frontend, both states to test, and a cleanup PR
later; a server-only one costs the branch and the cleanup. Reach for either only
when the change is genuinely hard to land in a single safe step:

- **Trunk-based development** — the work merges to `main` in several PRs and is
  half-finished in between. The flag keeps the unfinished half invisible so the
  branch never has to live for weeks.
- **A large or risky change to existing behaviour** — a rewritten form, a new
  write path, a schema migration with a backfill behind it. The flag lets you
  deploy the code and turn it on separately, and turn it off without a rollback.
- **You need to see it in production before everyone else does** — target
  yourself or a few accounts, look at real data, then widen.

Do **not** add a flag for a self-contained change that is safe once merged, a
bug fix, copy or styling, or anything you would never realistically turn back
off. Ship those normally. A flag nobody will ever flip is a permanent `if` in
the code and a row nobody dares delete.

Rule of thumb: if you cannot say what would make you turn it **off** again, you
do not need it.

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
   PUBLIC_FEATURE_FLAGS = ["fe_my_new_flag"]
   ```
   No new endpoint, serializer, or OpenAPI regen needed — the response schema is
   a dynamic `Record<string, boolean>`, so it does not change when flags are
   added.

2. **Create the `Flag` row** in each environment: Django admin (Waffle ▸ Flags)
   or CLI —
   ```bash
   .venv/bin/python manage.py waffle_flag fe_my_new_flag --create
   ```
   `--create` is required; without it the command errors on a flag that does not
   exist yet. A fresh row has `everyone = NULL`, which means "decide per user"
   and evaluates to off for everyone until you target someone.

   The row is **not** needed to deploy with the feature off. A missing flag
   falls back to `WAFFLE_FLAG_DEFAULT`, which this project leaves unset, so
   waffle's own default of `False` applies and `/api/v1/flags/` reports it as
   `false`. Create the row when you want the switch to exist, not to keep the
   feature hidden.

   For a reproducible demo across envs, ship a data migration that creates it.

3. **Gate the UI** in the frontend:
   ```tsx
   import { useFeatureFlag } from "@/lib/feature-flags";

   const isOn = useFeatureFlag("fe_my_new_flag");
   return isOn ? <NewThing /> : <OldThing />;
   ```
   For non-trivial content where a flash of the wrong variant matters, use
   `useFeatureFlagState` — it returns the value *and* whether flags have
   resolved, so an unresolved flag is not silently treated as OFF:
   ```tsx
   import { useFeatureFlagState } from "@/lib/feature-flags";

   const { enabled, isReady } = useFeatureFlagState("fe_my_new_flag");
   if (!isReady) return null; // or a skeleton
   return enabled ? <NewThing /> : <OldThing />;
   ```
   Gate write paths on `isReady` too — submitting before flags resolve can
   persist the OFF variant's shape.

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
.venv/bin/python manage.py waffle_flag -l                    # current state
.venv/bin/python manage.py waffle_flag fe_my_new_flag --user me@ukma.edu.ua
.venv/bin/python manage.py waffle_flag fe_my_new_flag --user you@ukma.edu.ua --append
.venv/bin/python manage.py waffle_flag fe_my_new_flag --percent 25
.venv/bin/python manage.py waffle_flag fe_my_new_flag --everyone     # on for all
.venv/bin/python manage.py waffle_flag fe_my_new_flag --deactivate   # off for all
```

Two things that bite:

- **`--user` replaces the whole list** unless you pass `--append`. Same for
  `--group`. Adding a second tester without `--append` silently removes the
  first.
- **`--everyone` and `--deactivate` take no argument.** They set `everyone` to
  true and false. Leaving it `NULL` is the third state, and the only one where
  the per-user and per-group lists are consulted at all — setting `--everyone`
  or `--deactivate` overrides them for everybody.

The usual rollout: create the row, target yourself, verify against real
production data, widen to a group or a percentage, then `--everyone`.

```bash
.venv/bin/python manage.py waffle_flag fe_my_new_flag --create --user me@ukma.edu.ua
```

> Live env runs `sudo docker exec <container> python manage.py ...` (the image
> has Python on PATH, no venv prefix); dump the
> DB before any write. Anonymous users get waffle's `AnonymousUser` defaults
> (`WAFFLE_FLAG_DEFAULT`, currently off), so a per-user flag is invisible to
> logged-out visitors regardless of the list.

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

The flag gates what the UI renders, not what the API accepts: the backend does
not check it, so a rating can carry instructor links while the flag is off.
- **Frontend** — pass `flags` to `renderWithProviders`, which seeds the
  `FeatureFlagsContext` directly (no network, no mock):
  ```tsx
  render(<RatingForm />, { flags: { fe_instructor_multiselect: true } });
  ```
  Default is all-off. Test **both** states (see `RatingForm.test.tsx` /
  `RatingCardBody.test.tsx`). For hook/provider internals, mirror
  `src/webapp/src/lib/feature-flags/FeatureFlagsContext.test.tsx`.

## Remove a flag (do not skip)

Flags are temporary debt, and the deletion is the part everyone skips. Once a
feature is fully rolled out or dropped:

1. Delete the consumer code on both sides (the `flag_is_active` /
   `useFeatureFlag` call and the dead branch).
2. Remove the name from `PUBLIC_FEATURE_FLAGS`.
3. Delete the `Flag` row in each environment (Django admin, or the ORM — there
   is no `waffle_flag --delete`).

Do steps 1 and 2 together in one PR. A row left behind with no consumer is
harmless; an allowlisted name with no consumer is a permanently `false` entry in
every `/api/v1/flags/` response.
