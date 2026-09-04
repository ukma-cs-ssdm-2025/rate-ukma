from datetime import timedelta

from django.utils import timezone

import pytest

from rating_app.pagination import FeedCursor
from rating_app.repositories.feed_post_repository import FeedPostRepository
from rating_app.repositories.to_domain_mappers import FeedPostMapper
from rating_app.tests.factories import FeedPostFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def repo():
    return FeedPostRepository(mapper=FeedPostMapper())


def _at(**offset):
    return timezone.now() - timedelta(**offset)


class TestGetPinned:
    def test_returns_only_pinned_posts(self, repo):
        pinned = FeedPostFactory(pinned=True, published_at=_at(hours=1))
        FeedPostFactory(pinned=False, published_at=_at(hours=2))

        result = repo.get_pinned()

        assert [item.id for item in result] == [pinned.id]

    def test_excludes_inactive_posts(self, repo):
        FeedPostFactory(pinned=True, is_active=False, published_at=_at(hours=1))

        assert repo.get_pinned() == []

    def test_excludes_future_published_posts(self, repo):
        """A scheduled post must stay hidden until its publication time."""
        FeedPostFactory(pinned=True, published_at=timezone.now() + timedelta(days=1))

        assert repo.get_pinned() == []

    def test_orders_newest_first(self, repo):
        older = FeedPostFactory(pinned=True, published_at=_at(days=2))
        newer = FeedPostFactory(pinned=True, published_at=_at(hours=1))

        result = repo.get_pinned()

        assert [item.id for item in result] == [newer.id, older.id]


class TestGetPage:
    def test_returns_only_unpinned_posts(self, repo):
        unpinned = FeedPostFactory(pinned=False, published_at=_at(hours=1))
        FeedPostFactory(pinned=True, published_at=_at(hours=2))

        result = repo.get_page(cursor=None, limit=10)

        assert [item.id for item in result] == [unpinned.id]

    def test_excludes_inactive_and_future_posts(self, repo):
        visible = FeedPostFactory(published_at=_at(hours=1))
        FeedPostFactory(is_active=False, published_at=_at(hours=2))
        FeedPostFactory(published_at=timezone.now() + timedelta(days=1))

        result = repo.get_page(cursor=None, limit=10)

        assert [item.id for item in result] == [visible.id]

    def test_returns_one_row_beyond_limit_as_lookahead(self, repo):
        """The extra row is how the service detects a next page without a COUNT."""
        for hours in range(5):
            FeedPostFactory(published_at=_at(hours=hours + 1))

        result = repo.get_page(cursor=None, limit=2)

        assert len(result) == 3

    def test_cursor_excludes_everything_up_to_that_position(self, repo):
        newest = FeedPostFactory(published_at=_at(hours=1))
        middle = FeedPostFactory(published_at=_at(hours=2))
        oldest = FeedPostFactory(published_at=_at(hours=3))

        first_page = repo.get_page(cursor=None, limit=1)
        cursor = FeedCursor(first_page[0].occurred_at, first_page[0].id)
        second_page = repo.get_page(cursor=cursor, limit=10)

        assert first_page[0].id == newest.id
        assert [item.id for item in second_page] == [middle.id, oldest.id]

    def test_cursor_breaks_ties_by_id(self, repo):
        """Posts sharing a timestamp must not repeat or vanish at a boundary."""
        published_at = _at(hours=1)
        posts = [FeedPostFactory(published_at=published_at) for _ in range(3)]

        walked = []
        cursor = None
        while True:
            page = repo.get_page(cursor=cursor, limit=1)
            if not page:
                break
            walked.append(page[0].id)
            cursor = FeedCursor(page[0].occurred_at, page[0].id)

        assert sorted(walked) == sorted(post.id for post in posts)

    def test_returns_empty_when_cursor_past_the_oldest_post(self, repo):
        post = FeedPostFactory(published_at=_at(hours=1))
        cursor = FeedCursor(post.published_at, post.id)

        assert repo.get_page(cursor=cursor, limit=10) == []
