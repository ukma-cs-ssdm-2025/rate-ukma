# Feed: materialised `feed_event` table (implementation plan)

**Status:** Implemented (see deviations at the end) · **Date:** 2026-09-10 · **Scope:** backend only, no API or frontend change

---

## Context

`FeedService.get_feed_page` merges exactly two hardcoded sources — commented `Rating` rows and
admin-authored `FeedPost` rows — by scatter-gather: each source runs its own keyset query for
`limit + 1` rows, the results are concatenated, sorted in Python and truncated.

We want the feed to carry more kinds over time (comments on reviews, course/offering changes,
achievements/milestones). Four things block that today:

1. **Cost grows linearly in sources and most of it is discarded.** With 5 sources a page costs
   5 queries and `5 × (limit+1)` rows to return `limit`. The waste is systematic: a high-volume
   source dominates every page, so low-volume sources re-scan and re-map rows on every page
   forever, only to have them thrown away.
2. **Cross-cutting concerns have no home.** Pinning lives only in `FeedPostRepository`.
   Visibility (`is_active`, `published_at <= now`, `comment != ""`) is reimplemented per source.
   There is nowhere to express collapsing, ranking, or hiding events for deleted objects.
3. **Three different invalidation mechanisms** already coexist — the observer bus for ratings
   (`domain_event_listeners/cache_invalidator.py`), a Django signal for feed posts
   (`signals.py`, because admin writes bypass the service layer), and a Redis watermark for
   future-dated posts (`FeedService.refresh_next_publish_marker`). A fourth source means a
   fourth decision about which one applies.
4. **Achievements have no row to page over.** "Course X reached 50 reviews" is not a row in any
   table, so no scatter-gather source can produce it.

Personalisation is explicitly out of scope — the feed stays global.

## Decision

Introduce a **`feed_event` table that acts as an index, not a content store**: one row per
feed-worthy occurrence, holding only ordering and visibility metadata plus a generic pointer at
the source row. Reads become one keyset query over that table, followed by one batched hydration
query per kind actually present on the page. Content is always read live from the source tables,
so edits never go stale and deletes need no payload propagation.

Rejected alternatives are recorded at the bottom.

**Deliberately unchanged:** `pagination/cursor.py`, `serializers/feed.py`,
`views/feed_viewset.py`, every DTO in `application_schemas/feed.py`, the generated OpenAPI
schema, and the entire frontend. `useFeed.ts` treats the cursor as opaque and uses `item.id`
only as a React key, so the API contract holds exactly.

---

## The model

`rating_app/models/feed_event.py`

```python
class FeedEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=40, choices=FeedEventType.choices)

    # The source's own timestamp (Rating.created_at, FeedPost.published_at).
    # May be in the future: that is how scheduling works.
    occurred_at = models.DateTimeField()

    # Denormalised from the source so the read path needs no per-kind predicate.
    is_visible = models.BooleanField(default=True)
    pinned = models.BooleanField(default=False)

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    source = GenericForeignKey("content_type", "object_id")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(
                fields=["-occurred_at", "-id"],
                name="feed_event_keyset_idx",
                condition=Q(is_visible=True, pinned=False),
            ),
            models.Index(
                fields=["-occurred_at"],
                name="feed_event_pinned_idx",
                condition=Q(is_visible=True, pinned=True),
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "object_id"],
                name="unique_feed_event_source",
            ),
        ]
```

`FeedEventType` goes in `models/choices.py` next to `FeedPostAccent`:

```python
class FeedEventType(models.TextChoices):
    REVIEW_PUBLISHED = "REVIEW_PUBLISHED", "Review published"
    POST_PUBLISHED = "POST_PUBLISHED", "Post published"
```

Three notes on the shape:

- **The unique constraint is load-bearing.** `RatingService.notify` fires the same `RatingDTO`
  on create *and* update (`services/rating_service.py:181,190,213`), so the projector must be
  idempotent. `update_or_create` keyed on `(content_type, object_id)` makes it so.
- **The partial indexes are exactly the two read queries** — the page and the pinned prefix —
  so both are index-only scans and neither pays for invisible or future rows beyond the
  `occurred_at` bound.
