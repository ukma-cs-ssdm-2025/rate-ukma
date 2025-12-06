from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.models.rating import Rating
from rating_app.services.course_service import CourseService
from rating_app.services.rating_service import RatingService


class CourseModelAggregatesUpdateObserver(IEventListener[Rating]):
    def __init__(self, course_service: CourseService, rating_service: RatingService):
        self.course_service = course_service
        self.rating_service = rating_service

    @implements
    def on_event(self, event: Rating, *args, **kwargs) -> None:
        course = event.course_offering.course  # type: ignore - temporary fix
        stats = self.rating_service.get_aggregated_course_stats(course)
        self.course_service.update_course_aggregates(course, stats)
