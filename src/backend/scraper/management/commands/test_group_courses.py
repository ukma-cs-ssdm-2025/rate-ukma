from pathlib import Path
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError

import pytest


@pytest.mark.django_db
class TestGroupCoursesCommand:
    """Unit tests for group_courses management command."""

    @patch("scraper.management.commands.group_courses.CourseGroupingService")
    @patch("scraper.management.commands.group_courses.Path")
    def test_group_courses_success(self, mock_path, mock_grouping_service):
        """Test group_courses command with valid input file."""
        mock_input_file = MagicMock()
        mock_input_file.exists.return_value = True
        mock_input_file.resolve.return_value = Path("/input/courses.jsonl")

        mock_output_file = MagicMock()
        mock_output_file.exists.return_value = False
        mock_output_file.resolve.return_value = Path("/output/grouped_courses.jsonl")
        mock_output_file.parent = MagicMock()

        call_count = [0]

        def path_side_effect(arg):
            call_count[0] += 1
            if call_count[0] == 1:
                return mock_input_file
            return mock_output_file

        mock_path.side_effect = path_side_effect

        mock_grouper = MagicMock()
        mock_grouping_service.return_value = mock_grouper

        call_command("group_courses", "courses.jsonl")

        mock_grouper.group_courses.assert_called_once()

    @patch("scraper.management.commands.group_courses.Path")
    def test_group_courses_input_not_found(self, mock_path):
        """Test group_courses command fails when input file doesn't exist."""
        mock_input_file = MagicMock()
        mock_input_file.exists.return_value = False

        mock_path.return_value = mock_input_file

        with pytest.raises(CommandError, match="Input file does not exist"):
            call_command("group_courses", "nonexistent.jsonl")

    @patch("scraper.management.commands.group_courses.Path")
    def test_group_courses_same_input_output(self, mock_path):
        """Test group_courses command fails when input and output are the same."""
        mock_file = MagicMock()
        mock_file.exists.return_value = True
        mock_file.resolve.return_value = Path("/same/file.jsonl")

        mock_path.return_value = mock_file

        with pytest.raises(CommandError, match="Input and output paths must differ"):
            call_command("group_courses", "file.jsonl", "--out", "file.jsonl")

    @patch("scraper.management.commands.group_courses.CourseGroupingService")
    @patch("scraper.management.commands.group_courses.Path")
    def test_group_courses_force_overwrite(self, mock_path, mock_grouping_service):
        """Test group_courses command with force flag to overwrite existing output."""
        mock_input_file = MagicMock()
        mock_input_file.exists.return_value = True
        mock_input_file.resolve.return_value = Path("/input/courses.jsonl")

        mock_output_file = MagicMock()
        mock_output_file.exists.return_value = True
        mock_output_file.resolve.return_value = Path("/output/grouped_courses.jsonl")
        mock_output_file.parent = MagicMock()

        call_count = [0]

        def path_side_effect(arg):
            call_count[0] += 1
            if call_count[0] == 1:
                return mock_input_file
            return mock_output_file

        mock_path.side_effect = path_side_effect

        mock_grouper = MagicMock()
        mock_grouping_service.return_value = mock_grouper

        call_command("group_courses", "courses.jsonl", "--force")

        mock_output_file.unlink.assert_called_once()
        mock_grouper.group_courses.assert_called_once()

    @patch("scraper.management.commands.group_courses.Path")
    def test_group_courses_output_exists_no_force(self, mock_path):
        """Test group_courses command fails when output exists without force flag."""
        mock_input_file = MagicMock()
        mock_input_file.exists.return_value = True
        mock_input_file.resolve.return_value = Path("/input/courses.jsonl")

        mock_output_file = MagicMock()
        mock_output_file.exists.return_value = True
        mock_output_file.resolve.return_value = Path("/output/grouped_courses.jsonl")

        call_count = [0]

        def path_side_effect(arg):
            call_count[0] += 1
            if call_count[0] == 1:
                return mock_input_file
            return mock_output_file

        mock_path.side_effect = path_side_effect

        with pytest.raises(CommandError, match="Output file already exists"):
            call_command("group_courses", "courses.jsonl")
