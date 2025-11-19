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
