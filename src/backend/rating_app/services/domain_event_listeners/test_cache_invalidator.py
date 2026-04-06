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
from rating_app.models.choices import SemesterTerm
from rating_app.services.domain_event_listeners.cache_invalidator import (
    RatingCacheInvalidator,
)


def _make_rating_dto(*, is_anonymous: bool = False) -> RatingDTO:
    """RatingDTO always carries the real student_id (domain truth).
    Privacy nulling is a serializer concern, not a domain concern."""
    return RatingDTO(
        id=uuid.uuid4(),
        course_offering_id=uuid.uuid4(),
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
