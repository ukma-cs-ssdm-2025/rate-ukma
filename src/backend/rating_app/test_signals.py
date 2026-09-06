import pytest

from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.tests.factories import FeedPostFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


# The bump is deferred to on_commit: post_save fires while the admin's atomic
# block is still open, so bumping inline would let a concurrent feed request
# rebuild and cache a page under the new version while the write is still
# invisible, pinning the stale page for the full TTL. These tests therefore
# capture the commit callbacks and assert the bump lands only once they run.


def test_creating_a_post_bumps_the_feed_namespace(
    mock_cache_manager, django_capture_on_commit_callbacks
):
    before = mock_cache_manager.get_version(FEED_NAMESPACE)

    with django_capture_on_commit_callbacks(execute=True):
        FeedPostFactory()

        assert mock_cache_manager.get_version(FEED_NAMESPACE) == before

    assert mock_cache_manager.get_version(FEED_NAMESPACE) > before


def test_updating_a_post_bumps_the_feed_namespace(
    mock_cache_manager, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        post = FeedPostFactory()
    before = mock_cache_manager.get_version(FEED_NAMESPACE)

    with django_capture_on_commit_callbacks(execute=True):
        post.pinned = True
        post.save()

        assert mock_cache_manager.get_version(FEED_NAMESPACE) == before

    assert mock_cache_manager.get_version(FEED_NAMESPACE) > before


def test_deleting_a_post_bumps_the_feed_namespace(
    mock_cache_manager, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        post = FeedPostFactory()
    before = mock_cache_manager.get_version(FEED_NAMESPACE)

    with django_capture_on_commit_callbacks(execute=True):
        post.delete()

        assert mock_cache_manager.get_version(FEED_NAMESPACE) == before

    assert mock_cache_manager.get_version(FEED_NAMESPACE) > before
