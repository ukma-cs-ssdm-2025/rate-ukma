import uuid

from django.contrib.contenttypes.models import ContentType
from django.db.models import Model

from rating_app.application_schemas.feed import FeedEventUpsertData
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.models import FeedPost, Rating
from rating_app.models.choices import FeedEventType
from rating_app.repositories import FeedEventRepository


class FeedUpdateService:
    """Keeps the feed index in sync with its sources"""

    def __init__(self, feed_event_repository: FeedEventRepository) -> None:
        self.feed_event_repository = feed_event_repository

    def sync_rating(self, rating: RatingDTO) -> None:
        self.feed_event_repository.upsert(
            FeedEventUpsertData(
                event_type=FeedEventType.REVIEW_PUBLISHED,
                content_type=ContentType.objects.get_for_model(Rating),
                object_id=rating.id,
                occurred_at=rating.created_at,
                # the feed shows commented ratings only
                is_visible=bool(rating.comment),
            )
        )

    def sync_post(self, post: FeedPost) -> None:
        self.feed_event_repository.upsert(
            FeedEventUpsertData(
                event_type=FeedEventType.POST_PUBLISHED,
                content_type=ContentType.objects.get_for_model(FeedPost),
                object_id=post.id,
                occurred_at=post.published_at,
                is_visible=post.is_active,
                pinned=post.pinned,
            )
        )

    def remove(self, source_model: type[Model], source_id: uuid.UUID) -> None:
        self.feed_event_repository.delete(
            content_type=ContentType.objects.get_for_model(source_model),
            object_id=source_id,
        )
