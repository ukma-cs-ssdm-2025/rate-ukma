# ADR-0016: Record Every Sign-in as a `SignIn` Row

## Status

Accepted

## Date

2026-11-11

## Context

The product analytics spec ([docs/product/metrics.md](../../product/metrics.md)) asks whether people come
back: active users over the last 30 days and retention by registration cohort. The only record of
when people visit is `auth_user.last_login`, which every sign-in overwrites. Two visits and
twenty look the same, and earlier visits cannot be recovered.

The forces:

- **Start early.** A sign-in that is not recorded is lost.
- **The backend already sees every sign-in.** Every way to sign in ends in Django's `login()`,
  which sends `user_logged_in`. The same signal already updates `last_login`.
- **Analytics reads anonymised views.** The spec says every analytics query reads anonymised views;
  #810 adds them, with a read-only role to read them.
- **A sign-in must never fail because of analytics.** Django's `login()` sends the signal without
  catching errors, so an uncaught error in a receiver turns a sign-in into a server error.

## Decision

We will record every sign-in as one row of a new `SignIn` model.

1. **Shape:** `SignIn(user, signed_in_at)`: one row per sign-in, added and never changed.
2. **Write path:** a receiver on Django's `user_logged_in` signal in `rating_app/signals.py`. A
   signal, because no service of ours sees a sign-in, which is the same reason
   [ADR-0010](0010-feed-event-table.md) uses one for `FeedPost`.
3. **Failure:** the write runs in its own `transaction.atomic()`. A `DatabaseError` is logged as
   `sign_in_record_failed` with the user id only, and the sign-in goes on.
4. **Identity:** the row keeps the plain user id, not a hash. Anonymisation will happen in the
   views from #810: no view will expose the user id, and the read-only role will not read this
   table. The id lets those views join to `auth_user` for the registration date and filter out
   accounts that are not people.
5. **Deletion:** rows go with the account (`on_delete=CASCADE`), as comments and notifications do.
6. **No backfill:** no rows are added for the time before release. The last 30 days can be
   counted from `last_login`; the table is only needed for history, which starts at release.

## Consequences

- ✅ Return and retention can be counted from the release on, with every sign-in.
- ✅ One table and one receiver; nothing new to run or schedule.
- ⚠️ A sign-in is not a visit. A session lasts three hours of inactivity, so someone who comes back
  the same afternoon does not sign in again. Page views belong to event collection.
- ⚠️ Not every sign-in is a person. The `warmup` command signs a test user in on every deploy, the
  end-to-end tests sign in on every live deploy, and staff sign in to the admin. The views in #810
  have to filter them out.
- ⚠️ A sign-in whose row fails to write is lost; it is logged, not retried.
- ⚠️ The table holds a user id. Anyone with full database access can see who signed in when, as
  they already can see who wrote which review. The protection will be the read-only role from #810.
- ❌ Deleting an account removes its history, so past retention figures can shift slightly after a
  deletion.

## Considered Alternatives

1. **A weekly snapshot of `last_login`, written by a scheduled GitHub Actions job.**
   - Rejection Reason: keeps one sign-in per user per week instead of all of them, needs a schedule
     reaching staging and live over SSH, and a missed run loses that week for good.
2. **Storing an HMAC of the user id under a secret key instead of the id.**
   - Rejection Reason: to join to `auth_user` for cohorts and to filter out service accounts, the
     #810 views would need the key too, so it would sit with the database and add little against
     someone with full access. A missing secret would also fail every deploy.
3. **Recording sign-ins from the frontend as events.**
   - Rejection Reason: the server already sees each sign-in; a frontend event can be blocked or
     lost and adds a pipeline this does not need.