- **`Notification` (`models/notification.py`) is the precedent** for the `event_type` +
  `content_type`/`object_id` GFK shape. This is an established pattern here, not a new one.

### No `payload` column in this change

Synthetic events (achievements) will need one, since they have no source row. It is a purely
additive `JSONField(default=dict, blank=True)` plus making `content_type`/`object_id` nullable —
about six lines and one migration, applied when the first synthetic kind actually lands. Adding
it now would be speculative and would invite kinds to snapshot content, which is precisely the
failure mode this design avoids. The seam is documented under *Adding a new kind* below.

---

## Write path — projection

Projection is done by **Django signals delegating to a service**, not by the observer bus. The
reasons are concrete, not stylistic:

- `RatingService.delete_rating` calls `self.notify(rating)` with the same payload as create and
  update, so an `IEventListener[RatingDTO]` **cannot tell a delete from a write**. A
  `post_delete` signal can.
- `FeedPost` is authored in Django admin and never reaches the service layer — `signals.py`
  already exists for exactly this reason and says so in a comment.

To keep the logic inside the service layer as CLAUDE.md requires, the receivers stay thin
adapters over a service.

`rating_app/services/feed_projection_service.py`

```python
class FeedProjectionService:
    def __init__(self, feed_event_repository: FeedEventRepository): ...

    def project_rating(self, rating: Rating) -> None:
        self.feed_event_repository.upsert_for_source(
            event_type=FeedEventType.REVIEW_PUBLISHED,
            source=rating,
            occurred_at=rating.created_at,
            is_visible=bool(rating.comment),   # the feed shows commented ratings only
        )

    def project_post(self, post: FeedPost) -> None:
        self.feed_event_repository.upsert_for_source(
            event_type=FeedEventType.POST_PUBLISHED,
            source=post,
            occurred_at=post.published_at,
            is_visible=post.is_active,
            pinned=post.pinned,
        )

    def retract(self, source: models.Model) -> None:
        self.feed_event_repository.delete_for_source(source)
```

`rating_app/signals.py` gains receivers on `Rating` and extends the existing `FeedPost` one,
all wrapped in `transaction.on_commit` like the current code:

```python
@receiver(post_save, sender=Rating)
def project_rating_to_feed(sender, instance, **kwargs) -> None:
    transaction.on_commit(lambda: feed_projection_service().project_rating(instance))

@receiver(post_delete, sender=Rating)
def retract_rating_from_feed(sender, instance, **kwargs) -> None:
    transaction.on_commit(lambda: feed_projection_service().retract(instance))
```

**Cache invalidation collapses to one trigger.** A single `post_save`/`post_delete` receiver on
`FeedEvent` bumps `FEED_NAMESPACE`. The `FEED_NAMESPACE` bumps in
`RatingCacheInvalidator.on_event` and in the existing `FeedPost` receiver are then dead and get
removed — every path that changes the feed now goes through a `feed_event` write. This is the
main reason to do this refactor at all, beyond query count.

**The watermark generalises.** `FeedService.refresh_next_publish_marker` currently asks
`FeedPostRepository.get_next_future_publication_time()`. It moves to
`FeedEventRepository.get_next_future_occurrence()` (`is_visible=True, occurred_at__gt=now()`,
earliest first), so scheduling works for any future kind, not just posts.

---

## Read path — hydration

`rating_app/repositories/feed_event_repository.py` returns a thin row DTO, not a card:

```python
@dataclass(frozen=True, slots=True)          # in application_schemas/feed.py
class FeedEventRow:
    id: uuid.UUID
    event_type: FeedEventType
    occurred_at: datetime.datetime
    object_id: uuid.UUID
```

```python
def get_page(self, cursor: FeedCursor | None, limit: int) -> list[FeedEventRow]:
    events = FeedEvent.objects.filter(
        is_visible=True, pinned=False, occurred_at__lte=timezone.now()
    )
    if cursor is not None:
        events = events.filter(cursor.filter("occurred_at"))   # unchanged helper
    return self._map(events.order_by("-occurred_at", "-id")[: limit + 1])
```

