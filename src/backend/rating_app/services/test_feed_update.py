import uuid
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

import pytest

from rating_app.ioc_container.repositories import comment_repository, rating_repository
from rating_app.ioc_container.services import (
    comment_feed_update_observer,
    feed_update_service,
    rating_feed_update_observer,
)
from rating_app.models import Comment, FeedEvent, Rating
from rating_app.models.choices import FeedEventType
from rating_app.services.comment_events import CommentAction, CommentEvent
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


class TestCommentUpdates:
    @pytest.fixture
    def emit(self):
        observer = comment_feed_update_observer()

        def _emit(comment, action: CommentAction):
            dto = comment_repository().get_by_id(str(comment.id))
            observer.on_event(CommentEvent(comment=dto, action=action))

        return _emit

    def test_comment_becomes_a_visible_event(self, emit, comment_factory):
        comment = comment_factory(content="Погоджуюсь")

        emit(comment, CommentAction.CREATED)

        event = _event_for(comment)
        assert event.event_type == FeedEventType.COMMENT_PUBLISHED
        assert event.occurred_at == comment.created_at
        assert event.is_visible is True
        assert event.pinned is False

    def test_reply_is_an_event_of_its_own(self, emit, comment_factory):
        parent = comment_factory()
        reply = comment_factory(rating=parent.rating, parent_comment=parent)

        emit(reply, CommentAction.CREATED)

        assert _event_for(reply).object_id == reply.id
        assert FeedEvent.objects.filter(event_type=FeedEventType.COMMENT_PUBLISHED).count() == 2

    def test_delete_event_leaves_the_index_to_the_orm(self, emit, comment_factory):
        """Cascade via `Comment.feed_events` removes the entry; the observer must not."""
        comment = comment_factory()

        emit(comment, CommentAction.DELETED)

        assert _event_for(comment) is not None

    def test_deleting_the_rating_takes_the_comment_entries_with_it(self, comment_factory):
        """The FK cascade reaches the comment, and `Comment.feed_events` reaches its entry."""
        comment = comment_factory()

        Rating.objects.filter(pk=comment.rating_id).delete()

        assert not Comment.objects.filter(pk=comment.id).exists()
        assert not FeedEvent.objects.filter(object_id=comment.id).exists()


class TestRebuild:
    def test_indexes_rows_that_bypassed_the_service(self, rating_factory, feed_post_factory):
        """`Rating.objects.create` and bulk loads never reach the observers."""
        rating = rating_factory(comment="Не проіндексовано")
        post = feed_post_factory(pinned=True)
        FeedEvent.objects.all().delete()  # what a bypassing write leaves behind

        count = feed_update_service().rebuild()

        assert count == 2
        assert _event_for(rating).is_visible is True
        assert _event_for(post).pinned is True

    def test_includes_comments(self, comment_factory):
        comment = comment_factory()
        FeedEvent.objects.all().delete()

        feed_update_service().rebuild()

        assert _event_for(comment).event_type == FeedEventType.COMMENT_PUBLISHED

    def test_applies_the_same_visibility_rule_as_sync(self, rating_factory):
        rating_factory(comment="")
        FeedEvent.objects.all().delete()

        feed_update_service().rebuild()

        assert FeedEvent.objects.get().is_visible is False

    def test_drops_entries_with_no_source(self, rating_factory):
        FeedEvent.objects.create(
            event_type=FeedEventType.REVIEW_PUBLISHED,
            occurred_at=timezone.now(),
            content_type=ContentType.objects.get_for_model(Rating),
            object_id=uuid.uuid4(),
        )

        feed_update_service().rebuild()

        assert not FeedEvent.objects.exists()
