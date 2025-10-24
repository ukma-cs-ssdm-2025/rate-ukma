from rateukma.ioc.decorators import once
from rating_app.services import CourseService, InstructorService, RatingService


@once
def course_service() -> CourseService:
    return CourseService()


@once
def rating_service() -> RatingService:
    return RatingService()


@once
def instructor_service() -> InstructorService:
    return InstructorService()


__all__ = ["rating_service", "course_service", "instructor_service"]
