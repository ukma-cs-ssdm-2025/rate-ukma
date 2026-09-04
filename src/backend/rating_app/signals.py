from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from rateukma.caching.instances import redis_cache_manager
from rateukma.caching.patterns import FEED_NAMESPACE
from rating_app.models import FeedPost


#! Not a domain-event observer: posts are authored in Django admin.
# it writes straight to the ORM and never reaches the service layer.
@receiver([post_save, post_delete], sender=FeedPost)
def invalidate_feed_cache(sender, **kwargs) -> None:
    redis_cache_manager().bump_version(FEED_NAMESPACE)
