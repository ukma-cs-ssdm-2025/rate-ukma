from rateukma.ioc.decorators import once
from rating_app.models import Course
from rating_app.pagination import GenericQuerysetPaginator
from rating_app.queries.rating_popularity import WilsonPopularityAnnotator

from ..repositories import (
    CourseInstructorRepository,
    CourseMapper,
    CourseOfferingRepository,
    CourseRepository,
    DepartmentRepository,
    EnrollmentRepository,
    FacultyRepository,
    InstructorRepository,
    RatingMapper,
    RatingRepository,
    RatingVoteMapper,
    RatingVoteRepository,
    SemesterRepository,
    SpecialityRepository,
    StudentRepository,
    StudentStatisticsRepository,
    UserRepository,
)


@once
def course_mapper() -> CourseMapper:
    return CourseMapper()


@once
def rating_mapper() -> RatingMapper:
    return RatingMapper()


@once
def rating_vote_mapper() -> RatingVoteMapper:
    return RatingVoteMapper()


@once
def course_repository() -> CourseRepository:
    paginator = GenericQuerysetPaginator[Course]()
    return CourseRepository(mapper=course_mapper(), paginator=paginator)


@once
def department_repository() -> DepartmentRepository:
    return DepartmentRepository()


@once
def faculty_repository() -> FacultyRepository:
    return FacultyRepository()


@once
def semester_repository() -> SemesterRepository:
    return SemesterRepository()


@once
def speciality_repository() -> SpecialityRepository:
    return SpecialityRepository()


@once
def instructor_repository() -> InstructorRepository:
    return InstructorRepository()


@once
def student_repository() -> StudentRepository:
    return StudentRepository()


@once
def course_offering_repository() -> CourseOfferingRepository:
    return CourseOfferingRepository()


@once
def course_instructor_repository() -> CourseInstructorRepository:
    return CourseInstructorRepository()


@once
def enrollment_repository() -> EnrollmentRepository:
    return EnrollmentRepository()


@once
def rating_repository() -> RatingRepository:
    return RatingRepository(
        mapper=rating_mapper(),
        paginator=GenericQuerysetPaginator(),
        popularity_annotator=WilsonPopularityAnnotator(),
    )


@once
def student_stats_repository() -> StudentStatisticsRepository:
    return StudentStatisticsRepository()


@once
def user_repository() -> UserRepository:
    return UserRepository()


@once
def vote_repository() -> RatingVoteRepository:
    return RatingVoteRepository(vote_mapper=rating_vote_mapper())
