from rateukma.ioc.decorators import once

from ..services import CourseService, RatingService


@once
def course_service() -> CourseService:
    return CourseService()


@once
def rating_service() -> RatingService:
    return RatingService()


__all__ = ["rating_service", "course_service"]
