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
    course_analytics_namespace,
    course_detail_namespace,
    course_ratings_namespace,
    student_ratings_namespace,
)
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.services.domain_event_listeners.cache_invalidator import (
    RatingCacheInvalidator,
)


def _make_rating_dto(*, student_id: uuid.UUID | None = None) -> RatingDTO:
    course_id = uuid.uuid4()
    return RatingDTO(
        id=uuid.uuid4(),
        course_offering_id=uuid.uuid4(),
        student_id=student_id,
        student_name="Test Student" if student_id else None,
        course_offering=uuid.uuid4(),
        course=course_id,
        difficulty=3,
        usefulness=4,
        comment="Good course",
        is_anonymous=student_id is None,
        created_at=datetime.datetime.now(),
        upvotes=0,
        downvotes=0,
        viewer_vote=None,
    )


class TestRatingCacheInvalidator:
    @pytest.fixture
    def cache_manager(self):
        return MagicMock()

    @pytest.fixture
    def invalidator(self, cache_manager):
        return RatingCacheInvalidator(cache_manager=cache_manager)

    def test_bumps_course_detail_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto(student_id=uuid.uuid4())
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(course_detail_namespace(str(event.course)))

    def test_bumps_course_analytics_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto(student_id=uuid.uuid4())
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(course_analytics_namespace(str(event.course)))

    def test_bumps_course_ratings_namespace(self, invalidator, cache_manager):
        event = _make_rating_dto(student_id=uuid.uuid4())
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(course_ratings_namespace(str(event.course)))

    def test_bumps_student_ratings_namespace_when_student_id_present(
        self, invalidator, cache_manager
    ):
        student_id = uuid.uuid4()
        event = _make_rating_dto(student_id=student_id)
        invalidator.on_event(event)
        cache_manager.bump_version.assert_any_call(student_ratings_namespace(str(student_id)))

    def test_does_not_bump_student_namespace_when_anonymous(self, invalidator, cache_manager):
        event = _make_rating_dto(student_id=None)
        invalidator.on_event(event)
        bumped = [call.args[0] for call in cache_manager.bump_version.call_args_list]
        assert not any("student" in ns for ns in bumped)

    def test_bumps_all_four_namespaces_for_identified_student(self, invalidator, cache_manager):
        student_id = uuid.uuid4()
        event = _make_rating_dto(student_id=student_id)
        invalidator.on_event(event)
        assert cache_manager.bump_version.call_count == 4
