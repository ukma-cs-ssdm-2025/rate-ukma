from rateukma.caching.cache_manager import ICacheManager
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.models.rating import Rating


class CacheInvalidator(IEventListener[Rating]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: Rating, *args, **kwargs) -> None:
        patterns = {
            f"*{event.student.id}*",
            "*filter_ratings*",
            "*course*",
        }
        for pattern in patterns:
            self.cache_manager.invalidate_pattern(pattern)
