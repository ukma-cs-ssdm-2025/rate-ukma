from unittest.mock import MagicMock, patch

import pytest

from rating_app.models import Student
from rating_app.repositories.student_repository import StudentRepository


@pytest.fixture
def repo():
    return StudentRepository()


# Tests for get_by_email method


def test_get_by_email_returns_student_when_found(repo):
    # Arrange
    mock_student = MagicMock()
    with patch.object(Student.objects, "get", return_value=mock_student):
        # Act
        result = repo.get_by_email("test@ukma.edu.ua")

    # Assert
    assert result is mock_student


def test_get_by_email_returns_none_when_student_not_found(repo):
    # Arrange
    with patch.object(Student.objects, "get", side_effect=Student.DoesNotExist):
        # Act
        result = repo.get_by_email("notfound@ukma.edu.ua")

    # Assert
    assert result is None


def test_get_by_email_returns_none_and_logs_warning_when_multiple_students_found(repo):
    # Arrange
    with (
        patch.object(Student.objects, "get", side_effect=Student.MultipleObjectsReturned),
        patch("rating_app.repositories.student_repository.logger") as mock_logger,
    ):
        # Act
        result = repo.get_by_email("duplicate@ukma.edu.ua")

    # Assert
    assert result is None
    mock_logger.warning.assert_called_once_with(
        "multiple_students_with_same_email", email="duplicate@ukma.edu.ua"
    )


# Tests for link_to_user method


def test_link_to_user_sets_user_and_saves(repo):
    # Arrange
    mock_student = MagicMock()
    mock_user = MagicMock()

    # Act
    repo.link_to_user(mock_student, mock_user)

    # Assert
    assert mock_student.user == mock_user
    mock_student.save.assert_called_once_with(update_fields=["user"])


@pytest.mark.django_db
def test_get_all_returns_all_students(repo):
    # Arrange
    from rating_app.tests.factories import StudentFactory

    StudentFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_get_all_prefetches_related_speciality(repo, django_assert_num_queries):
    # Arrange
    from rating_app.tests.factories import StudentFactory

    StudentFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    with django_assert_num_queries(0):
        for student in result:
            _ = student.speciality.name


@pytest.mark.django_db
def test_get_by_id_returns_student_when_found(repo):
    # Arrange
    from rating_app.tests.factories import StudentFactory

    student = StudentFactory()

    # Act
    result = repo.get_by_id(student.id)

    # Assert
    assert result.id == student.id


@pytest.mark.django_db
def test_get_by_id_returns_none_and_logs_error_when_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act
    with patch("rating_app.repositories.student_repository.logger") as mock_logger:
        result = repo.get_by_id(invalid_id)

    # Assert
    assert result is None
    mock_logger.error.assert_called_once_with("student_not_found", student_id=invalid_id)


@pytest.mark.django_db
def test_get_or_create_creates_new_student_when_not_exists(repo):
    # Arrange
    from rating_app.models.choices import EducationLevel
    from rating_app.tests.factories import SpecialityFactory

    speciality = SpecialityFactory()
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "patronymic": "Smith",
        "education_level": EducationLevel.BACHELOR,
        "speciality": speciality,
        "email": "john.doe@ukma.edu.ua",
    }

    # Act
    student, created = repo.get_or_create(**data)

    # Assert
    assert created is True
    assert student.first_name == "John"
    assert student.email == "john.doe@ukma.edu.ua"


@pytest.mark.django_db
def test_get_or_create_returns_existing_student_when_fields_match(repo):
    # Arrange
    from rating_app.models.choices import EducationLevel
    from rating_app.tests.factories import SpecialityFactory, StudentFactory

    speciality = SpecialityFactory()
    existing = StudentFactory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="",
    )

    # Act
    student, created = repo.get_or_create(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="john.doe@ukma.edu.ua",
    )

    # Assert
    assert created is False
    assert student.id == existing.id


@pytest.mark.django_db
def test_get_or_create_updates_email_when_student_exists_without_email(repo):
    # Arrange
    from rating_app.models.choices import EducationLevel
    from rating_app.tests.factories import SpecialityFactory, StudentFactory

    speciality = SpecialityFactory()
    existing = StudentFactory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="",
    )

    # Act
    student, created = repo.get_or_create(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="john.doe@ukma.edu.ua",
    )

    # Assert
    assert created is False
    assert student.id == existing.id
    refreshed = Student.objects.get(id=student.id)
    assert refreshed.email == "john.doe@ukma.edu.ua"


@pytest.mark.django_db
def test_get_or_create_does_not_update_email_when_student_has_email(repo):
    # Arrange
    from rating_app.models.choices import EducationLevel
    from rating_app.tests.factories import SpecialityFactory, StudentFactory

    speciality = SpecialityFactory()
    existing = StudentFactory(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="existing@ukma.edu.ua",
    )

    # Act
    student, created = repo.get_or_create(
        first_name="John",
        last_name="Doe",
        patronymic="Smith",
        education_level=EducationLevel.BACHELOR,
        speciality=speciality,
        email="new@ukma.edu.ua",
    )

    # Assert
    assert created is False
    refreshed = Student.objects.get(id=student.id)
    assert refreshed.email == "existing@ukma.edu.ua"


@pytest.mark.django_db
def test_filter_returns_all_students(repo):
    # Arrange
    from rating_app.tests.factories import StudentFactory

    StudentFactory.create_batch(3)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_create_creates_student_with_provided_data(repo):
    # Arrange
    from rating_app.models.choices import EducationLevel
    from rating_app.tests.factories import SpecialityFactory

    speciality = SpecialityFactory()
    data = {
        "first_name": "Jane",
        "last_name": "Smith",
        "patronymic": "Marie",
        "education_level": EducationLevel.MASTER,
        "speciality": speciality,
        "email": "jane@ukma.edu.ua",
    }

    # Act
    result = repo.create(**data)

    # Assert
    assert result.first_name == "Jane"
    assert result.email == "jane@ukma.edu.ua"
    assert Student.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    from rating_app.tests.factories import StudentFactory

    student = StudentFactory(email="old@ukma.edu.ua")

    # Act
    repo.update(student, email="new@ukma.edu.ua")

    # Assert
    updated = Student.objects.get(id=student.id)
    assert updated.email == "new@ukma.edu.ua"


@pytest.mark.django_db
def test_delete_deletes_student_from_database(repo):
    # Arrange
    from rating_app.tests.factories import StudentFactory

    student = StudentFactory()
    student_id = student.id

    # Act
    repo.delete(student)

    # Assert
    assert not Student.objects.filter(id=student_id).exists()
