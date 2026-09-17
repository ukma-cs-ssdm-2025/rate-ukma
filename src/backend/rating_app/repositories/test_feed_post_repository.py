import pytest

from rating_app.repositories.feed_post_repository import FeedPostRepository
from rating_app.repositories.to_domain_mappers import FeedPostMapper
from rating_app.tests.factories import FeedPostFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def repo():
    return FeedPostRepository(mapper=FeedPostMapper())


class TestGetFeedItemsByIds:
    def test_returns_cards_for_the_requested_posts_only(self, repo):
        wanted = FeedPostFactory(title="Хакатон")
        FeedPostFactory()

        result = repo.get_feed_items_by_ids([wanted.id])

        assert [item.id for item in result] == [wanted.id]
        assert result[0].title == "Хакатон"
        assert result[0].occurred_at == wanted.published_at

    def test_skips_ids_that_no_longer_exist(self, repo):
        post = FeedPostFactory()
        gone_id = post.id
        post.delete()

        assert repo.get_feed_items_by_ids([gone_id]) == []
