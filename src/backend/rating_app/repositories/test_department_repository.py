import uuid

import pytest

from rating_app.application_schemas.department import Department as DepartmentDTO
from rating_app.repositories.department_repository import DepartmentRepository
from rating_app.repositories.to_domain_mappers import DepartmentMapper
from rating_app.tests.factories import DepartmentFactory, FacultyFactory


@pytest.fixture
def repo():
    return DepartmentRepository(mapper=DepartmentMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_faculty(repo, django_assert_num_queries):
    DepartmentFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    assert all(isinstance(d, DepartmentDTO) for d in result)
    # faculty_name is mapped from the prefetched faculty
    assert all(d.faculty_name is not None for d in result)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_creates_different_department_with_same_name_different_faculty(repo):
    faculty_one = FacultyFactory()
    faculty_two = FacultyFactory()
    existing = DepartmentFactory(name="Engineering", faculty=faculty_one)

    department_dto = DepartmentDTO(
        id=uuid.uuid4(),
        name="Engineering",
        faculty_id=faculty_two.id,
    )

    department, created = repo.get_or_create(department_dto)

    assert created is True
    assert department.id != existing.id
    assert department.faculty_id == faculty_two.id
