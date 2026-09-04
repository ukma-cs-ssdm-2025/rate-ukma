from rateukma.caching.decorators import rcached
from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.application_schemas.feed import FeedPage, FeedPromoItem, FeedReviewItem
from rating_app.pagination import FeedCursor
from rating_app.repositories import FeedPostRepository, RatingRepository

FEED_CACHE_TTL = 300

FeedItem = FeedReviewItem | FeedPromoItem


class FeedService:
    def __init__(
        self,
        feed_post_repository: FeedPostRepository,
        rating_repository: RatingRepository,
    ):
        self.feed_post_repository = feed_post_repository
        self.rating_repository = rating_repository

    def cache_namespaces(self, *_args, **_kwargs) -> list[str]:
        return [FEED_NAMESPACE]

    @rcached(ttl=FEED_CACHE_TTL, versioned_by=cache_namespaces)
    def get_feed(self, cursor: str | None, limit: int) -> FeedPage:
        """One page of the feed, newest first.

        The cursor is part of the cache key, each page caches separately.
        `FEED_NAMESPACE` is bumped on any rating or post change, which retires
        every page at once.
        """
        position = FeedCursor.decode(cursor) if cursor else None

        # `limit + 1` from each source: to check if next page exists
        reviews = self.rating_repository.get_feed_page(cursor=position, limit=limit)
        posts = self.feed_post_repository.get_page(cursor=position, limit=limit)

        merged = self._merge(reviews + posts)
        page = merged[:limit]
        next_cursor = self._next_cursor(page) if len(merged) > limit else None

        # skip pinned posts
        if position is None:
            page = self.feed_post_repository.get_pinned() + page

        return FeedPage(items=page, next_cursor=next_cursor)

    def _merge(self, items: list[FeedItem]) -> list[FeedItem]:
        return sorted(items, key=lambda item: (item.occurred_at, item.id), reverse=True)

    def _next_cursor(self, page: list[FeedItem]) -> str | None:
        if not page:
            return None
        last = page[-1]
        return FeedCursor(last.occurred_at, last.id).encode()
