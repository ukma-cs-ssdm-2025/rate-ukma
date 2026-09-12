# ADR-0010: Feed Sources via a `feed_event` Table

## Status

Proposed

## Date

2026-09-10

## Context

The activity feed (`GET /feed/`) merges exactly two hardcoded sources — commented `Rating` rows
and admin-authored `FeedPost` rows. `FeedService.get_feed_page` does this by scatter-gather:
each source runs its own keyset query for `limit + 1` rows, the results are concatenated, sorted
in Python by `(occurred_at, id)` and truncated to `limit`.

We intend the feed to carry more kinds over time — comments on reviews, course/offering changes,
achievements and milestones — and adding one should be a cheap, isolated change. Four forces
push against the current design:

- **Per-page cost grows linearly in sources, and most of the work is discarded.** With five
  sources a page costs five queries and `5 × (limit + 1)` rows to return `limit`. The waste is
  systematic rather than incidental: a high-volume source dominates every page, so low-volume
  sources re-scan and re-map their rows on every page forever, only to have them thrown away.
- **Cross-cutting concerns have nowhere to live.** Pinning exists only in `FeedPostRepository`.
  Visibility (`is_active`, `published_at <= now`, `comment != ""`) is reimplemented per source.
  There is no place to express collapsing repetitive events, ranking, or hiding events whose
  subject was deleted.
- **Three separate cache-invalidation mechanisms already coexist**: the domain-event observer
  bus for ratings (`RatingCacheInvalidator`), a Django signal for feed posts (`signals.py`,
  because admin writes bypass the service layer), and a Redis watermark for future-dated posts
  (`FeedService.refresh_next_publish_marker`). Each new source forces a fourth decision about
  which mechanism applies.
- **Synthetic events cannot be represented at all.** "Course X reached 50 reviews" is not a row
  in any table, so no scatter-gather source can page over it.

Personalisation (per-user feeds) is explicitly out of scope; the feed stays global, fronted by a
60-second `@rcached` entry under the `feed:list` namespace.

## Decision

We will introduce a **`feed_event` table that acts as an index, not a content store**, and make
it the feed's single read source.

1. **One row per feed-worthy occurrence**, holding only ordering and visibility metadata plus a
   generic pointer at the source row: `event_type`, `occurred_at`, `is_visible`, `pinned`, and a
   `content_type`/`object_id` `GenericForeignKey`. This mirrors the shape `Notification` already
   uses, so the pattern is established in this codebase rather than new.
2. **Reads become one keyset query plus batched hydration.** `FeedEventRepository.get_page`
   returns `limit + 1` lightweight rows; a hydration registry groups them by `event_type` and
   issues one `filter(id__in=...)` per kind actually present on the page, reusing the existing
   `FeedReviewMapper` and `FeedPostMapper` unchanged. Cost is bounded by the number of kinds,
   not by page size or by the number of registered sources.
3. **We will not snapshot content into the event row.** Cards are hydrated live from the source
   tables on every read, so edits never go stale and deletions need no payload propagation. A
   `payload` JSON column will be added later, as a purely additive migration, only when the
   first synthetic kind (achievements) actually lands.
4. **Two partial indexes serve exactly the two read queries** — the body page
   (`is_visible AND NOT pinned`) and the pinned prefix (`is_visible AND pinned`) — both ordered
   `(-occurred_at, -id)`.
5. **Writes reach the index through the domain-event bus where one exists, and Django
   signals where none does.** `RatingService` emits a `RatingEvent(rating, action)` envelope —
   mirroring `CommentEvent` — and a `RatingFeedUpdateObserver` keeps the index in step;
   `FeedPost` is authored in Django admin and never reaches a service, so a thin `post_save`
   receiver feeds it instead. Both delegate to one `FeedUpdateService`, keyed idempotently on
   `(content_type, object_id)` by a unique constraint, and both write inside the caller's
   transaction so a source row and its index entry commit or roll back together —
   `RatingService` wraps each mutation together with its `notify()` in `transaction.atomic()`,
   and Django admin already does the same around a `FeedPost` save. **Deletion needs
   no application code at all**: each source model declares the reverse
   `GenericRelation("rating_app.FeedEvent")`, so the ORM collector cascades the index entry on
   every delete path — service, admin, `QuerySet.delete()`, and cascades from a parent row.
