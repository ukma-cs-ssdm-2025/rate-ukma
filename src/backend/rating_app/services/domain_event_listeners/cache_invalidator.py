from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.patterns import (
    COURSE_PATTERN,
    RATINGS_PATTERN,
    course_ratings_pattern,
    student_pattern,
)
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.repositories import RatingRepository

# TODO: implement a generic cache invalidator with patterns


class RatingCacheInvalidator(IEventListener[RatingDTO]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: RatingDTO, *args, **kwargs) -> None:
        patterns = {
            student_pattern(str(event.student_id)),
            RATINGS_PATTERN,
            COURSE_PATTERN,
        }
        for pattern in patterns:
            self.cache_manager.invalidate_pattern(pattern)


class RatingVoteCacheInvalidator(IEventListener[RatingVoteDTO]):
    def __init__(self, cache_manager: ICacheManager, rating_repository: RatingRepository):
        self.cache_manager = cache_manager
        self.rating_repository = rating_repository

    @implements
    def on_event(self, event: RatingVoteDTO, *args, **kwargs) -> None:
        rating = self.rating_repository.get_by_id(str(event.rating_id))
        course_id = str(rating.course)
        pattern = course_ratings_pattern(course_id)
        self.cache_manager.invalidate_pattern(pattern)
