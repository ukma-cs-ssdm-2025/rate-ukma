from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from django.core.management import call_command
from django.core.management.base import CommandError


@pytest.mark.django_db
class TestFetchCoursesCommand:
    """Unit tests for fetch_courses management command."""

    @patch("scraper.management.commands.fetch_courses.with_authenticated_context")
    @patch("scraper.management.commands.fetch_courses.Path")
    def test_fetch_courses_success(self, mock_path, mock_auth_context):
        """Test fetch_courses command with valid input file."""
        mock_ids_file = MagicMock()
        mock_ids_file.exists.return_value = True
        mock_path.return_value = mock_ids_file

        mock_decorated = AsyncMock()
        mock_auth_context.return_value = lambda func: mock_decorated

        call_command("fetch_courses", "course_ids.jsonl")

        mock_auth_context.assert_called_once()
        mock_decorated.assert_called_once()

    @patch("scraper.management.commands.fetch_courses.Path")
    def test_fetch_courses_file_not_found(self, mock_path):
        """Test fetch_courses command fails when input file doesn't exist."""
        mock_ids_file = MagicMock()
        mock_ids_file.exists.return_value = False
        mock_path.return_value = mock_ids_file

        with pytest.raises(CommandError, match="IDs file does not exist"):
            call_command("fetch_courses", "nonexistent.jsonl")

    @patch("scraper.management.commands.fetch_courses.with_authenticated_context")
    @patch("scraper.management.commands.fetch_courses.Path")
    def test_fetch_courses_with_concurrency(self, mock_path, mock_auth_context):
        """Test fetch_courses command with custom concurrency."""
        mock_ids_file = MagicMock()
        mock_ids_file.exists.return_value = True
        mock_path.return_value = mock_ids_file

        mock_decorated = AsyncMock()
        mock_auth_context.return_value = lambda func: mock_decorated

        call_command("fetch_courses", "course_ids.jsonl", "--concurrency", "5")

        mock_auth_context.assert_called_once()
        mock_decorated.assert_called_once()

    @patch("scraper.management.commands.fetch_courses.with_authenticated_context")
    @patch("scraper.management.commands.fetch_courses.Path")
    def test_fetch_courses_no_resume(self, mock_path, mock_auth_context):
        """Test fetch_courses command with no-resume flag."""
        mock_ids_file = MagicMock()
        mock_ids_file.exists.return_value = True
        mock_path.return_value = mock_ids_file

        mock_decorated = AsyncMock()
        mock_auth_context.return_value = lambda func: mock_decorated

        call_command("fetch_courses", "course_ids.jsonl", "--no-resume")

        mock_auth_context.assert_called_once()
        mock_decorated.assert_called_once()
