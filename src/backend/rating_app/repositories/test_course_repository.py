import pytest

from rating_app.application_schemas.course import CourseFilterCriteria
from rating_app.models.choices import SemesterTerm
from rating_app.repositories.course_repository import CourseRepository
from rating_app.tests.factories import (
    CourseFactory,
    CourseInstructorFactory,
    CourseOfferingFactory,
    InstructorFactory,
    SemesterFactory,
)


@pytest.fixture
def repo():
    return CourseRepository()


@pytest.mark.django_db
def test_filter_by_instructor_returns_only_assigned_courses(repo):
    # Arrange
    instructor = InstructorFactory()
    course_with_instructor = CourseFactory()
    offering_with_instructor = CourseOfferingFactory(course=course_with_instructor)
    CourseInstructorFactory(course_offering=offering_with_instructor, instructor=instructor)

    # Act
    course_without_instructor = CourseFactory()
    CourseOfferingFactory(course=course_without_instructor)
    filters = CourseFilterCriteria(instructor=instructor.id)
    result = repo.filter(filters)

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {course_with_instructor.id}


@pytest.mark.django_db
def test_filter_by_semester_limits_to_matching_courses(repo):
    # Arrange
    fall_semester = SemesterFactory(term=SemesterTerm.FALL, year=2024)
    spring_semester = SemesterFactory(term=SemesterTerm.SPRING, year=2025)

    fall_course = CourseFactory(title="Autumn Course")
    CourseOfferingFactory(course=fall_course, semester=fall_semester)

    spring_course = CourseFactory(title="Spring Course")
    CourseOfferingFactory(course=spring_course, semester=spring_semester)

    # Act
    result = repo.filter(
        CourseFilterCriteria(
            semester_year=fall_semester.year,
            semester_term=fall_semester.term,
        )
    )

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {fall_course.id}


@pytest.mark.django_db
def test_filter_prefetches_instructors(django_assert_num_queries, repo):
    # Arrange
    semester = SemesterFactory()
    for _ in range(3):
        CourseOfferingFactory(semester=semester, instructors=[InstructorFactory()])

    # Act
    result = repo.filter(CourseFilterCriteria())

    # Assert
    courses = list(result)
    with django_assert_num_queries(0):
        for course in courses:
            for offering in course.offerings.all():
                list(offering.instructors.all())
