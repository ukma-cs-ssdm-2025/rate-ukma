import pytest

from rating_app.models import Department
from rating_app.repositories.department_repository import DepartmentRepository
from rating_app.tests.factories import DepartmentFactory, FacultyFactory


@pytest.fixture
def repo():
    return DepartmentRepository()


# Tests for get_all


@pytest.mark.django_db
def test_get_all_returns_all_departments(repo):
    # Arrange
    DepartmentFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(dept, Department) for dept in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_departments(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_all_prefetches_related_faculty(repo, django_assert_num_queries):
    # Arrange
    DepartmentFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    with django_assert_num_queries(0):
        for dept in result:
            _ = dept.faculty.name


# Tests for get_by_id


@pytest.mark.django_db
def test_get_by_id_returns_department_by_id(repo):
    # Arrange
    department = DepartmentFactory()

    # Act
    result = repo.get_by_id(department.id)

    # Assert
    assert result.id == department.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(Department.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_by_id_prefetches_related_faculty(repo, django_assert_num_queries):
    # Arrange
    department = DepartmentFactory()

    # Act
    result = repo.get_by_id(department.id)

    # Assert
    with django_assert_num_queries(0):
        _ = result.faculty.name


# Tests for filter


@pytest.mark.django_db
def test_filter_returns_all_departments(repo):
    # Arrange
    DepartmentFactory.create_batch(3)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


# Tests for get_or_create


@pytest.mark.django_db
def test_get_or_create_creates_new_department_when_not_exists(repo):
    # Arrange
    faculty = FacultyFactory()
    name = "Computer Science"

    # Act
    department, created = repo.get_or_create(name=name, faculty=faculty)

    # Assert
    assert created is True
    assert department.name == name
    assert department.faculty == faculty


@pytest.mark.django_db
def test_get_or_create_returns_existing_department_when_exists(repo):
    # Arrange
    existing = DepartmentFactory()

    # Act
    department, created = repo.get_or_create(name=existing.name, faculty=existing.faculty)

    # Assert
    assert created is False
    assert department.id == existing.id


@pytest.mark.django_db
def test_get_or_create_creates_different_department_with_same_name_different_faculty(repo):
    # Arrange
    existing = DepartmentFactory()
    different_faculty = FacultyFactory()

    # Act
    department, created = repo.get_or_create(name=existing.name, faculty=different_faculty)

    # Assert
    assert created is True
    assert department.id != existing.id
    assert department.faculty == different_faculty


# Tests for create


@pytest.mark.django_db
def test_create_creates_department_with_provided_data(repo):
    # Arrange
    faculty = FacultyFactory()
    data = {"name": "Mathematics", "faculty": faculty}

    # Act
    result = repo.create(**data)

    # Assert
    assert result.name == "Mathematics"
    assert result.faculty == faculty
    assert Department.objects.filter(id=result.id).exists()


# Tests for update


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    department = DepartmentFactory(name="Old Name")
    new_name = "New Name"

    # Act
    repo.update(department, name=new_name)

    # Assert
    updated = Department.objects.get(id=department.id)
    assert updated.name == new_name


# Tests for delete


@pytest.mark.django_db
def test_delete_deletes_department_from_database(repo):
    # Arrange
    department = DepartmentFactory()
    dept_id = department.id

    # Act
    repo.delete(department)

    # Assert
    assert not Department.objects.filter(id=dept_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_department(repo):
    # Arrange
    keep1 = DepartmentFactory()
    to_delete = DepartmentFactory()
    keep2 = DepartmentFactory()

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(Department.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
