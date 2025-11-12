from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock

import pytest

from scraper.services.deduplication.base import DataValidationError
from scraper.services.deduplication.grouping_service import (
    CourseGroupingService,
)


def test_group_courses_integration(course_grouper_service, temp_input_file, mock_jsonl_writer):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value.__enter__.return_value = mock_writer

    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "output.jsonl"

        # Act
        course_grouper_service.group_courses(temp_input_file, output_path)

        # Assert
        mock_jsonl_writer.assert_called_once_with(output_path)
        assert mock_writer.write.call_count == 2


def test_course_grouper_handles_file_not_found():
    # Arrange
    grouper = CourseGroupingService()
    non_existent_file = Path("/non/existent/file.jsonl")

    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "output.jsonl"

        # Act & Assert
        with pytest.raises(FileNotFoundError):
            grouper.group_courses(non_existent_file, output_path)


def test_course_grouper_handles_invalid_json(
    course_grouper_service, temp_invalid_json_file, mock_jsonl_writer
):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value.__enter__.return_value = mock_writer

    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "output.jsonl"

        # Act & Assert
        with pytest.raises(DataValidationError):
            course_grouper_service.group_courses(temp_invalid_json_file, output_path)

        temp_invalid_json_file.unlink()


def test_course_grouper_handles_missing_id(
    course_grouper_service, temp_missing_id_file, mock_jsonl_writer
):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value.__enter__.return_value = mock_writer

    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "output.jsonl"

        # Act & Assert
        with pytest.raises(DataValidationError):
            course_grouper_service.group_courses(temp_missing_id_file, output_path)

        temp_missing_id_file.unlink()


def test_course_grouper_with_duplicates(
    course_grouper_service, temp_input_file_with_duplicates, mock_jsonl_writer
):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value.__enter__.return_value = mock_writer

    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "output.jsonl"

        # Act
        course_grouper_service.group_courses(temp_input_file_with_duplicates, output_path)

        # Assert
        mock_jsonl_writer.assert_called_once_with(output_path)
        assert mock_writer.write.call_count == 1
