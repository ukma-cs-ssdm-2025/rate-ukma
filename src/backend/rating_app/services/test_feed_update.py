from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

import pytest

from rating_app.ioc_container.repositories import rating_repository
from rating_app.ioc_container.services import rating_feed_update_observer
from rating_app.models import FeedEvent
from rating_app.models.choices import FeedEventType
from rating_app.services.rating_events import RatingAction, RatingEvent

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


def _event_for(source) -> FeedEvent:
    return FeedEvent.objects.get(
        content_type=ContentType.objects.get_for_model(source), object_id=source.pk
    )


class TestRatingUpdates:
    @pytest.fixture
    def emit(self):
        observer = rating_feed_update_observer()

        def _emit(rating, action: RatingAction):
            dto = rating_repository().get_by_id(str(rating.id))
            observer.on_event(RatingEvent(rating=dto, action=action))

        return _emit

    def test_commented_rating_becomes_a_visible_review_event(self, emit, rating_factory):
        rating = rating_factory(comment="Варто брати")

        emit(rating, RatingAction.CREATED)

        event = _event_for(rating)
        assert event.event_type == FeedEventType.REVIEW_PUBLISHED
        assert event.occurred_at == rating.created_at
        assert event.is_visible is True
        assert event.pinned is False

    def test_blank_comment_syncs_as_invisible(self, emit, rating_factory):
        rating = rating_factory(comment="")

        emit(rating, RatingAction.CREATED)

        assert _event_for(rating).is_visible is False

    def test_update_rewrites_the_same_event(self, emit, rating_factory):
        rating = rating_factory(comment="")
        emit(rating, RatingAction.CREATED)
        before = _event_for(rating)

        rating.comment = "Передумав, є що сказати"
        rating.save()
        emit(rating, RatingAction.UPDATED)

        after = _event_for(rating)
        assert after.id == before.id
        assert after.is_visible is True
        assert FeedEvent.objects.count() == 1

    def test_delete_event_leaves_the_index_to_the_orm(self, emit, rating_factory):
        """Cascade via `Rating.feed_events` is what removes the entry (see
        test_feed_event_cascade.py); the observer must not act on DELETED."""
        rating = rating_factory(comment="Варто брати")

        emit(rating, RatingAction.DELETED)

        assert _event_for(rating) is not None


class TestPostUpdates:
    def test_post_state_mirrors_onto_the_event(self, feed_post_factory):
        scheduled_for = timezone.now() + timedelta(days=1)
        post = feed_post_factory(pinned=True, is_active=False, published_at=scheduled_for)

        event = _event_for(post)
        assert event.event_type == FeedEventType.POST_PUBLISHED
        assert event.occurred_at == scheduled_for
        assert event.pinned is True
        assert event.is_visible is False

    def test_admin_edit_rewrites_the_same_event(self, feed_post_factory):
        post = feed_post_factory(pinned=False)
        before = _event_for(post)

        post.pinned = True
        post.save()

        after = _event_for(post)
        assert after.id == before.id
        assert after.pinned is True
