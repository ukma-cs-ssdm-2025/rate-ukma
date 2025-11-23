import pytest

from rating_app.models import Faculty
from rating_app.repositories.faculty_repository import FacultyRepository
from rating_app.tests.factories import FacultyFactory, SpecialityFactory


@pytest.fixture
def repo():
    return FacultyRepository()


@pytest.mark.django_db
def test_get_all_returns_all_faculties(repo):
    # Arrange
    FacultyFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(faculty, Faculty) for faculty in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_faculties(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_by_id_returns_faculty_by_id(repo):
    # Arrange
    faculty = FacultyFactory()

    # Act
    result = repo.get_by_id(faculty.id)

    # Assert
    assert result.id == faculty.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(Faculty.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_by_speciality_name_returns_faculty_when_speciality_exists(repo):
    # Arrange
    faculty = FacultyFactory()
    speciality = SpecialityFactory(faculty=faculty)

    # Act
    result = repo.get_by_speciality_name(speciality.name)

    # Assert
    assert result.id == faculty.id


@pytest.mark.django_db
def test_get_by_speciality_name_returns_none_when_speciality_not_found(repo):
    # Arrange
    FacultyFactory.create_batch(2)

    # Act
    result = repo.get_by_speciality_name("Nonexistent Speciality")

    # Assert
    assert result is None


@pytest.mark.django_db
def test_get_by_speciality_name_returns_correct_faculty(repo):
    # Arrange
    faculty1 = FacultyFactory(name="Faculty A")
    faculty2 = FacultyFactory(name="Faculty B")
    SpecialityFactory(name="Speciality A", faculty=faculty1)
    SpecialityFactory(name="Speciality B", faculty=faculty2)

    # Act
    result = repo.get_by_speciality_name("Speciality A")

    # Assert
    assert result is not None
    assert result.id == faculty1.id


@pytest.mark.django_db
def test_filter_returns_all_faculties(repo):
    # Arrange
    FacultyFactory.create_batch(3)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_get_or_create_creates_new_faculty_when_not_exists(repo):
    # Arrange
    name = "Computer Science Faculty"

    # Act
    faculty, created = repo.get_or_create(name=name)

    # Assert
    assert created is True
    assert faculty.name == name


@pytest.mark.django_db
def test_get_or_create_returns_existing_faculty_when_exists(repo):
    # Arrange
    existing = FacultyFactory()

    # Act
    faculty, created = repo.get_or_create(name=existing.name)

    # Assert
    assert created is False
    assert faculty.id == existing.id


@pytest.mark.django_db
def test_create_creates_faculty_with_provided_data(repo):
    # Arrange
    data = {"name": "Engineering", "custom_abbreviation": "ENG"}

    # Act
    result = repo.create(**data)

    # Assert
    assert result.name == "Engineering"
    assert result.custom_abbreviation == "ENG"
    assert Faculty.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_create_creates_faculty_without_custom_abbreviation(repo):
    # Arrange
    data = {"name": "Science"}

    # Act
    result = repo.create(**data)

    # Assert
    assert result.name == "Science"
    assert result.custom_abbreviation is None


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    faculty = FacultyFactory(name="Old Name")
    new_name = "New Name"

    # Act
    repo.update(faculty, name=new_name)

    # Assert
    updated = Faculty.objects.get(id=faculty.id)
    assert updated.name == new_name


@pytest.mark.django_db
def test_delete_deletes_faculty_from_database(repo):
    # Arrange
    faculty = FacultyFactory()
    faculty_id = faculty.id

    # Act
    repo.delete(faculty)

    # Assert
    assert not Faculty.objects.filter(id=faculty_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_faculty(repo):
    # Arrange
    keep1 = FacultyFactory()
    to_delete = FacultyFactory()
    keep2 = FacultyFactory()

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(Faculty.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
