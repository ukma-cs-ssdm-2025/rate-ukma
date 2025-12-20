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
@pytest.mark.integration
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
    assert returned_ids == {str(course_with_instructor.id)}
    assert len(result) == 1
    assert result[0].title == course_with_instructor.title


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_semester_limits_to_matching_courses(repo):
    # Arrange
    fall_semester = SemesterFactory(term=SemesterTerm.FALL, year=2024)
    spring_semester = SemesterFactory(term=SemesterTerm.SPRING, year=2025)

    fall_course = CourseFactory(title="Autumn Course")
    CourseOfferingFactory(course=fall_course, semester=fall_semester)

    spring_course = CourseFactory(title="Spring Course")
    CourseOfferingFactory(course=spring_course, semester=spring_semester)

    # Act - Use academic year format "2024–2025" which includes Fall 2024 and Spring 2025
    result = repo.filter(
        CourseFilterCriteria(
            semester_year="2024–2025",
            semester_term=fall_semester.term,
        )
    )

    # Assert
    returned_ids = {course.id for course in result}
    assert returned_ids == {str(fall_course.id)}
    assert len(result) == 1
    assert result[0].title == "Autumn Course"


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_returns_domain_models(repo):
    # Arrange
    course = CourseFactory()
    CourseOfferingFactory(course=course)

    # Act
    result = repo.filter(CourseFilterCriteria())

    # Assert
    assert len(result) >= 1

    found_course = next((c for c in result if c.id == str(course.id)), None)
    assert found_course is not None
    assert found_course.title == course.title
    assert isinstance(found_course.specialities, list)


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_prefetches_instructors(django_assert_num_queries, repo):
    # Arrange
    semester = SemesterFactory()
    for _ in range(3):
        CourseOfferingFactory(semester=semester, instructors=[InstructorFactory()])

    # Act
    qs = repo.filter_qs(CourseFilterCriteria())

    # Assert: only the expected prefetch queries are executed (no N+1)
    # 1) base courses + prefetches
    # 2) offerings
    # 3) instructors
    # 4) specialities
    with django_assert_num_queries(4):
        for course in qs:
            for offering in course.offerings.all():
                list(offering.instructors.all())
