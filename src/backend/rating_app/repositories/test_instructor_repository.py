import pytest

from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.ioc_container.repositories import instructor_mapper
from rating_app.models.choices import AcademicDegree, AcademicTitle
from rating_app.repositories.instructor_repository import InstructorRepository


@pytest.fixture
def repo():
    return InstructorRepository(instructor_mapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_by_id_raises_custom_exception_when_not_found(repo):
    invalid_id = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(InstructorNotFoundError):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_handles_empty_patronymic(repo):
    data = {
        "first_name": "Jane",
        "last_name": "Smith",
        "patronymic": "",
        "academic_degree": AcademicDegree.PHD,
        "academic_title": AcademicTitle.ASSISTANT,
    }

    instructor, created = repo.get_or_create(**data)

    assert created is True
    assert instructor.patronymic == ""
