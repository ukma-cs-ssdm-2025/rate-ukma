from datetime import datetime

from django.db.models import QuerySet
from django.utils import timezone

from rating_app.application_schemas.feed import FeedPromoItem as FeedPromoItemDTO
from rating_app.models import FeedPost
from rating_app.pagination import FeedCursor
from rating_app.repositories.to_domain_mappers import FeedPostMapper


class FeedPostRepository:
    """Read-only access to feed posts. Rows are authored in Django admin."""

    def __init__(self, mapper: FeedPostMapper) -> None:
        self._mapper = mapper

    def get_pinned(self) -> list[FeedPromoItemDTO]:
        posts = self._build_live_queryset().filter(pinned=True)
        return self._map(posts)

    def get_page(self, cursor: FeedCursor | None, limit: int) -> list[FeedPromoItemDTO]:
        """Unpinned posts older than `cursor`, newest first.

        Returns `limit + 1` rows: the extra one is how the service learns that
        a next page exists without a `COUNT`.
        """
        posts = self._build_live_queryset().filter(pinned=False)
        if cursor is not None:
            posts = posts.filter(cursor.filter("published_at"))
        return self._map(posts[: limit + 1])

    def get_latest_publication_time(self) -> datetime | None:
        return self._build_live_queryset().values_list("published_at", flat=True).first()

    def _build_live_queryset(self) -> QuerySet[FeedPost]:
        """Posts a reader may see right now."""
        return FeedPost.objects.filter(
            is_active=True,
            published_at__lte=timezone.now(),
        ).order_by("-published_at", "-id")

    def _map(self, posts: QuerySet[FeedPost]) -> list[FeedPromoItemDTO]:
        return [self._mapper.process(post) for post in posts]