6. **Cache invalidation collapses to a single trigger.** Every path that changes the feed now
   writes `feed_event`, so one `post_save`/`post_delete` receiver on that model owns the
   `feed:list` namespace bump. The bumps in `RatingCacheInvalidator` and in the existing
   `FeedPost` receiver become dead code and are removed. The scheduling watermark likewise moves
   from `FeedPostRepository.get_next_future_publication_time` to
   `FeedEventRepository.get_next_future_occurrence`, so scheduling generalises to any kind.
7. **The public contract does not move.** `FeedCursor` is unchanged — it now addresses one table
   instead of two, which is strictly the simpler case its `filter(timestamp_field)`
   parameterisation already supports. The serializers, view, DTOs, generated OpenAPI schema and
   the entire frontend are untouched.

The migration is phased: phase 1 ships the model, backfill and projection with nothing reading
the table; phase 2 flips the read path and deletes the superseded source queries.

## Consequences

- ✅ Adding a source-backed kind touches four backend files (choices, DTO+mapper, hydrator,
  projector) and never `FeedService`, `FeedCursor` or pagination.
- ✅ A page costs one keyset query plus at most one query per kind on that page, instead of one
  query and `limit + 1` wasted rows per registered source.
- ✅ Pinning, visibility and scheduling become plain columns on one table, queried once, instead
  of per-source predicates.
- ✅ Three invalidation mechanisms collapse into one; the `feed:list` bump gets a single owner.
- ✅ `has_more` becomes a genuine `limit + 1` probe on one ordered query rather than a heuristic
  over two independently over-fetched sources.
- ✅ Synthetic events (achievements) become representable, via a later additive `payload` column.
- ✅ No API or frontend change, so the refactor is verified by existing tests passing unedited.
- ⚠️ A second table must be kept in step with the sources on the write side. Writes that bypass
  both the bus and signals (`QuerySet.update()`, `bulk_create`, raw SQL) leave an item silently
  absent or stale; the unique constraint makes re-projection safe, and a backfill command can
  repair drift.
- ⚠️ A page can return fewer than `limit` cards if an entry's source row is gone. With the
  reverse `GenericRelation` this can only happen through raw SQL or `_raw_delete`, since every
  ORM delete path cascades. The read path tolerates it anyway: the cursor is minted from the
  last _row_ rather than the last hydrated item, so paging still advances; the cost is one short
  page.
- ⚠️ Cursors issued by the old code during the deploy address a `Rating`/`FeedPost` id rather
  than a `FeedEvent` id, giving a reader mid-scroll one page with a wrong tie-break. Accepted on
  an opt-in feature (`fe_feed`) in preference to versioning the cursor, which would surface as a 400.
- ⚠️ Each rating or post save carries one extra write, in the same transaction. That is the
  cost of atomicity: a failed index write fails the source write with it, rather than leaving a
  row the feed silently never shows. Only the Redis cache bump runs in `transaction.on_commit`,
  since Redis cannot roll back with the database.
- ❌ Feed content is no longer readable from a single table — debugging a card means joining the
  event to its source. Read-only Django admin for `FeedEvent` mitigates this.

## Considered Alternatives

1. **Generalise the current scatter-gather behind an `IFeedSource` protocol.**
   Each source implements `fetch(cursor, limit)`; `FeedService` loops over an injected list.
   - Rejection Reason: cheapest change and a reasonable stopgap, but it addresses none of the
     four forces — per-page cost stays linear in sources, pinning and visibility still have no
     home, the three invalidation mechanisms remain, and achievements are still unrepresentable.

2. **Push the merge into SQL — `UNION ALL` over normalised subqueries, or a Postgres view.**
   - Rejection Reason: buys the single-query read without the ability to hold pinning,
     visibility or collapsing as first-class columns, still cannot represent synthetic events,
     and costs readability and unit-testability — every test needs a real database and each
     source contributes a padded `SELECT` arm.

3. **`feed_event` carrying a full `payload` snapshot, rendering cards straight from JSON.**
   - Rejection Reason: the apparent shortcut is the trap. Saving the hydration queries means a
     course title, rating average or comment edit leaves stale cards, so every source needs
     update-propagation listeners — strictly more work than one batched `filter(id__in=...)`,
     for a read saving the existing 60-second cache already provides.

4. **Django signals for every source, including ratings.**
   - Rejection Reason: the bus is the codebase's stated path for rating reactions (aggregates,
     cache, notifications) and is explicit and discoverable where signals are not. Its one
     defect — `RatingService` notified the identical DTO on create, update and delete — was a
     bug to fix with an action envelope, not a reason to route around it. Signals remain only
     for `FeedPost`, which has no service to observe.
