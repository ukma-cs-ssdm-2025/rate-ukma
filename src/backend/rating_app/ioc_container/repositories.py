from rateukma.ioc.decorators import once

from ..repositories import CourseRepository, EnrollmentRepository, RatingRepository


@once
def course_repository() -> CourseRepository:
    return CourseRepository()


@once
def rating_repository() -> RatingRepository:
    return RatingRepository()


@once
def enrollment_repository() -> EnrollmentRepository:
    return EnrollmentRepository()


__all__ = ["course_repository", "rating_repository", "enrollment_repository"]
