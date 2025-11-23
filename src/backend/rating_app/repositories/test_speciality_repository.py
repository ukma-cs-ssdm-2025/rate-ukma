import pytest

from rating_app.models import Speciality
from rating_app.repositories.speciality_repository import SpecialityRepository
from rating_app.tests.factories import FacultyFactory, SpecialityFactory


@pytest.fixture
def repo():
    return SpecialityRepository()


@pytest.mark.django_db
def test_get_all_returns_all_specialities(repo):
    # Arrange
    SpecialityFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(speciality, Speciality) for speciality in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_specialities(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_all_prefetches_related_faculty(repo, django_assert_num_queries):
    # Arrange
    SpecialityFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    with django_assert_num_queries(0):
        for speciality in result:
            _ = speciality.faculty.name


@pytest.mark.django_db
def test_get_by_id_returns_speciality_by_id(repo):
    # Arrange
    speciality = SpecialityFactory()

    # Act
    result = repo.get_by_id(speciality.id)

    # Assert
    assert result.id == speciality.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(Speciality.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_by_id_prefetches_related_faculty(repo, django_assert_num_queries):
    # Arrange
    speciality = SpecialityFactory()

    # Act
    result = repo.get_by_id(speciality.id)

    # Assert
    with django_assert_num_queries(0):
        _ = result.faculty.name


@pytest.mark.django_db
def test_get_by_name_returns_speciality_when_exists(repo):
    # Arrange
    speciality = SpecialityFactory(name="Computer Science")

    # Act
    result = repo.get_by_name("Computer Science")

    # Assert
    assert result.id == speciality.id


@pytest.mark.django_db
def test_get_by_name_returns_none_when_not_found(repo):
    # Arrange
    SpecialityFactory(name="Mathematics")

    # Act
    result = repo.get_by_name("Physics")

    # Assert
    assert result is None


@pytest.mark.django_db
def test_get_by_name_prefetches_related_faculty(repo, django_assert_num_queries):
    # Arrange
    speciality = SpecialityFactory(name="Computer Science")

    # Act
    result = repo.get_by_name("Computer Science")

    # Assert
    with django_assert_num_queries(0):
        _ = result.faculty.name


@pytest.mark.django_db
def test_filter_returns_all_specialities(repo):
    # Arrange
    SpecialityFactory.create_batch(3)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_get_or_create_creates_new_speciality_when_not_exists(repo):
    # Arrange
    faculty = FacultyFactory()
    name = "Software Engineering"

    # Act
    speciality, created = repo.get_or_create(name=name, faculty=faculty)

    # Assert
    assert created is True
    assert speciality.name == name
    assert speciality.faculty == faculty


@pytest.mark.django_db
def test_get_or_create_returns_existing_speciality_when_exists(repo):
    # Arrange
    existing = SpecialityFactory()

    # Act
    speciality, created = repo.get_or_create(name=existing.name, faculty=existing.faculty)

    # Assert
    assert created is False
    assert speciality.id == existing.id


@pytest.mark.django_db
def test_create_creates_speciality_with_provided_data(repo):
    # Arrange
    faculty = FacultyFactory()
    data = {"name": "Data Science", "faculty": faculty}

    # Act
    result = repo.create(**data)

    # Assert
    assert result.name == "Data Science"
    assert result.faculty == faculty
    assert Speciality.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    speciality = SpecialityFactory(name="Old Name")
    new_name = "New Name"

    # Act
    repo.update(speciality, name=new_name)

    # Assert
    updated = Speciality.objects.get(id=speciality.id)
    assert updated.name == new_name


@pytest.mark.django_db
def test_delete_deletes_speciality_from_database(repo):
    # Arrange
    speciality = SpecialityFactory()
    speciality_id = speciality.id

    # Act
    repo.delete(speciality)

    # Assert
    assert not Speciality.objects.filter(id=speciality_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_speciality(repo):
    # Arrange
    keep1 = SpecialityFactory()
    to_delete = SpecialityFactory()
    keep2 = SpecialityFactory()

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(Speciality.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
