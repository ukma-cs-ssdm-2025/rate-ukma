from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from rateukma.caching.instances import redis_cache_manager
from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.ioc_container.services import feed_service, feed_update_service
from rating_app.models import FeedEvent, FeedPost


# Every change to the feed lands in `FeedEvent`, whichever source it came
# from, so this is the one place the cached page is invalidated. Cascaded
# deletes reach here too: a `post_delete` listener disables the collector's
# fast path for this model.
@receiver([post_save, post_delete], sender=FeedEvent)
def invalidate_feed_cache(sender, **kwargs) -> None:
    def _bump() -> None:
        redis_cache_manager().bump_version(FEED_NAMESPACE)
        feed_service().refresh_next_publish_marker()

    # Redis cannot roll back with the transaction, so wait for the commit.
    transaction.on_commit(_bump)


# Posts never reach a service, so this receiver is the only place a post's lifecycle can be seen.
# Ratings go through `RatingService` and are handled by its observers instead.
# Deletion cascades through `FeedPost.feed_events`.
@receiver(post_save, sender=FeedPost)
def sync_post_to_feed(sender, instance: FeedPost, **kwargs) -> None:
    feed_update_service().sync_post(instance)
