import pytest

from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.models import Instructor
from rating_app.models.choices import AcademicDegree, AcademicTitle
from rating_app.repositories.instructor_repository import InstructorRepository
from rating_app.tests.factories import InstructorFactory


@pytest.fixture
def repo():
    return InstructorRepository()


@pytest.mark.django_db
def test_get_all_returns_all_instructors(repo):
    # Arrange
    InstructorFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(instructor, Instructor) for instructor in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_instructors(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_by_id_returns_instructor_by_id(repo):
    # Arrange
    instructor = InstructorFactory()

    # Act
    result = repo.get_by_id(instructor.id)

    # Assert
    assert result.id == instructor.id


@pytest.mark.django_db
def test_get_by_id_raises_custom_exception_when_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(InstructorNotFoundError):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_or_create_creates_new_instructor_when_not_exists(repo):
    # Arrange
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "patronymic": "Smith",
        "academic_degree": AcademicDegree.PHD,
        "academic_title": AcademicTitle.PROFESSOR,
    }

    # Act
    instructor, created = repo.get_or_create(**data)

    # Assert
    assert created is True
    assert instructor.first_name == "John"
    assert instructor.last_name == "Doe"
    assert instructor.patronymic == "Smith"
    assert instructor.academic_degree == AcademicDegree.PHD
    assert instructor.academic_title == AcademicTitle.PROFESSOR


@pytest.mark.django_db
def test_get_or_create_returns_existing_instructor_when_all_fields_match(repo):
    # Arrange
    existing = InstructorFactory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        academic_degree=AcademicDegree.PHD,
        academic_title=AcademicTitle.PROFESSOR,
    )

    # Act
    instructor, created = repo.get_or_create(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        academic_degree=AcademicDegree.PHD,
        academic_title=AcademicTitle.PROFESSOR,
    )

    # Assert
    assert created is False
    assert instructor.id == existing.id


@pytest.mark.django_db
def test_get_or_create_handles_empty_patronymic(repo):
    # Arrange
    data = {
        "first_name": "Jane",
        "last_name": "Smith",
        "patronymic": "",
        "academic_degree": AcademicDegree.PHD,
        "academic_title": AcademicTitle.ASSISTANT,
    }

    # Act
    instructor, created = repo.get_or_create(**data)

    # Assert
    assert created is True
    assert instructor.patronymic == ""


@pytest.mark.django_db
def test_filter_returns_all_instructors(repo):
    # Arrange
    InstructorFactory.create_batch(3)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_create_creates_instructor_with_provided_data(repo):
    # Arrange
    data = {
        "first_name": "Alice",
        "last_name": "Johnson",
        "patronymic": "Marie",
        "academic_degree": AcademicDegree.PHD,
        "academic_title": AcademicTitle.ASSOCIATE_PROF,
    }

    # Act
    result = repo.create(**data)

    # Assert
    assert result.first_name == "Alice"
    assert result.last_name == "Johnson"
    assert Instructor.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    instructor = InstructorFactory(academic_title=AcademicTitle.ASSISTANT)

    # Act
    repo.update(instructor, academic_title=AcademicTitle.PROFESSOR)

    # Assert
    updated = Instructor.objects.get(id=instructor.id)
    assert updated.academic_title == AcademicTitle.PROFESSOR


@pytest.mark.django_db
def test_delete_deletes_instructor_from_database(repo):
    # Arrange
    instructor = InstructorFactory()
    instructor_id = instructor.id

    # Act
    repo.delete(instructor)

    # Assert
    assert not Instructor.objects.filter(id=instructor_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_instructor(repo):
    # Arrange
    keep1 = InstructorFactory()
    to_delete = InstructorFactory()
    keep2 = InstructorFactory()

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(Instructor.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
