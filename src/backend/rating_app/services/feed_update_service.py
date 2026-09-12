import uuid
from datetime import datetime

from django.contrib.contenttypes.models import ContentType
from django.db import transaction

from rating_app.application_schemas.feed import FeedEventUpsertData
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.models import FeedPost, Rating
from rating_app.models.choices import FeedEventType
from rating_app.repositories import FeedEventRepository


class FeedUpdateService:
    """Keeps the feed index in step with its sources. Deletion needs nothing here:
    each source declares a `GenericRelation` to `FeedEvent`, so the ORM cascades."""

    def __init__(self, feed_event_repository: FeedEventRepository) -> None:
        self.feed_event_repository = feed_event_repository

    def sync_rating(self, rating: RatingDTO) -> None:
        self.feed_event_repository.upsert(
            self._rating_entry(rating.id, rating.created_at, rating.comment)
        )

    def sync_post(self, post: FeedPost) -> None:
        self.feed_event_repository.upsert(
            self._post_entry(post.id, post.published_at, post.is_active, post.pinned)
        )

    def rebuild(self) -> int:
        """Re-derive the whole index from the source tables.

        For writes that bypass the observers and receivers — bulk loads, mock
        data, raw SQL. The same per-kind rules as `sync_*`, applied to every row.
        """
        ratings = (
            self._rating_entry(rating_id, created_at, comment)
            for rating_id, created_at, comment in Rating.objects.values_list(
                "id", "created_at", "comment"
            )
        )
        posts = (
            self._post_entry(post_id, published_at, is_active, pinned)
            for post_id, published_at, is_active, pinned in FeedPost.objects.values_list(
                "id", "published_at", "is_active", "pinned"
            )
        )
        with transaction.atomic():
            return self.feed_event_repository.replace_all([*ratings, *posts])

    def _rating_entry(
        self, rating_id: uuid.UUID, created_at: datetime, comment: str | None
    ) -> FeedEventUpsertData:
        return FeedEventUpsertData(
            event_type=FeedEventType.REVIEW_PUBLISHED,
            content_type=ContentType.objects.get_for_model(Rating),
            object_id=rating_id,
            occurred_at=created_at,
            # the feed shows commented ratings only
            is_visible=bool(comment),
        )

    def _post_entry(
        self, post_id: uuid.UUID, published_at: datetime, is_active: bool, pinned: bool
    ) -> FeedEventUpsertData:
        return FeedEventUpsertData(
            event_type=FeedEventType.POST_PUBLISHED,
            content_type=ContentType.objects.get_for_model(FeedPost),
            object_id=post_id,
            occurred_at=published_at,
            is_visible=is_active,
            pinned=pinned,
        )
