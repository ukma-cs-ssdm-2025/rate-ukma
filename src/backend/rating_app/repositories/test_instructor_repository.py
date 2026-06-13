from uuid import uuid4

import pytest

from rating_app.application_schemas.instructor import Instructor as InstructorDTO
from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.ioc_container.repositories import instructor_mapper
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
    data = InstructorDTO(
        id=uuid4(),
        first_name="Jane",
        last_name="Smith",
        patronymic="",
        email="jane.smith@ukma.edu.ua",
    )

    instructor, created = repo.get_or_create(data)

    assert created is True
    assert instructor.patronymic == ""
    assert instructor.email == "jane.smith@ukma.edu.ua"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_with_return_model_returns_orm_model(repo):
    data = InstructorDTO(
        id=uuid4(),
        first_name="John",
        last_name="Doe",
        patronymic="Michael",
        email="john.doe@ukma.edu.ua",
    )

    instructor, created = repo.get_or_create(data, return_model=True)

    assert created is True
    # Verify it's an ORM model (has save method)
    assert hasattr(instructor, "save")


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_is_idempotent_on_email(repo):
    data = InstructorDTO(
        id=uuid4(),
        first_name="Alex",
        last_name="Kovalenko",
        patronymic="",
        email="a.kovalenko@ukma.edu.ua",
    )

    first, created_first = repo.get_or_create(data)
    second, created_second = repo.get_or_create(data)

    assert created_first is True
    assert created_second is False
    assert first.id == second.id
