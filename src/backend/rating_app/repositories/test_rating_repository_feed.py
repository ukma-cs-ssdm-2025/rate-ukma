"""Tests for `RatingRepository.get_feed_page`, the feed's lean review query."""

import pytest

from rating_app.pagination import FeedCursor
from rating_app.repositories.to_domain_mappers import FeedReviewMapper
from rating_app.tests.factories import (
    CourseFactory,
    CourseOfferingFactory,
    RatingFactory,
    SemesterFactory,
)

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def repo():
    from rating_app.ioc_container.repositories import rating_repository

    return rating_repository()


def _rating(comment="Solid course", **kwargs):
    return RatingFactory(comment=comment, **kwargs)


class TestGetFeedPage:
    def test_excludes_ratings_without_a_comment(self, repo):
        """`comment` is never NULL — "no comment" is the empty string."""
        with_comment = _rating(comment="Worth taking")
        _rating(comment="")

        result = repo.get_feed_page(cursor=None, limit=10)

        assert [item.id for item in result] == [with_comment.id]

    def test_orders_newest_first(self, repo):
        older = _rating()
        newer = _rating()

        result = repo.get_feed_page(cursor=None, limit=10)

        assert [item.id for item in result] == [newer.id, older.id]

    def test_maps_course_and_semester_onto_the_card(self, repo):
        semester = SemesterFactory(year=2025, term="FALL")
        course = CourseFactory(title="Дискретна математика")
        offering = CourseOfferingFactory(course=course, semester=semester)
        rating = _rating(comment="Важко, але корисно", course_offering=offering)

        item = repo.get_feed_page(cursor=None, limit=10)[0]

        assert item.course_id == course.id
        assert item.course_title == "Дискретна математика"
        assert item.semester_year == 2025
        assert item.semester_term == "FALL"
        assert item.comment == "Важко, але корисно"
        assert item.difficulty == rating.difficulty
        assert item.usefulness == rating.usefulness

    def test_carries_course_averages_for_the_comparison_arrow(self, repo):
        course = CourseFactory(avg_difficulty="3.50", avg_usefulness="4.25")
        offering = CourseOfferingFactory(course=course)
        _rating(course_offering=offering)

        item = repo.get_feed_page(cursor=None, limit=10)[0]

        assert float(item.course_avg_difficulty) == 3.50
        assert float(item.course_avg_usefulness) == 4.25

    def test_returns_one_row_beyond_limit_as_lookahead(self, repo):
        for _ in range(5):
            _rating()

        result = repo.get_feed_page(cursor=None, limit=2)

        assert len(result) == 3

    def test_cursor_excludes_everything_up_to_that_position(self, repo):
        for _ in range(3):
            _rating()

        first_page = repo.get_feed_page(cursor=None, limit=1)
        cursor = FeedCursor(first_page[0].occurred_at, first_page[0].id)
        second_page = repo.get_feed_page(cursor=cursor, limit=10)

        assert len(second_page) == 2
        assert first_page[0].id not in {item.id for item in second_page}

    def test_walking_the_cursor_yields_every_row_exactly_once(self, repo):
        expected = {_rating().id for _ in range(5)}

        walked = []
        cursor = None
        while True:
            page = repo.get_feed_page(cursor=cursor, limit=2)
            if not page:
                break
            emitted = page[:2]
            walked.extend(item.id for item in emitted)
            cursor = FeedCursor(emitted[-1].occurred_at, emitted[-1].id)

        assert sorted(walked) == sorted(expected)

    def test_uses_the_feed_mapper_not_the_rating_mapper(self, repo):
        _rating()

        item = repo.get_feed_page(cursor=None, limit=10)[0]

        assert not hasattr(item, "student_id")
        assert not hasattr(item, "upvotes")


def test_ioc_injects_the_feed_mapper(repo):
    assert isinstance(repo.feed_mapper, FeedReviewMapper)
