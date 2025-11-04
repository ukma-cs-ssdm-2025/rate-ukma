from rateukma.ioc.decorators import once
from rating_app.repositories import (
    CourseRepository,
    EnrollmentRepository,
    RatingRepository,
    StudentStatisticsRepository,
)


@once
def course_repository() -> CourseRepository:
    return CourseRepository()


@once
def rating_repository() -> RatingRepository:
    return RatingRepository()


@once
def enrollment_repository() -> EnrollmentRepository:
    return EnrollmentRepository()


@once
def student_stats_repository() -> StudentStatisticsRepository:
    return StudentStatisticsRepository()


__all__ = [
    "course_repository",
    "rating_repository",
    "enrollment_repository",
    "student_stats_repository",
]
