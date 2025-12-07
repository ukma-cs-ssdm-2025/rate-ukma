import pytest

from rating_app.models.choices import InstructorRole
from rating_app.repositories.course_instructor_repository import CourseInstructorRepository
from rating_app.tests.factories import CourseInstructorFactory


@pytest.fixture
def repo():
    return CourseInstructorRepository()


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_instructor_and_course_offering(repo, django_assert_num_queries):
    CourseInstructorFactory.create_batch(3)

    result = repo.get_all()

    with django_assert_num_queries(0):
        for course_instructor in result:
            _ = course_instructor.instructor.first_name
            _ = course_instructor.course_offering.code


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_creates_different_instructor_with_different_role(repo):
    existing = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)

    course_instructor, created = repo.get_or_create(
        instructor=existing.instructor,
        course_offering=existing.course_offering,
        role=InstructorRole.PRACTICUM_INSTRUCTOR,
    )

    assert created is True
    assert course_instructor.id != existing.id
    assert course_instructor.role == InstructorRole.PRACTICUM_INSTRUCTOR