`FeedCursor` needs no change at all: it now addresses one table instead of two, which is
strictly the simpler case its `filter(timestamp_field)` parameterisation already supports.

Hydrators live in `rating_app/services/feed_hydration/`, one per kind, behind a protocol in the
style of `rateukma/protocols` `IProcessor`:

```python
class IFeedItemHydrator(Protocol):
    def hydrate(self, rows: list[FeedEventRow]) -> dict[uuid.UUID, FeedItemBase]: ...
```

`ReviewItemHydrator` runs one `Rating.objects.select_related("course_offering__course",
"course_offering__semester").filter(id__in=ids)` and **reuses the existing `FeedReviewMapper`**;
`PromoItemHydrator` does the same for `FeedPost` with the existing `FeedPostMapper`. No new
mapping code is written — the mappers in `to_domain_mappers.py` are already exactly right.

`FeedHydrator` (the registry) groups rows by `event_type`, calls each hydrator once, and
reassembles in row order:

```python
def hydrate(self, rows: list[FeedEventRow]) -> list[FeedItemBase]:
    by_type = defaultdict(list)
    for row in rows:
        by_type[row.event_type].append(row)

    resolved: dict[uuid.UUID, FeedItemBase] = {}
    for event_type, group in by_type.items():
        resolved |= self._hydrators[event_type].hydrate(group)

    # An event whose source row is gone simply drops out — no payload to go stale,
    # and no delete propagation to get wrong.
    return [resolved[row.object_id] for row in rows if row.object_id in resolved]
```

Cost per page: **1 keyset query + at most one query per kind present on that page** — bounded by
the number of kinds, not by page size or by the number of registered sources.

### `FeedService` after the change

```python
def get_feed_page(self, cursor: str | None, limit: int) -> FeedPage:
    position = FeedCursor.decode(cursor) if cursor else None

    rows = self.feed_event_repository.get_page(cursor=position, limit=limit)
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = self.hydrator.hydrate(rows)

    # Minted from the last *row*, not the last item: a row dropped by hydration
    # must still advance the cursor, or paging stalls on an orphaned event.
    next_cursor = FeedCursor(rows[-1].occurred_at, rows[-1].id).encode() if has_more and rows else None

    if position is None:
        items = self.hydrator.hydrate(self.feed_event_repository.get_pinned()) + items

    return FeedPage(items=items, next_cursor=next_cursor)
```

Two behaviours worth naming explicitly:

- **`has_more` gets more correct.** Today it is `len(merged) > limit` across two independently
  over-fetched sources; now it is a single `limit + 1` probe on one ordered query.
- **A page can come back short.** If a source row was hard-deleted without its event being
  retracted (bulk delete, raw SQL, `queryset.delete()` which does fire `post_delete`, or a
  cascade), hydration drops it. The cursor still advances, so paging continues correctly and the
  user sees `limit - 1` cards once. This is the accepted cost of not snapshotting payloads. A
  `purge_orphan_feed_events` management command is a cheap follow-up, not part of this change.

---

## Migrations and cutover

Latest migration is `0035_course_course_title_trgm_idx`; note the repo has a history of parallel
branches resolved by merge migrations, so rebase before generating.

1. **`0036_feedevent`** — model, both partial indexes, unique constraint.
2. **`0037_backfill_feed_events`** — `RunPython`, reversible (reverse deletes all rows). Use
   `apps.get_model` for `FeedEvent`, `Rating`, `FeedPost` *and* `contenttypes.ContentType`;
   `bulk_create` in batches with `ignore_conflicts=True` so a re-run is safe:
   - every `Rating` with `comment != ""` → `REVIEW_PUBLISHED`, `occurred_at=created_at`
   - every `FeedPost` → `POST_PUBLISHED`, `occurred_at=published_at`,
     `is_visible=is_active`, `pinned=pinned`
