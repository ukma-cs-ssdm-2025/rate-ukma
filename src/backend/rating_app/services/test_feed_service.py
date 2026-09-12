import uuid
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

import pytest

from rating_app.ioc_container.services import feed_service
from rating_app.models import FeedEvent, Rating
from rating_app.models.choices import FeedEventType
from rating_app.tests.factories import FeedPostFactory, RatingFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def service():
    return feed_service()


@pytest.fixture
def make_post(django_capture_on_commit_callbacks):
    def _create(**kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return FeedPostFactory(**kwargs)

    return _create


def _ids(page):
    return [str(item.id) for item in page.items]


def test_scheduled_post_appears_once_its_publication_time_passes(service, monkeypatch, make_post):
    now = timezone.now()
    post = make_post(published_at=now + timedelta(minutes=10))

    # Cached while the post is still in the future.
    assert str(post.id) not in _ids(service.get_feed_page(cursor=None, limit=10))

    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(minutes=11))

    assert str(post.id) in _ids(service.get_feed_page(cursor=None, limit=10))


def test_repeated_calls_are_served_from_cache_while_nothing_changes(service):
    RatingFactory(comment="Корисний курс")

    first = service.get_feed_page(cursor=None, limit=10)
    second = service.get_feed_page(cursor=None, limit=10)

    assert _ids(first) == _ids(second)


def test_new_post_invalidates_the_cached_page(service, make_post):
    service.get_feed_page(cursor=None, limit=10)

    post = make_post(published_at=timezone.now() - timedelta(minutes=1))

    assert str(post.id) in _ids(service.get_feed_page(cursor=None, limit=10))


def test_each_scheduled_post_appears_in_turn(service, monkeypatch, make_post):
    """The marker has to move on to the post after the one it just released."""
    now = timezone.now()
    first = make_post(published_at=now + timedelta(minutes=10))
    second = make_post(published_at=now + timedelta(minutes=20))

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


def test_a_page_costs_one_index_query_plus_one_per_kind(service, django_assert_num_queries):
    for i in range(4):
        RatingFactory(comment=f"Відгук {i}")
        FeedPostFactory(published_at=timezone.now() - timedelta(hours=i + 1))

    # first page holds 4 reviews + 2 posts: keyset + pinned prefix + one fetch per kind
    with django_assert_num_queries(4):
        first = service.get_feed_page(cursor=None, limit=6)

    # second page holds the 2 remaining posts: keyset + posts only, no pinned prefix
    with django_assert_num_queries(2):
        second = service.get_feed_page(cursor=first.next_cursor, limit=6)

    assert len(first.items) == 6
    assert len(second.items) == 2


def test_an_entry_whose_source_is_gone_is_skipped_but_still_paged_past(service):
    """Every ORM delete cascades through the sources' GenericRelation, so a
    dangling entry can only come from raw SQL. The read path tolerates it
    anyway: the card drops out, and the cursor is minted from the index row,
    so the reader lands on the next page rather than looping on the hole.
    """
    earliest = RatingFactory(comment="Перший")
    dangling = FeedEvent.objects.create(
        event_type=FeedEventType.REVIEW_PUBLISHED,
        occurred_at=timezone.now(),
        content_type=ContentType.objects.get_for_model(Rating),
        object_id=uuid.uuid4(),
    )
    latest = RatingFactory(comment="Останній")

    first = service.get_feed_page(cursor=None, limit=2)
    second = service.get_feed_page(cursor=first.next_cursor, limit=2)

    assert dangling.occurred_at > earliest.created_at
    assert _ids(first) == [str(latest.id)]
    assert _ids(second) == [str(earliest.id)]
    assert second.next_cursor is None
