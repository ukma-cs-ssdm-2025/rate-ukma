from datetime import datetime

from django.utils import timezone

from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.patterns import FEED_NEXT_PUBLISH_AT_KEY

# The stored time has to outlive the moment it marks,
# or it expires before any reader gets to act on it.
NEXT_PUBLISH_GRACE = 60 * 60


def store_feed_next_publish_at(
    cache_manager: ICacheManager, next_publication: datetime | None
) -> None:
    if next_publication is None:
        cache_manager.invalidate(FEED_NEXT_PUBLISH_AT_KEY)
        return

    ttl = int((next_publication - timezone.now()).total_seconds()) + NEXT_PUBLISH_GRACE
    cache_manager.set(FEED_NEXT_PUBLISH_AT_KEY, next_publication.isoformat(), max(ttl, 1))


def is_next_publish_due(cache_manager: ICacheManager) -> bool:
    stored = cache_manager.get(FEED_NEXT_PUBLISH_AT_KEY)
    if not isinstance(stored, str):
        return False
    return datetime.fromisoformat(stored) <= timezone.now()
