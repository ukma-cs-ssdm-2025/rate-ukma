from datetime import datetime

from django.utils import timezone

from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.decorators import rcached
from rateukma.caching.patterns import FEED_NAMESPACE, FEED_NEXT_PUBLISH_AT_KEY
from rating_app.application_schemas.feed import FeedEventRow, FeedPage
from rating_app.pagination import FeedCursor
from rating_app.repositories import FeedEventRepository
from rating_app.services.feed_item_provider import FeedItemProvider

FEED_CACHE_TTL = 60

# The stored time has to outlive the moment it marks,
# or it expires before any reader gets to act on it.
NEXT_PUBLISH_GRACE = 60 * 60


class FeedService:
    def __init__(
        self,
        feed_event_repository: FeedEventRepository,
        item_provider: FeedItemProvider,
        cache_manager: ICacheManager,
    ):
        self.feed_event_repository = feed_event_repository
        self.item_provider = item_provider
        self.cache_manager = cache_manager

    def _cache_namespaces(self, *_args, **_kwargs) -> list[str]:
        """Read-path invalidation for entries nothing wrote at their scheduled time.

        Costs one Redis read, the DB is touched only by the single request that
        finds a publication due, which then moves the marker to the next one.
        """

        if self._is_next_publish_due():
            self.cache_manager.bump_version(FEED_NAMESPACE)
            self.refresh_next_publish_marker()

        return [FEED_NAMESPACE]

    # `_cache_namespaces` is passed as a function object, so it has to be defined
    # above: `rcached` treats a string as a namespace name, not as a reference.
    @rcached(ttl=FEED_CACHE_TTL, versioned_by=_cache_namespaces)
    def get_feed_page(self, cursor: str | None, limit: int) -> FeedPage:
        position = FeedCursor.decode(cursor) if cursor else None

        rows = self.feed_event_repository.get_page(cursor=position, limit=limit)
        has_more = len(rows) > limit
        rows = rows[:limit]

        items = self.item_provider.provide_feed_items(rows)

        next_cursor = self._next_cursor(rows) if has_more else None

        # pinned entries lead the first page only
        if position is None:
            pinned = self.feed_event_repository.get_pinned()
            items = self.item_provider.provide_feed_items(pinned) + items

        return FeedPage(items=items, next_cursor=next_cursor)

    def refresh_next_publish_marker(self) -> None:
        next_occurrence = self.feed_event_repository.get_next_future_occurrence()
        if next_occurrence is None:
            self.cache_manager.invalidate(FEED_NEXT_PUBLISH_AT_KEY)
            return

        ttl = int((next_occurrence - timezone.now()).total_seconds()) + NEXT_PUBLISH_GRACE
        self.cache_manager.set(FEED_NEXT_PUBLISH_AT_KEY, next_occurrence.isoformat(), max(ttl, 1))

    def _next_cursor(self, rows: list[FeedEventRow]) -> str | None:
        if not rows:
            return None
        last = rows[-1]
        return FeedCursor(last.occurred_at, last.id).encode()

    def _is_next_publish_due(self) -> bool:
        stored = self.cache_manager.get(FEED_NEXT_PUBLISH_AT_KEY)
        if not isinstance(stored, str):
            return False
        return datetime.fromisoformat(stored) <= timezone.now()
