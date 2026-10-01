import pytest

from rating_app.repositories.feed_post_repository import FeedPostRepository
from rating_app.repositories.to_domain_mappers import FeedPostMapper


@pytest.fixture
def repo():
    return FeedPostRepository(mapper=FeedPostMapper())


@pytest.mark.django_db
@pytest.mark.integration
class TestGetFeedItemsByIds:
    def test_returns_cards_for_the_requested_posts_only(self, repo, feed_post_factory):
        wanted = feed_post_factory(title="Хакатон")
        feed_post_factory()

        result = repo.get_feed_items_by_ids([wanted.id])

        assert [item.id for item in result] == [wanted.id]
        assert result[0].title == "Хакатон"
        assert result[0].occurred_at == wanted.published_at

    def test_skips_ids_that_no_longer_exist(self, repo, feed_post_factory):
        post = feed_post_factory()
        gone_id = post.id
        post.delete()

        assert repo.get_feed_items_by_ids([gone_id]) == []
