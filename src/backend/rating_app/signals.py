from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from rateukma.caching.instances import redis_cache_manager
from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.ioc_container.services import feed_service, feed_update_service
from rating_app.models import FeedEvent, FeedPost


# Every feed change, including cascaded deletes, lands in `FeedEvent`
# This is the one place where the cached page is invalidated.
@receiver([post_save, post_delete], sender=FeedEvent)
def invalidate_feed_cache(sender, **kwargs) -> None:
    def _bump() -> None:
        redis_cache_manager().bump_version(FEED_NAMESPACE)
        feed_service().refresh_next_publish_marker()

    # Redis cannot roll back with the transaction, so wait for the commit.
    transaction.on_commit(_bump)


# Posts are created in admin and never reach a service, so signal is needed.
# Deletion cascades through `FeedPost.feed_events`.
@receiver(post_save, sender=FeedPost)
def sync_post_to_feed(sender, instance: FeedPost, **kwargs) -> None:
    feed_update_service().sync_post(instance)
