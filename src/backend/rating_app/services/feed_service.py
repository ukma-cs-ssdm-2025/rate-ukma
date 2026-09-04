from rateukma.caching.decorators import rcached
from rateukma.caching.instances import redis_cache_manager
from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.application_schemas.feed import FeedPage, FeedPromoItem, FeedReviewItem
from rating_app.caching.feed_watermark import is_watermark_due, store_feed_watermark
from rating_app.pagination import FeedCursor
from rating_app.repositories import FeedPostRepository, RatingRepository

FEED_CACHE_TTL = 60

FeedItem = FeedReviewItem | FeedPromoItem


class FeedService:
    def __init__(
        self,
        feed_post_repository: FeedPostRepository,
        rating_repository: RatingRepository,
    ):
        self.feed_post_repository = feed_post_repository
        self.rating_repository = rating_repository

    def _cache_namespaces(self, *_args, **_kwargs) -> list[str]:
        """Read-path invalidation for posts nothing wrote at their publication time.

        Costs one Redis read, the DB is touched only by the single request that
        finds the watermark due, which then moves it to the next scheduled post.
        """
        cache_manager = redis_cache_manager()

        if is_watermark_due(cache_manager):
            cache_manager.bump_version(FEED_NAMESPACE)
            store_feed_watermark(
                cache_manager, self.feed_post_repository.get_next_future_publication_time()
            )

        return [FEED_NAMESPACE]

    # `_cache_namespaces` is passed as a function object, so it has to be defined
    # above: `rcached` treats a string as a namespace name, not as a reference.
    @rcached(ttl=FEED_CACHE_TTL, versioned_by=_cache_namespaces)
    def get_feed_page(self, cursor: str | None, limit: int) -> FeedPage:
        # each page is cached separately
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
