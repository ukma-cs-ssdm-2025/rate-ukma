import pytest

from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.tests.factories import FeedPostFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


def test_creating_a_post_bumps_the_feed_namespace(mock_cache_manager):
    before = mock_cache_manager.get_version(FEED_NAMESPACE)

    FeedPostFactory()

    assert mock_cache_manager.get_version(FEED_NAMESPACE) > before


def test_updating_a_post_bumps_the_feed_namespace(mock_cache_manager):
    post = FeedPostFactory()
    before = mock_cache_manager.get_version(FEED_NAMESPACE)

    post.pinned = True
    post.save()

    assert mock_cache_manager.get_version(FEED_NAMESPACE) > before


def test_deleting_a_post_bumps_the_feed_namespace(mock_cache_manager):
    post = FeedPostFactory()
    before = mock_cache_manager.get_version(FEED_NAMESPACE)

    post.delete()

    assert mock_cache_manager.get_version(FEED_NAMESPACE) > before
