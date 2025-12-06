from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from django.core.management import call_command
from django.core.management.base import CommandError


@pytest.mark.django_db
@patch("scraper.management.commands.fetch_courses.with_authenticated_context")
@patch("scraper.management.commands.fetch_courses.Path")
def test_fetch_courses_success(mock_path, mock_auth_context):
    # Arrange
    mock_ids_file = MagicMock()
    mock_ids_file.exists.return_value = True
    mock_path.return_value = mock_ids_file

    mock_decorated = AsyncMock()
    mock_auth_context.return_value = lambda func: mock_decorated

    # Act
    call_command("fetch_courses", "course_ids.jsonl")

    # Assert
    mock_auth_context.assert_called_once()
    mock_decorated.assert_called_once()


@pytest.mark.django_db
@patch("scraper.management.commands.fetch_courses.Path")
def test_fetch_courses_file_not_found(mock_path):
    # Arrange
    mock_ids_file = MagicMock()
    mock_ids_file.exists.return_value = False
    mock_path.return_value = mock_ids_file

    # Act & Assert
    with pytest.raises(CommandError, match="IDs file does not exist"):
        call_command("fetch_courses", "nonexistent.jsonl")


@pytest.mark.django_db
@patch("scraper.management.commands.fetch_courses.with_authenticated_context")
@patch("scraper.management.commands.fetch_courses.Path")
def test_fetch_courses_with_concurrency(mock_path, mock_auth_context):
    # Arrange
    mock_ids_file = MagicMock()
    mock_ids_file.exists.return_value = True
    mock_path.return_value = mock_ids_file

    mock_decorated = AsyncMock()
    mock_auth_context.return_value = lambda func: mock_decorated

    # Act
    call_command("fetch_courses", "course_ids.jsonl", "--concurrency", "5")

    # Assert
    mock_auth_context.assert_called_once()
    mock_decorated.assert_called_once()


@pytest.mark.django_db
@patch("scraper.management.commands.fetch_courses.with_authenticated_context")
@patch("scraper.management.commands.fetch_courses.Path")
def test_fetch_courses_no_resume(mock_path, mock_auth_context):
    # Arrange
    mock_ids_file = MagicMock()
    mock_ids_file.exists.return_value = True
    mock_path.return_value = mock_ids_file

    mock_decorated = AsyncMock()
    mock_auth_context.return_value = lambda func: mock_decorated

    # Act
    call_command("fetch_courses", "course_ids.jsonl", "--no-resume")

    # Assert
    mock_auth_context.assert_called_once()
    mock_decorated.assert_called_once()
