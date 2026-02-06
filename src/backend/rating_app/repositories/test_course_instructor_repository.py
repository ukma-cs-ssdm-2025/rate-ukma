import pytest

from rating_app.application_schemas.course_instructor import CourseInstructorInput
from rating_app.models.choices import InstructorRole
from rating_app.repositories.course_instructor_repository import CourseInstructorRepository
from rating_app.repositories.to_domain_mappers import CourseInstructorMapper
from rating_app.tests.factories import CourseInstructorFactory


@pytest.fixture
def repo():
    return CourseInstructorRepository(mapper=CourseInstructorMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_returns_domain_models(repo):
    CourseInstructorFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    for ci in result:
        assert hasattr(ci, "instructor_id")
        assert hasattr(ci, "course_offering_id")
        assert hasattr(ci, "role")


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_creates_different_instructor_with_different_role(repo):
    existing = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)

    ci_input = CourseInstructorInput(
        instructor_id=existing.instructor_id,
        course_offering_id=existing.course_offering_id,
        role=InstructorRole.PRACTICUM_INSTRUCTOR,
    )
    course_instructor, created = repo.get_or_create(ci_input)

    assert created is True
    assert course_instructor.id != existing.id
    assert course_instructor.role == InstructorRole.PRACTICUM_INSTRUCTOR
