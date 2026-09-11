import pytest

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


class TestGetFeedItemsByIds:
    def test_returns_cards_for_the_requested_ratings_only(self, repo):
        wanted = _rating(comment="Worth taking")
        _rating(comment="Not asked for")

        result = repo.get_feed_items_by_ids([wanted.id])

        assert [item.id for item in result] == [wanted.id]

    def test_does_not_filter_on_comment(self, repo):
        """Visibility is the index's job; a fetch answers for whatever it is asked."""
        blank = _rating(comment="")

        assert [item.id for item in repo.get_feed_items_by_ids([blank.id])] == [blank.id]

    def test_maps_course_and_semester_onto_the_card(self, repo):
        semester = SemesterFactory(year=2025, term="FALL")
        course = CourseFactory(title="Дискретна математика")
        offering = CourseOfferingFactory(course=course, semester=semester)
        rating = _rating(comment="Важко, але корисно", course_offering=offering)

        [item] = repo.get_feed_items_by_ids([rating.id])

        assert item.course_id == course.id
        assert item.course_title == "Дискретна математика"
        assert item.semester_year == 2025
        assert item.semester_term == "FALL"
        assert item.comment == "Важко, але корисно"
        assert item.difficulty == rating.difficulty
        assert item.usefulness == rating.usefulness
        assert item.occurred_at == rating.created_at

    def test_carries_course_averages_for_the_comparison_arrow(self, repo):
        course = CourseFactory(avg_difficulty="3.50", avg_usefulness="4.25")
        offering = CourseOfferingFactory(course=course)
        rating = _rating(course_offering=offering)

        [item] = repo.get_feed_items_by_ids([rating.id])

        assert float(item.course_avg_difficulty) == 3.50
        assert float(item.course_avg_usefulness) == 4.25

    def test_uses_the_feed_mapper_not_the_rating_mapper(self, repo):
        rating = _rating()

        [item] = repo.get_feed_items_by_ids([rating.id])

        assert not hasattr(item, "student_id")
        assert not hasattr(item, "upvotes")

    def test_fetches_a_page_in_one_query(self, repo, django_assert_num_queries):
        ids = [_rating().id for _ in range(5)]

        with django_assert_num_queries(1):
            assert len(repo.get_feed_items_by_ids(ids)) == 5


def test_ioc_injects_the_feed_mapper(repo):
    assert isinstance(repo.feed_mapper, FeedReviewMapper)
