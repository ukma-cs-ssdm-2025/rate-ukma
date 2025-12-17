from rateukma.caching.cache_manager import ICacheManager
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.models.rating import Rating


class CacheInvalidator(IEventListener[Rating]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: Rating, *args, **kwargs) -> None:
        self.cache_manager.invalidate_pattern(f"*{str(event.student.id)}*")
        self.cache_manager.invalidate_pattern("*filter_ratings*")
        self.cache_manager.invalidate_pattern("*filter_courses*")
        self.cache_manager.invalidate_pattern("*get_course*")
        self.cache_manager.invalidate_pattern("*list_courses*")
