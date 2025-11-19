from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from rating_app.services.student_service import StudentService


@pytest.fixture
def student_stats_repo():
    return MagicMock()


@pytest.fixture
def student_repo():
    return MagicMock()


@pytest.fixture
def user_repo():
    return MagicMock()


@pytest.fixture
def service(student_stats_repo, student_repo, user_repo):
    return StudentService(
        student_stats_repository=student_stats_repo,
        student_repository=student_repo,
        user_repository=user_repo,
    )


class TestLinkStudentToUser:
    def test_returns_false_when_student_has_no_email(self, service):
        # Arrange
        student = SimpleNamespace(email="", user=None)

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False

    def test_returns_false_when_student_already_has_user(self, service):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user=MagicMock())

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False

    def test_returns_false_when_no_user_with_email(self, service, user_repo):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user=None, id="student-id")
        user_repo.get_by_email.return_value = None

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False
        user_repo.get_by_email.assert_called_once_with("test@ukma.edu.ua")

    def test_returns_false_when_user_already_linked_to_another_student(self, service, user_repo):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user=None, id="new-student")
        existing_user = SimpleNamespace(
            id=1,
            email="test@ukma.edu.ua",
            student_profile=SimpleNamespace(id="existing-student"),
        )
        user_repo.get_by_email.return_value = existing_user

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False

    def test_links_student_to_user_successfully(self, service, user_repo, student_repo):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user=None, id="student-id")
        user = SimpleNamespace(id=1, email="test@ukma.edu.ua", student_profile=None)
        user_repo.get_by_email.return_value = user

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is True
        student_repo.link_to_user.assert_called_once_with(student, user)


class TestLinkUserToStudent:
    def test_returns_false_when_user_has_no_email(self, service):
        # Arrange
        user = SimpleNamespace(email="", id=1)

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is False

    def test_returns_false_when_user_already_linked_to_student(self, service):
        # Arrange
        user = SimpleNamespace(
            email="test@ukma.edu.ua",
            id=1,
            student_profile=SimpleNamespace(id="existing-student"),
        )

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is False

    def test_returns_false_when_no_student_with_email(self, service, student_repo):
        # Arrange
        user = SimpleNamespace(email="test@ukma.edu.ua", id=1, student_profile=None)
        student_repo.get_by_email.return_value = None

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is False
        student_repo.get_by_email.assert_called_once_with("test@ukma.edu.ua")

    def test_links_user_to_student_successfully(self, service, student_repo):
        # Arrange
        user = SimpleNamespace(email="test@ukma.edu.ua", id=1, student_profile=None)
        student = SimpleNamespace(id="student-id", email="test@ukma.edu.ua", user=None)
        student_repo.get_by_email.return_value = student

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is True
        student_repo.link_to_user.assert_called_once_with(student, user)
