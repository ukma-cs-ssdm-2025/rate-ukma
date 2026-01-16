from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.services.course_service import CourseService
from rating_app.services.rating_service import RatingService


class CourseModelAggregatesUpdateObserver(IEventListener[RatingDTO]):
    def __init__(self, course_service: CourseService, rating_service: RatingService):
        self.course_service = course_service
        self.rating_service = rating_service

    @implements
    def on_event(self, event: RatingDTO, *args, **kwargs) -> None:
        course = self.course_service.get_course(str(event.course), prefetch_related=False)
        stats = self.rating_service.get_aggregated_course_stats(course)
        self.course_service.update_course_aggregates(course, stats)
