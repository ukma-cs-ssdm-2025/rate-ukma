from datetime import datetime

from django.utils import timezone

from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.decorators import rcached
from rateukma.caching.patterns import FEED_NAMESPACE, FEED_NEXT_PUBLISH_AT_KEY
from rating_app.application_schemas.feed import FeedPage, FeedPromoItem, FeedReviewItem
from rating_app.pagination import FeedCursor
from rating_app.repositories import FeedPostRepository, RatingRepository

FEED_CACHE_TTL = 60

# The stored time has to outlive the moment it marks,
# or it expires before any reader gets to act on it.
NEXT_PUBLISH_GRACE = 60 * 60

FeedItem = FeedReviewItem | FeedPromoItem


class FeedService:
    def __init__(
        self,
        feed_post_repository: FeedPostRepository,
        rating_repository: RatingRepository,
        cache_manager: ICacheManager,
    ):
        self.feed_post_repository = feed_post_repository
        self.rating_repository = rating_repository
        self.cache_manager = cache_manager

    def _cache_namespaces(self, *_args, **_kwargs) -> list[str]:
        """Read-path invalidation for posts nothing wrote at their publication time.

        Costs one Redis read, the DB is touched only by the single request that
        finds a publication due, which then moves the marker to the next post.
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

        # `limit + 1` from each source: to check if next page exists
        reviews = self.rating_repository.get_feed_page(cursor=position, limit=limit)
        posts = self.feed_post_repository.get_page(cursor=position, limit=limit)

        merged = self._merge(reviews + posts)
        page = merged[:limit]
        next_cursor = self._next_cursor(page) if len(merged) > limit else None

        # pinned posts lead the first page only
        if position is None:
            page = self.feed_post_repository.get_pinned() + page

        return FeedPage(items=page, next_cursor=next_cursor)

    def refresh_next_publish_marker(self) -> None:
        next_publication = self.feed_post_repository.get_next_future_publication_time()
        if next_publication is None:
            self.cache_manager.invalidate(FEED_NEXT_PUBLISH_AT_KEY)
            return

        ttl = int((next_publication - timezone.now()).total_seconds()) + NEXT_PUBLISH_GRACE
        self.cache_manager.set(FEED_NEXT_PUBLISH_AT_KEY, next_publication.isoformat(), max(ttl, 1))

    def _merge(self, items: list[FeedItem]) -> list[FeedItem]:
        return sorted(items, key=lambda item: (item.occurred_at, item.id), reverse=True)

    def _next_cursor(self, page: list[FeedItem]) -> str | None:
        if not page:
            return None
        last = page[-1]
        return FeedCursor(last.occurred_at, last.id).encode()

    def _is_next_publish_due(self) -> bool:
        stored = self.cache_manager.get(FEED_NEXT_PUBLISH_AT_KEY)
        if not isinstance(stored, str):
            return False
        return datetime.fromisoformat(stored) <= timezone.now()
