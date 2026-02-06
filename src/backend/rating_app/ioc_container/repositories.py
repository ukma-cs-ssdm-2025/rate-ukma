from rateukma.ioc.decorators import once
from rating_app.models import Course
from rating_app.pagination import GenericQuerysetPaginator
from rating_app.queries.rating_popularity import WilsonPopularityAnnotator
from rating_app.repositories.to_domain_mappers import (
    CourseInstructorMapper,
    CourseOfferingMapper,
    DepartmentMapper,
    EnrollmentMapper,
    FacultyMapper,
    InstructorMapper,
    RatingVoteModelMapper,
    SemesterMapper,
    SpecialityMapper,
    StudentMapper,
)

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
def instructor_mapper() -> InstructorMapper:
    return InstructorMapper()


@once
def course_offering_mapper() -> CourseOfferingMapper:
    return CourseOfferingMapper(instructor_mapper())


@once
def student_mapper() -> StudentMapper:
    return StudentMapper()


@once
def department_mapper() -> DepartmentMapper:
    return DepartmentMapper()


@once
def semester_mapper() -> SemesterMapper:
    return SemesterMapper()


@once
def speciality_mapper() -> SpecialityMapper:
    return SpecialityMapper()


@once
def faculty_mapper() -> FacultyMapper:
    return FacultyMapper()


@once
def rating_vote_model_mapper() -> RatingVoteModelMapper:
    return RatingVoteModelMapper()


@once
def course_instructor_mapper() -> CourseInstructorMapper:
    return CourseInstructorMapper()


@once
def enrollment_mapper() -> EnrollmentMapper:
    return EnrollmentMapper()


@once
def course_repository() -> CourseRepository:
    paginator = GenericQuerysetPaginator[Course]()
    return CourseRepository(mapper=course_mapper(), paginator=paginator)


@once
def department_repository() -> DepartmentRepository:
    return DepartmentRepository(mapper=department_mapper())


@once
def faculty_repository() -> FacultyRepository:
    return FacultyRepository(mapper=faculty_mapper())


@once
def semester_repository() -> SemesterRepository:
    return SemesterRepository(mapper=semester_mapper())


@once
def speciality_repository() -> SpecialityRepository:
    return SpecialityRepository(mapper=speciality_mapper())


@once
def instructor_repository() -> InstructorRepository:
    return InstructorRepository(mapper=instructor_mapper())


@once
def student_repository() -> StudentRepository:
    return StudentRepository(mapper=student_mapper())


@once
def course_offering_repository() -> CourseOfferingRepository:
    return CourseOfferingRepository(mapper=course_offering_mapper())


@once
def course_instructor_repository() -> CourseInstructorRepository:
    return CourseInstructorRepository(mapper=course_instructor_mapper())


@once
def enrollment_repository() -> EnrollmentRepository:
    return EnrollmentRepository(mapper=enrollment_mapper())


@once
def rating_repository() -> RatingRepository:
    return RatingRepository(
        mapper=rating_mapper(),
        paginator=GenericQuerysetPaginator(),
        popularity_annotator=WilsonPopularityAnnotator(),
    )


@once
def student_stats_repository() -> StudentStatisticsRepository:
    return StudentStatisticsRepository(mapper=student_mapper())


@once
def user_repository() -> UserRepository:
    return UserRepository()


@once
def vote_repository() -> RatingVoteRepository:
    return RatingVoteRepository(
        vote_mapper=rating_vote_mapper(),
        model_mapper=rating_vote_model_mapper(),
    )
