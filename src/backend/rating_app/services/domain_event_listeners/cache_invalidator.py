from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.patterns import (
    COURSE_PATTERN,
    RATINGS_PATTERN,
    course_ratings_pattern,
    student_pattern,
)
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.models import Rating, RatingVote


class RatingCacheInvalidator(IEventListener[Rating]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: Rating, *args, **kwargs) -> None:
        patterns = {
            student_pattern(str(event.student.id)),
            RATINGS_PATTERN,
            COURSE_PATTERN,
        }
        for pattern in patterns:
            self.cache_manager.invalidate_pattern(pattern)


class RatingVoteCacheInvalidator(IEventListener[RatingVote]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: RatingVote, *args, **kwargs) -> None:
        course_id = str(event.rating.course_offering.course.id)
        self.cache_manager.invalidate_pattern(course_ratings_pattern(course_id))
