import pytest

from rating_app.repositories.department_repository import DepartmentRepository
from rating_app.tests.factories import DepartmentFactory, FacultyFactory


@pytest.fixture
def repo():
    return DepartmentRepository()


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_faculty(repo, django_assert_num_queries):
    DepartmentFactory.create_batch(3)

    result = repo.get_all()

    with django_assert_num_queries(0):
        for department in result:
            _ = department.faculty.name


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_create_creates_different_department_with_same_name_different_faculty(repo):
    faculty_one = FacultyFactory()
    faculty_two = FacultyFactory()
    existing = DepartmentFactory(name="Engineering", faculty=faculty_one)

    department, created = repo.get_or_create(name="Engineering", faculty=faculty_two)

    assert created is True
    assert department.id != existing.id
    assert department.faculty == faculty_two
