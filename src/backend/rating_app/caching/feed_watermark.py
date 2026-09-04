"""Marks when the next scheduled feed post goes live.

Nothing is written when the clock crosses a post's `published_at`, so the feed
cache has no write event to invalidate on. The watermark records that moment in
Redis: the first reader past it retires the cached pages, which keeps the feed
free of a per-request DB query while still surfacing scheduled posts on time.
"""

from datetime import datetime

from django.utils import timezone

from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.patterns import FEED_WATERMARK_KEY

# The watermark has to outlive the moment it marks,
# or it expires before any reader gets to act on it.
WATERMARK_GRACE = 60 * 60


def store_feed_watermark(cache_manager: ICacheManager, next_publication: datetime | None) -> None:
    # points the watermark at `next_publication`, or drop it when nothing is scheduled.
    if next_publication is None:
        cache_manager.invalidate(FEED_WATERMARK_KEY)
        return

    ttl = int((next_publication - timezone.now()).total_seconds()) + WATERMARK_GRACE
    cache_manager.set(FEED_WATERMARK_KEY, next_publication.isoformat(), max(ttl, 1))


def is_watermark_due(cache_manager: ICacheManager) -> bool:
    # True when a scheduled post is visible since the pages were cached.
    stored = cache_manager.get(FEED_WATERMARK_KEY)
    if not isinstance(stored, str):
        return False
    return datetime.fromisoformat(stored) <= timezone.now()
