from datetime import timedelta

from django.utils import timezone

import pytest

from rating_app.ioc_container.services import feed_service
from rating_app.tests.factories import FeedPostFactory, RatingFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def service():
    return feed_service()


def _ids(page):
    return [str(item.id) for item in page.items]


def test_scheduled_post_appears_once_its_publication_time_passes(service, monkeypatch):
    """A page cached while a post was still scheduled must not stay stale.

    Nothing is written when the clock crosses `published_at`, so a
    write-triggered invalidation alone would leave the cached page hiding the
    post for the whole TTL.
    """
    now = timezone.now()
    post = FeedPostFactory(published_at=now + timedelta(minutes=10))

    # Cached while the post is still in the future.
    assert str(post.id) not in _ids(service.get_feed_page(cursor=None, limit=10))

    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(minutes=11))

    assert str(post.id) in _ids(service.get_feed_page(cursor=None, limit=10))


def test_repeated_calls_are_served_from_cache_while_nothing_changes(service):
    RatingFactory(comment="Корисний курс")

    first = service.get_feed_page(cursor=None, limit=10)
    second = service.get_feed_page(cursor=None, limit=10)

    assert _ids(first) == _ids(second)


def test_new_post_invalidates_the_cached_page(service):
    service.get_feed_page(cursor=None, limit=10)

    post = FeedPostFactory(published_at=timezone.now() - timedelta(minutes=1))

    assert str(post.id) in _ids(service.get_feed_page(cursor=None, limit=10))


def test_each_scheduled_post_appears_in_turn(service, monkeypatch):
    """The watermark has to move on to the post after the one it just released."""
    now = timezone.now()
    first = FeedPostFactory(published_at=now + timedelta(minutes=10))
    second = FeedPostFactory(published_at=now + timedelta(minutes=20))

    service.get_feed_page(cursor=None, limit=10)

    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(minutes=11))
    page = _ids(service.get_feed_page(cursor=None, limit=10))
    assert str(first.id) in page
    assert str(second.id) not in page

    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(minutes=21))
    assert str(second.id) in _ids(service.get_feed_page(cursor=None, limit=10))


def test_a_cache_hit_costs_no_database_query(service, django_assert_num_queries):
    RatingFactory(comment="Корисний курс")
    service.get_feed_page(cursor=None, limit=10)

    with django_assert_num_queries(0):
        service.get_feed_page(cursor=None, limit=10)
