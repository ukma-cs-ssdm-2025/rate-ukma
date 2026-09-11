from datetime import timedelta

from django.utils import timezone

import pytest

from rating_app.ioc_container.repositories import feed_event_repository
from rating_app.models.choices import FeedEventType
from rating_app.pagination import FeedCursor
from rating_app.repositories.feed_event_repository import MAX_PINNED
from rating_app.tests.factories import FeedPostFactory, RatingFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def repo():
    return feed_event_repository()


def _at(**offset):
    return timezone.now() - timedelta(**offset)


class TestGetPinned:
    def test_returns_only_pinned_entries(self, repo):
        pinned = FeedPostFactory(pinned=True, published_at=_at(hours=1))
        FeedPostFactory(pinned=False, published_at=_at(hours=2))

        assert [row.object_id for row in repo.get_pinned()] == [pinned.id]

    def test_excludes_invisible_entries(self, repo):
        FeedPostFactory(pinned=True, is_active=False, published_at=_at(hours=1))

        assert repo.get_pinned() == []

    def test_excludes_future_entries(self, repo):
        """A scheduled post must stay hidden until its publication time."""
        FeedPostFactory(pinned=True, published_at=timezone.now() + timedelta(days=1))

        assert repo.get_pinned() == []

    def test_orders_newest_first(self, repo):
        older = FeedPostFactory(pinned=True, published_at=_at(days=2))
        newer = FeedPostFactory(pinned=True, published_at=_at(hours=1))

        assert [row.object_id for row in repo.get_pinned()] == [newer.id, older.id]

    def test_keeps_the_newest_when_capped(self, repo):
        posts = [
            FeedPostFactory(pinned=True, published_at=_at(hours=hours + 1))
            for hours in range(MAX_PINNED + 2)
        ]
        newest = sorted(posts, key=lambda p: p.published_at, reverse=True)[:MAX_PINNED]

        assert [row.object_id for row in repo.get_pinned()] == [p.id for p in newest]


class TestGetPage:
    def test_mixes_kinds_in_one_ordered_stream(self, repo):
        older_post = FeedPostFactory(published_at=_at(hours=3))
        rating = RatingFactory(comment="Свіжий відгук")
        newer_post = FeedPostFactory(published_at=_at(hours=1))

        rows = repo.get_page(cursor=None, limit=10)

        assert [row.object_id for row in rows] == [rating.id, newer_post.id, older_post.id]
        assert [row.event_type for row in rows] == [
            FeedEventType.REVIEW_PUBLISHED,
            FeedEventType.POST_PUBLISHED,
            FeedEventType.POST_PUBLISHED,
        ]

    def test_excludes_pinned_invisible_and_future_entries(self, repo):
        visible = FeedPostFactory(published_at=_at(hours=1))
        FeedPostFactory(pinned=True, published_at=_at(hours=2))
        FeedPostFactory(is_active=False, published_at=_at(hours=3))
        FeedPostFactory(published_at=timezone.now() + timedelta(days=1))
        RatingFactory(comment="")

        assert [row.object_id for row in repo.get_page(cursor=None, limit=10)] == [visible.id]

    def test_returns_one_row_beyond_limit_as_lookahead(self, repo):
        for hours in range(5):
            FeedPostFactory(published_at=_at(hours=hours + 1))

        assert len(repo.get_page(cursor=None, limit=2)) == 3

    def test_cursor_excludes_everything_up_to_that_position(self, repo):
        newest = FeedPostFactory(published_at=_at(hours=1))
        middle = FeedPostFactory(published_at=_at(hours=2))
        oldest = FeedPostFactory(published_at=_at(hours=3))

        first_page = repo.get_page(cursor=None, limit=1)
        cursor = FeedCursor(first_page[0].occurred_at, first_page[0].id)
        second_page = repo.get_page(cursor=cursor, limit=10)

        assert first_page[0].object_id == newest.id
        assert [row.object_id for row in second_page] == [middle.id, oldest.id]

    def test_cursor_breaks_ties_by_id(self, repo):
        """Entries sharing a timestamp must not repeat or vanish at a boundary."""
        published_at = _at(hours=1)
        posts = [FeedPostFactory(published_at=published_at) for _ in range(3)]

        walked = []
        cursor = None
        while True:
            page = repo.get_page(cursor=cursor, limit=1)
            if not page:
                break
            walked.append(page[0].object_id)
            cursor = FeedCursor(page[0].occurred_at, page[0].id)

        assert sorted(walked) == sorted(post.id for post in posts)

    def test_returns_empty_when_cursor_past_the_oldest_entry(self, repo):
        FeedPostFactory(published_at=_at(hours=1))
        [row] = repo.get_page(cursor=None, limit=10)

        assert repo.get_page(cursor=FeedCursor(row.occurred_at, row.id), limit=10) == []


class TestGetNextFutureOccurrence:
    def test_earliest_visible_future_entry(self, repo):
        FeedPostFactory(published_at=timezone.now() + timedelta(days=2))
        soonest = FeedPostFactory(published_at=timezone.now() + timedelta(days=1))
        FeedPostFactory(is_active=False, published_at=timezone.now() + timedelta(hours=1))

        assert repo.get_next_future_occurrence() == soonest.published_at

    def test_none_when_nothing_is_scheduled(self, repo):
        FeedPostFactory(published_at=_at(hours=1))

        assert repo.get_next_future_occurrence() is None