3. **Cutover in the same PR.** The feed is already gated behind the `fe_feed` waffle flag and
   cursors are opaque and short-lived, so no dual-read window is needed. A cursor issued by the
   old code during the deploy decodes to a `Rating`/`FeedPost` uuid rather than a `FeedEvent`
   uuid; a reader mid-scroll gets one page positioned by timestamp with a wrong tie-break. That
   is a one-request cosmetic glitch on an opt-in feature and is accepted rather than versioning
   the cursor payload, which would turn it into a visible 400.

### Suggested phasing

**Phase 1 — write path only.** Model, migrations, backfill, `FeedProjectionService`, signals,
tests. Nothing reads `feed_event` yet, so this merges with zero read risk and lets the
projection be verified against the live feed in staging.

**Phase 2 — read path.** Hydrators, `FeedEventRepository.get_page/get_pinned`, `FeedService`
rewrite, watermark move, invalidation collapse, and removal of the now-dead
`RatingRepository.get_feed_page` / `_build_feed_queryset` and
`FeedPostRepository.get_page/get_pinned/get_next_future_publication_time`.

---

## Files

**New**

- `rating_app/models/feed_event.py` (+ export in `models/__init__.py`)
- `rating_app/models/choices.py` — `FeedEventType`
- `rating_app/application_schemas/feed.py` — `FeedEventRow`
- `rating_app/repositories/feed_event_repository.py` (+ `FeedEventRowMapper` in
  `to_domain_mappers.py`, exports in `repositories/__init__.py`)
- `rating_app/services/feed_projection_service.py`
- `rating_app/services/feed_hydration/{protocol.py,review.py,promo.py,registry.py}`
- `rating_app/admin/feed_event.py` — read-only admin, for debugging the projection
- migrations `0036_feedevent.py`, `0037_backfill_feed_events.py`

**Modified**

- `rating_app/services/feed_service.py` — single-source read, watermark off `FeedEvent`
- `rating_app/signals.py` — `Rating` projection receivers, `FeedPost` receiver delegates to the
  projection service, `FeedEvent` receiver owns the `FEED_NAMESPACE` bump
- `rating_app/services/domain_event_listeners/cache_invalidator.py` — drop the now-dead
  `FEED_NAMESPACE` bump from `RatingCacheInvalidator`
- `rating_app/ioc_container/repositories.py` — `feed_event_mapper()`, `feed_event_repository()`
- `rating_app/ioc_container/services.py` — `feed_projection_service()`, `feed_hydrator()`, and
  the new `feed_service()` signature (all `@once`)
- `rating_app/repositories/{rating_repository,feed_post_repository}.py` — drop the dead feed
  query methods, add `get_many_by_ids`-style hydration fetches

**Untouched** — `pagination/cursor.py`, `serializers/feed.py`, `views/feed_viewset.py`,
`views/responses.py`, `docs/api/openapi-generated.yaml`, all of `src/webapp/`.

---

## Adding a new kind, afterwards

Source-backed kind (e.g. comments on reviews):

1. Add the `FeedEventType` member.
2. Add the DTO to `application_schemas/feed.py` and a mapper in `to_domain_mappers.py`.
3. Add a hydrator and register it in `feed_hydration/registry.py`.
4. Add a projection method + signal receiver.
5. Add the serializer and register it in the `PolymorphicProxySerializer` map.
6. Frontend: extend the union in `feedTypes.ts`, the mapper in `useFeed.ts`, add a component.

Steps 1–4 are the only backend read-path work, and none of them touch `FeedService`,
`FeedCursor` or pagination.

Synthetic kind (e.g. achievements), additionally:

- One migration adding `payload = models.JSONField(default=dict, blank=True)` and making
  `content_type`/`object_id` nullable, plus dropping `unique_feed_event_source` to a conditional
  constraint (`condition=Q(object_id__isnull=False)`).
- The hydrator reads `row.payload` instead of a source table; a management command or scheduled
  job writes the events.

---

## Verification

Success criteria, in order:

1. **Behaviour parity.** `services/test_feed_service.py`, `views/test_feed.py`,
   `serializers/test_feed.py` and `pagination/test_cursor.py` pass **with no edits** — they are
   the parity harness for this refactor. `repositories/test_rating_repository_feed.py` and
   `repositories/test_feed_post_repository.py` shrink as their methods are deleted.
