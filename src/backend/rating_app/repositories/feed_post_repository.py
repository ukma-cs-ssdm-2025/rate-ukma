import uuid

from rating_app.application_schemas.feed import FeedPromoItem as FeedPromoItemDTO
from rating_app.models import FeedPost
from rating_app.repositories.to_domain_mappers import FeedPostMapper


class FeedPostRepository:
    """Read-only access to feed posts. Rows are authored in Django admin."""

    def __init__(self, mapper: FeedPostMapper) -> None:
        self._mapper = mapper

    def get_feed_items_by_ids(self, ids: list[uuid.UUID]) -> list[FeedPromoItemDTO]:
        posts = FeedPost.objects.filter(id__in=ids)
        mapped = [self._mapper.process(post) for post in posts]
        return mapped
