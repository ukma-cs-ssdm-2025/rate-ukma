from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

import pytest

from rating_app.tests.factories import (
    CourseFactory,
    CourseOfferingFactory,
    FeedPostFactory,
    RatingFactory,
    SemesterFactory,
)

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.fixture
def feed_url():
    return reverse("feed-list")


def _at(**offset):
    return timezone.now() - timedelta(**offset)


def test_requires_authentication(api_client, feed_url):
    assert api_client.get(feed_url).status_code in (401, 403)


def test_returns_both_kinds_in_one_stream(token_client, feed_url):
    RatingFactory(comment="Корисний курс")
    FeedPostFactory(title="Хакатон")

    body = token_client.get(feed_url).json()

    assert {item["kind"] for item in body["items"]} == {"review", "promo"}


def test_orders_newest_first_across_kinds(token_client, feed_url):
    FeedPostFactory(published_at=_at(hours=3))
    rating = RatingFactory(comment="Свіжий відгук")
    FeedPostFactory(published_at=_at(hours=1))

    items = token_client.get(feed_url).json()["items"]

    assert items[0]["id"] == str(rating.id)
    assert [item["kind"] for item in items] == ["review", "promo", "promo"]


def test_omits_ratings_without_a_comment(token_client, feed_url):
    RatingFactory(comment="")

    assert token_client.get(feed_url).json()["items"] == []


def test_review_items_expose_no_student_identity(token_client, feed_url):
    RatingFactory(comment="Анонімно")

    item = token_client.get(feed_url).json()["items"][0]

    assert "student_id" not in item
    assert "student_name" not in item


def test_review_items_carry_course_context_and_averages(token_client, feed_url):
    course = CourseFactory(title="Алгоритми", avg_difficulty="3.50", avg_usefulness="4.25")
    semester = SemesterFactory(year=2026, term="FALL")
    offering = CourseOfferingFactory(course=course, semester=semester)
    RatingFactory(comment="Складно", course_offering=offering)

    item = token_client.get(feed_url).json()["items"][0]

    assert item["course_title"] == "Алгоритми"
    assert item["semester_year"] == 2026
    assert item["semester_term"] == "FALL"
    assert item["course_avg_difficulty"] == 3.5
    assert item["course_avg_usefulness"] == 4.25


class TestPinning:
    def test_pinned_posts_lead_the_first_page(self, token_client, feed_url):
        FeedPostFactory(published_at=_at(hours=1))
        pinned = FeedPostFactory(pinned=True, published_at=_at(days=30))

        items = token_client.get(feed_url).json()["items"]

        assert items[0]["id"] == str(pinned.id)
        assert items[0]["pinned"] is True

    def test_pinned_posts_never_appear_on_later_pages(self, token_client, feed_url):
        FeedPostFactory(pinned=True, published_at=_at(days=30))
        for hours in range(4):
            FeedPostFactory(published_at=_at(hours=hours + 1))

        first = token_client.get(feed_url, {"limit": 2}).json()
        second = token_client.get(feed_url, {"cursor": first["next_cursor"]}).json()

        assert sum(item["pinned"] for item in second["items"]) == 0


class TestPagination:
    def test_walks_to_exhaustion_without_duplicates_or_gaps(self, token_client, feed_url):
        expected = {str(RatingFactory(comment=f"Відгук {i}").id) for i in range(4)}
        expected |= {str(FeedPostFactory(published_at=_at(hours=i + 1)).id) for i in range(3)}

        seen = []
        cursor = None
        while True:
            params = {"limit": 2}
            if cursor:
                params["cursor"] = cursor
            body = token_client.get(feed_url, params).json()
            seen.extend(item["id"] for item in body["items"])
            cursor = body["next_cursor"]
            if cursor is None:
                break

        assert len(seen) == len(set(seen))
        assert set(seen) == expected

    def test_next_cursor_is_null_on_the_last_page(self, token_client, feed_url):
        RatingFactory(comment="Єдиний")

        assert token_client.get(feed_url).json()["next_cursor"] is None

    def test_rejects_a_malformed_cursor(self, token_client, feed_url):
        assert token_client.get(feed_url, {"cursor": "not-a-cursor"}).status_code == 400

    def test_rejects_an_out_of_range_limit(self, token_client, feed_url):
        assert token_client.get(feed_url, {"limit": 0}).status_code == 400
