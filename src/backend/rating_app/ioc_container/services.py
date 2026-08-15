from rateukma.caching.instances import redis_cache_manager
from rateukma.ioc.decorators import once
from rating_app.ioc_container.repositories import (
    comment_repository,
    course_offering_repository,
    course_repository,
    department_repository,
    enrollment_repository,
    faculty_repository,
    instructor_mapper,
    instructor_repository,
    notification_cursor_repository,
    notification_repository,
    rating_repository,
    rating_vote_mapper,
    semester_repository,
    speciality_repository,
    student_repository,
    student_stats_repository,
    user_repository,
    vote_repository,
)
from rating_app.pagination.paginator import GenericQuerysetPaginator
from rating_app.services import (
    CommentNormalizer,
    CommentService,
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
from rating_app.services.course_page_service import CoursePageService
from rating_app.services.domain_event_listeners.aggregates_update import (
    CourseModelAggregatesUpdateObserver,
)
from rating_app.services.domain_event_listeners.cache_invalidator import (
    CommentCacheInvalidator,
    RatingCacheInvalidator,
    RatingVoteCacheInvalidator,
)
from rating_app.services.domain_event_listeners.comment_notification import (
    CommentNotificationObserver,
)
from rating_app.services.domain_event_listeners.vote_notification import (
    VoteNotificationObserver,
)
from rating_app.services.notification_service import NotificationService


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
def comment_normalizer() -> CommentNormalizer:
    return CommentNormalizer()


@once
def course_page_service() -> CoursePageService:
    return CoursePageService(course_service=course_service())


@once
def rating_service() -> RatingService:
    return RatingService(
        rating_repository=rating_repository(),
        enrollment_repository=enrollment_repository(),
        course_offering_service=course_offering_service(),
        semester_service=semester_service(),
        vote_repository=vote_repository(),
        vote_mapper=rating_vote_mapper(),
        comment_normalizer=comment_normalizer(),
        instructor_repository=instructor_repository(),
    )


@once
def comment_service() -> CommentService:
    return CommentService(
        comment_repository=comment_repository(),
        comment_normalizer=comment_normalizer(),
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
    return InstructorService(
        instructor_repository=instructor_repository(),
        mapper=instructor_mapper(),
        paginator=GenericQuerysetPaginator(),
    )


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
        rating_service=rating_service(),
        course_offering_service=course_offering_service(),
        semester_service=semester_service(),
        vote_mapper=rating_vote_mapper(),
    )


@once
def rating_vote_cache_invalidator() -> RatingVoteCacheInvalidator:
    return RatingVoteCacheInvalidator(
        cache_manager=redis_cache_manager(),
        rating_repository=rating_repository(),
    )


@once
def comment_cache_invalidator() -> CommentCacheInvalidator:
    return CommentCacheInvalidator(cache_manager=redis_cache_manager())


@once
def notification_service() -> NotificationService:
    return NotificationService(
        notification_repository=notification_repository(),
        cursor_repository=notification_cursor_repository(),
    )


@once
def vote_notification_observer() -> VoteNotificationObserver:
    return VoteNotificationObserver(
        notification_service=notification_service(),
        rating_repository=rating_repository(),
        student_repository=student_repository(),
    )


@once
def comment_notification_observer() -> CommentNotificationObserver:
    return CommentNotificationObserver(
        notification_service=notification_service(),
        rating_repository=rating_repository(),
        student_repository=student_repository(),
    )


def register_observers() -> None:
    rating_service().add_observer(course_model_aggregates_update_observer())
    rating_service().add_observer(rating_cache_invalidator())
    comment_service().add_observer(comment_cache_invalidator())
    comment_service().add_observer(comment_notification_observer())
    vote_service().add_observer(rating_vote_cache_invalidator())
    vote_service().add_observer(vote_notification_observer())


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
    "notification_service",
]
