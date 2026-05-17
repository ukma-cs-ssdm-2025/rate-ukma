"""
Unit tests for RatingCacheInvalidator.

These tests document *exactly* which cache namespaces must be bumped when a
rating is created or deleted, so regressions in cache invalidation are caught
at the unit level rather than discovered only through e2e tests.
"""

import datetime
import uuid
from unittest.mock import MagicMock

import pytest

from rateukma.caching.patterns import (
    comment_replies_namespace,
    course_analytics_namespace,
    course_detail_namespace,
    course_ratings_namespace,
    rating_comments_namespace,
    student_ratings_namespace,
)
from rating_app.application_schemas.comment import CommentDTO
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.models.choices import SemesterTerm
from rating_app.services.comment_events import CommentAction, CommentEvent
from rating_app.services.domain_event_listeners.cache_invalidator import (
    CommentCacheInvalidator,
    RatingCacheInvalidator,
)


def _make_rating_dto(*, is_anonymous: bool = False) -> RatingDTO:
    """RatingDTO always carries the real student_id (domain truth).
    Privacy nulling is a serializer concern, not a domain concern."""
    return RatingDTO(
        id=uuid.uuid4(),
        course_offering=uuid.uuid4(),
        course_offering_term=SemesterTerm.FALL,
        course_offering_year=2024,
        student_id=uuid.uuid4(),
        student_name="Test Student",
        course=uuid.uuid4(),
        difficulty=3,
        usefulness=4,
        comment="Good course",
        is_anonymous=is_anonymous,
        created_at=datetime.datetime.now(),
        upvotes=0,
        downvotes=0,
        viewer_vote=None,
        comments_count=0,
    )


def _make_comment_dto(
    *,
    parent_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
) -> CommentDTO:
    return CommentDTO(
        id=uuid.uuid4(),
        user_id=1,
        user_name="Test User",
        user_avatar_url=None,
        rating_id=uuid.uuid4(),
        parent_id=parent_id,
        course_id=course_id or uuid.uuid4(),
        content="Helpful comment",
        is_anonymous=False,
        created_at=datetime.datetime.now(),
        replies_count=0,
    )


class TestRatingCacheInvalidator:
    @pytest.fixture
    def cache_manager(self):
        return MagicMock()

    @pytest.fixture
    def invalidator(self, cache_manager):
        return RatingCacheInvalidator(cache_manager=cache_manager)

    def test_bumps_course_detail_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto()
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(course_detail_namespace(str(event.course)))

    def test_bumps_course_analytics_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto()
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(course_analytics_namespace(str(event.course)))

    def test_bumps_course_ratings_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto()
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(course_ratings_namespace(str(event.course)))

    def test_bumps_student_ratings_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto()
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(student_ratings_namespace(str(event.student_id)))

    def test_bumps_all_four_namespaces(self, invalidator, cache_manager):
        event = _make_rating_dto()
        invalidator.on_event(event)
        assert cache_manager.bump_version.call_count == 4

    def test_anonymous_rating_still_bumps_student_namespace(self, invalidator, cache_manager):
        """Anonymous ratings carry the real student_id in the domain model.
        Privacy nulling happens at the serializer layer, not here."""
        event = _make_rating_dto(is_anonymous=True)
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(student_ratings_namespace(str(event.student_id)))
        assert cache_manager.bump_version.call_count == 4


class TestCommentCacheInvalidator:
    @pytest.fixture
    def cache_manager(self):
        return MagicMock()

    @pytest.fixture
    def invalidator(self, cache_manager):
        return CommentCacheInvalidator(cache_manager=cache_manager)

    def test_bumps_rating_comments_and_course_ratings_namespaces(
        self,
        invalidator,
        cache_manager,
    ):
        course_id = uuid.uuid4()
        comment = _make_comment_dto(course_id=course_id)
        event = CommentEvent(comment=comment, action=CommentAction.CREATED)

        invalidator.on_event(event)

        cache_manager.bump_version.assert_any_call(
            rating_comments_namespace(str(comment.rating_id))
        )
        cache_manager.bump_version.assert_any_call(comment_replies_namespace(str(comment.id)))
        cache_manager.bump_version.assert_any_call(course_ratings_namespace(str(course_id)))
        assert cache_manager.bump_version.call_count == 3

    def test_bumps_parent_replies_namespace_for_reply(
        self,
        invalidator,
        cache_manager,
    ):
        parent_id = uuid.uuid4()
        course_id = uuid.uuid4()
        comment = _make_comment_dto(parent_id=parent_id, course_id=course_id)
        event = CommentEvent(comment=comment, action=CommentAction.CREATED)

        invalidator.on_event(event)

        cache_manager.bump_version.assert_any_call(comment_replies_namespace(str(parent_id)))
        assert cache_manager.bump_version.call_count == 4

    @pytest.mark.parametrize(
        "action",
        [CommentAction.CREATED, CommentAction.DELETED],
    )
    def test_bumps_parent_container_replies_namespace_for_nested_reply_count_changes(
        self,
        invalidator,
        cache_manager,
        action,
    ):
        grandparent_id = uuid.uuid4()
        parent_id = uuid.uuid4()
        course_id = uuid.uuid4()
        comment = _make_comment_dto(parent_id=parent_id, course_id=course_id)
        event = CommentEvent(
            comment=comment,
            action=action,
            parent_parent_id=grandparent_id,
        )

        invalidator.on_event(event)

        cache_manager.bump_version.assert_any_call(comment_replies_namespace(str(parent_id)))
        cache_manager.bump_version.assert_any_call(comment_replies_namespace(str(grandparent_id)))
        assert cache_manager.bump_version.call_count == 5
