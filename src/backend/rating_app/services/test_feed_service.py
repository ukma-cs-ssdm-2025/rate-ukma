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
    assert str(post.id) not in _ids(service.get_feed(cursor=None, limit=10))

    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(minutes=11))

    assert str(post.id) in _ids(service.get_feed(cursor=None, limit=10))


def test_repeated_calls_are_served_from_cache_while_nothing_changes(service):
    RatingFactory(comment="Корисний курс")

    first = service.get_feed(cursor=None, limit=10)
    second = service.get_feed(cursor=None, limit=10)

    assert _ids(first) == _ids(second)


def test_new_post_invalidates_the_cached_page(service):
    service.get_feed(cursor=None, limit=10)

    post = FeedPostFactory(published_at=timezone.now() - timedelta(minutes=1))

    assert str(post.id) in _ids(service.get_feed(cursor=None, limit=10))
