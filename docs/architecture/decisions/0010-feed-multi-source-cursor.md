# ADR-0010: Feed Multi-Source Keyset Cursor

## Status

Proposed

## Date

2026-09-09

## Context

The activity feed merges independent content sources (course-review activity from
ratings, admin-authored posts from feed posts, and future dynamic sources from
#642) into one timeline, newest first. Issue #666 refactors the cursor so new
sources can join without changing the paging contract. The current
implementation already pages two sources with a single opaque cursor
(`FeedCursor`: base64url of `occurred_at.isoformat|uuid`), a per-source keyset
predicate (older timestamp, or equal timestamp with lower id), `limit + 1` rows
per source merged by `(occurred_at, id)` descending, pinned posts prepended on
the first page only (max 3), and a 400 for tokens the server did not issue.

## Decision

We will keep the single `(timestamp, id)` keyset cursor as the feed's paging
contract for any number of dynamic sources. Every source implements the same
two-method contract — `page(cursor, limit)` returning up to `limit + 1` rows
older than the cursor in `-timestamp, -id` order against its own timestamp
column, with UUID ids so the cross-source tie-break stays type-consistent —
and the service merges, truncates to `limit`, and mints `next_cursor` from the
last item. The documented ordering guarantee is the global
`(occurred_at desc, id desc)` order; walking `next_cursor` yields each row
exactly once. Pinned items stay out of the paging query and are prepended on
the first page only, and clients dedupe appended pages by id to absorb the
duplicate a newly inserted post can cause.

* ❌ Cursors are opaque but not signed; only decode validity is checked.

* ✅ New sources join without client or contract changes.
* ✅ No gaps or duplicates while the underlying rows are stable.
* ✅ Empty feed returns a null cursor; pins can never leak into page 2+.
* ⚠️ A post published mid-pagination shifts positions, so clients must dedupe.
* ⚠️ Each source is over-fetched by one row per page; negligible at feed sizes.

## Considered Alternatives

1. **Per-source cursor tuple (one watermark per source)**
    * Rejection Reason: leaks source topology to clients and complicates the
      merge when sources appear or disappear between pages.
2. **Offset paging**
    * Rejection Reason: inserts shift every offset, turning the common
      new-post case into guaranteed duplicates and skips.