2. **Query count is bounded.** New test in `services/test_feed_service.py` using
   `django_assert_num_queries`: a mixed page of 20 items costs 3 queries (keyset + ratings +
   posts) regardless of `limit`, versus the current 2-and-growing.
3. **Projection correctness.** New `services/test_feed_projection.py`: rating create → event;
   update → same event updated, not duplicated (unique constraint); comment cleared →
   `is_visible=False`; rating deleted → event gone; post `is_active`/`pinned`/`published_at`
   changes mirror onto the event.
4. **Repository semantics.** New `repositories/test_feed_event_repository.py`: keyset paging
   across a timestamp tie, future `occurred_at` excluded, invisible excluded, pinned excluded
   from the body page and returned by `get_pinned`.
5. **Orphan tolerance.** Test that an event whose source row was deleted directly in the ORM is
   skipped while `next_cursor` still advances past it.
6. **Backfill.** Migration test asserting one event per commented rating and per post, and that
   re-running is a no-op.

Commands, from `src/backend/`:

```bash
uv run pytest rating_app/services/test_feed_service.py \
              rating_app/services/test_feed_projection.py \
              rating_app/repositories/test_feed_event_repository.py \
              rating_app/views/test_feed.py \
              rating_app/serializers/test_feed.py \
              rating_app/pagination/test_cursor.py
uv run pytest                                   # full suite
python manage.py makemigrations --check --dry-run
python manage.py spectacular --file ../../docs/api/openapi-generated.yaml   # must produce no diff
ruff check . && ruff format --check .
```

From `src/webapp/`: `pnpm test` — must pass untouched, since the contract does not move.

---

## Considered alternatives

1. **Generalise the current scatter-gather behind an `IFeedSource` protocol.**
   Rejected as the end state, though it is the cheapest change and a reasonable stopgap: it
   leaves the per-page cost linear in sources, gives pinning/visibility/collapse no home, keeps
   three invalidation mechanisms, and cannot represent achievements at all.
2. **Push the merge into SQL (`UNION ALL` over normalised subqueries, or a Postgres view).**
   Rejected: buys the single-query read without the ability to hold pinning, visibility or
   collapsing as first-class columns, still cannot represent synthetic events, and costs
   readability and unit-testability (every test needs a real database and a wall of padded
   `SELECT` arms).
3. **`feed_event` with a `payload` snapshot, rendering cards straight from JSON (no hydration).**
   Rejected as the trap it looks like a shortcut for. Saving the hydration queries means a course
   title, rating averages or comment text change leaves stale cards, so every source needs
   update-propagation listeners — strictly more work than one batched `filter(id__in=...)`, for a
   read saving the existing 60s `@rcached` already provides.
4. **Projecting via the domain-event observer bus instead of Django signals.**
   Rejected: `RatingService` notifies the identical `RatingDTO` on create, update and delete, so
   a listener cannot detect deletion; and admin writes bypass the service layer entirely, which
   is already why `signals.py` exists. The signal receivers here delegate straight into
   `FeedProjectionService`, so the logic still lives in the service layer.

---

## Deviations during implementation

- **Ratings are projected by an observer, not a signal.** A `RatingEvent(rating, action)`
  envelope was added to `RatingService` (mirroring `CommentEvent`), so the bus can express
  deletion. Signals remain for `FeedPost` only. See ADR-0010, decision 5.
- **No `on_commit` on the index writes.** They target the same database, so they run inside the
  caller's transaction; `on_commit` is used only for the Redis bump.
- **Hydration is one module, not a package.** `services/feed_item_provider.py` holds an
  `IFeedItemSource` protocol (one method, `get_feed_items_by_ids`) that the source repositories
  implement directly, and a `FeedItemProvider` keyed by `FeedEventType`. No adapter classes.
- **`FeedItem` is a union type**, not `FeedItemBase`, on every read-path signature.
- **Test factories replay the observers.** `RatingFactory` and `CommentFactory` call
  `FeedUpdateService` in `post_generation`, since factories bypass the services.
- **Comments landed as the third kind** in the same change, exercising the extension path.
