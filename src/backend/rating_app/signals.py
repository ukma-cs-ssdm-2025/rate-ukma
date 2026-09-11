from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from rateukma.caching.instances import redis_cache_manager
from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.ioc_container.services import feed_service, feed_update_service
from rating_app.models import FeedPost


#! Not domain-event observers: posts are authored in Django admin.
# It writes straight to the ORM and never reaches the service layer.
@receiver([post_save, post_delete], sender=FeedPost)
def invalidate_feed_cache(sender, **kwargs) -> None:
    def _bump() -> None:
        redis_cache_manager().bump_version(FEED_NAMESPACE)
        feed_service().refresh_next_publish_marker()

    transaction.on_commit(_bump)


@receiver(post_save, sender=FeedPost)
def sync_post_to_feed(sender, instance: FeedPost, **kwargs) -> None:
    feed_update_service().sync_post(instance)


@receiver(post_delete, sender=FeedPost)
def remove_post_from_feed(sender, instance: FeedPost, **kwargs) -> None:
    feed_update_service().remove(FeedPost, instance.pk)
