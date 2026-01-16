from rateukma.caching.cache_manager import ICacheManager
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.models import RatingVote

# TODO: implement a generic cache invalidator with patterns


class RatingCacheInvalidator(IEventListener[RatingDTO]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: RatingDTO, *args, **kwargs) -> None:
        patterns = {
            f"*{event.student_id}*",
            "*filter_ratings*",
            "*course*",
        }
        for pattern in patterns:
            self.cache_manager.invalidate_pattern(pattern)


class RatingVoteCacheInvalidator(IEventListener[RatingVote]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: RatingVote, *args, **kwargs) -> None:
        self.cache_manager.invalidate_pattern("*filter_ratings*")
