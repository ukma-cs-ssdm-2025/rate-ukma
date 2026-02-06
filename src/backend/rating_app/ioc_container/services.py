from rateukma.caching.instances import redis_cache_manager
from rateukma.ioc.decorators import once
from rating_app.ioc_container.repositories import (
    course_offering_repository,
    course_repository,
    department_repository,
    enrollment_repository,
    faculty_repository,
    instructor_repository,
    rating_repository,
    rating_vote_mapper,
    semester_repository,
    speciality_repository,
    student_repository,
    student_stats_repository,
    user_repository,
    vote_repository,
)
from rating_app.services import (
    CourseOfferingService,
    CourseService,
    DepartmentService,
    FacultyService,
    InstructorService,
    RatingFeedbackService,
    RatingService,
    SemesterService,
    SpecialityService,
    StudentService,
)
from rating_app.services.domain_event_listeners.aggregates_update import (
    CourseModelAggregatesUpdateObserver,
)
from rating_app.services.domain_event_listeners.cache_invalidator import (
    RatingCacheInvalidator,
    RatingVoteCacheInvalidator,
)


@once
def faculty_service() -> FacultyService:
    return FacultyService(faculty_repository=faculty_repository())


@once
def department_service() -> DepartmentService:
    return DepartmentService(department_repository=department_repository())


@once
def speciality_service() -> SpecialityService:
    return SpecialityService(speciality_repository=speciality_repository())


@once
def semester_service() -> SemesterService:
    return SemesterService(semester_repository=semester_repository())


@once
def course_service() -> CourseService:
    return CourseService(
        course_repository=course_repository(),
        instructor_service=instructor_service(),
        faculty_service=faculty_service(),
        department_service=department_service(),
        speciality_service=speciality_service(),
        semester_service=semester_service(),
    )


@once
def rating_service() -> RatingService:
    return RatingService(
        rating_repository=rating_repository(),
        enrollment_repository=enrollment_repository(),
        course_offering_service=course_offering_service(),
        semester_service=semester_service(),
        vote_repository=vote_repository(),
        vote_mapper=rating_vote_mapper(),
    )


@once
def course_model_aggregates_update_observer() -> CourseModelAggregatesUpdateObserver:
    return CourseModelAggregatesUpdateObserver(
        course_service=course_service(),
        rating_service=rating_service(),
    )


@once
def rating_cache_invalidator() -> RatingCacheInvalidator:
    return RatingCacheInvalidator(cache_manager=redis_cache_manager())


@once
def instructor_service() -> InstructorService:
    return InstructorService(instructor_repository=instructor_repository())


@once
def student_service() -> StudentService:
    return StudentService(
        student_stats_repository=student_stats_repository(),
        student_repository=student_repository(),
        semester_service=semester_service(),
        user_repository=user_repository(),
        rating_service=rating_service(),
    )


@once
def course_offering_service() -> CourseOfferingService:
    return CourseOfferingService(course_offering_repository=course_offering_repository())


@once
def vote_service() -> RatingFeedbackService:
    return RatingFeedbackService(
        vote_repository=vote_repository(),
        enrollment_repository=enrollment_repository(),
        rating_repository=rating_repository(),
        vote_mapper=rating_vote_mapper(),
    )


@once
def rating_vote_cache_invalidator() -> RatingVoteCacheInvalidator:
    return RatingVoteCacheInvalidator(
        cache_manager=redis_cache_manager(),
        rating_repository=rating_repository(),
    )


def register_observers() -> None:
    rating_service().add_observer(course_model_aggregates_update_observer())
    rating_service().add_observer(rating_cache_invalidator())
    vote_service().add_observer(rating_vote_cache_invalidator())


__all__ = [
    "rating_service",
    "course_service",
    "instructor_service",
    "student_service",
    "semester_service",
    "faculty_service",
    "department_service",
    "speciality_service",
    "vote_service",
]
