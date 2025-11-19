from unittest.mock import MagicMock, patch

import pytest

from rating_app.repositories.user_repository import UserRepository


@pytest.fixture
def repo():
    return UserRepository()


# Tests for get_by_email method


def test_get_by_email_returns_user_when_found(repo):
    # Arrange
    mock_user = MagicMock()
    with patch.object(repo._user_model.objects, "get", return_value=mock_user):
        # Act
        result = repo.get_by_email("test@ukma.edu.ua")

    # Assert
    assert result is mock_user


def test_get_by_email_returns_none_when_user_not_found(repo):
    # Arrange
    with patch.object(
        repo._user_model.objects,
        "get",
        side_effect=repo._user_model.DoesNotExist,
    ):
        # Act
        result = repo.get_by_email("notfound@ukma.edu.ua")

    # Assert
    assert result is None


def test_get_by_email_returns_none_and_logs_warning_when_multiple_users_found(repo):
    # Arrange
    with (
        patch.object(
            repo._user_model.objects,
            "get",
            side_effect=repo._user_model.MultipleObjectsReturned,
        ),
        patch("rating_app.repositories.user_repository.logger") as mock_logger,
    ):
        # Act
        result = repo.get_by_email("duplicate@ukma.edu.ua")

    # Assert
    assert result is None
    mock_logger.warning.assert_called_once_with(
        "multiple_users_with_same_email", email="duplicate@ukma.edu.ua"
    )
