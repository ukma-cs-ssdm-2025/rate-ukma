from pathlib import Path
from unittest.mock import MagicMock

import pytest

from scraper.models import ParsedCourseDetails
from scraper.services.deduplication.base import DataValidationError
from scraper.services.deduplication.deduplication_service import (
    CourseDeduplicatorService,
)
from scraper.services.deduplication.extractors import SemesterExtractor


def test_deduplicate_courses_integration(course_deduplicator, temp_input_file, mock_jsonl_writer):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value = mock_writer

    output_path = Path("/tmp/output.jsonl")

    # Act
    course_deduplicator.deduplicate_courses(temp_input_file, output_path)

    # Assert
    mock_jsonl_writer.assert_called_once_with(output_path)
    assert mock_writer.write.call_count == 2


def test_semester_extractor_missing_academic_year():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "",
        "semesters": ["осінній"],
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }

    course = ParsedCourseDetails(**course_data)

    # Act
    # Assert
    with pytest.raises(DataValidationError, match="Course 550001 missing required academic_year"):
        extractor.extract(course)


def test_semester_extractor_missing_semesters():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": [],
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }

    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


def test_semester_extractor_invalid_year():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "invalid-year",
        "semesters": ["осінній"],
    }

    course = ParsedCourseDetails(**course_data)

    # Act
    # Assert
    with pytest.raises(DataValidationError, match="Cannot extract year from academic year"):
        extractor.extract(course)


def test_semester_extractor_year_out_of_range():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "1999–2000",
        "semesters": ["осінній"],
    }

    course = ParsedCourseDetails(**course_data)

    # Act
    # Assert
    with pytest.raises(DataValidationError, match="Year 1999 is outside valid range"):
        extractor.extract(course)


def test_semester_extractor_raises_error_when_academic_year_is_empty():
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "",
        "semesters": ["осінній"],
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }

    course = ParsedCourseDetails(**course_data)

    extractor = SemesterExtractor()

    with pytest.raises(DataValidationError, match="Course 550001 missing required academic_year"):
        extractor.extract(course)


def test_course_deduplicator_handles_file_not_found():
    # Arrange
    deduplicator = CourseDeduplicatorService()
    non_existent_file = Path("/non/existent/file.jsonl")
    output_path = Path("/tmp/output.jsonl")

    # Act
    # Assert
    with pytest.raises(FileNotFoundError):
        deduplicator.deduplicate_courses(non_existent_file, output_path)


def test_course_deduplicator_handles_invalid_json(
    course_deduplicator, temp_invalid_json_file, mock_jsonl_writer
):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value = mock_writer

    output_path = Path("/tmp/output.jsonl")

    # Act
    # Assert
    with pytest.raises(DataValidationError):
        course_deduplicator.deduplicate_courses(temp_invalid_json_file, output_path)

        temp_invalid_json_file.unlink()


def test_course_deduplicator_handles_missing_id(
    course_deduplicator, temp_missing_id_file, mock_jsonl_writer
):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value = mock_writer

    output_path = Path("/tmp/output.jsonl")

    # Act
    # Assert
    with pytest.raises(DataValidationError):
        course_deduplicator.deduplicate_courses(temp_missing_id_file, output_path)

        temp_missing_id_file.unlink()


def test_course_deduplicator_with_duplicates(
    course_deduplicator, temp_input_file_with_duplicates, mock_jsonl_writer
):
    # Arrange
    mock_writer = MagicMock()
    mock_jsonl_writer.return_value = mock_writer

    output_path = Path("/tmp/output.jsonl")

    # Act
    course_deduplicator.deduplicate_courses(temp_input_file_with_duplicates, output_path)

    # Assert
    mock_jsonl_writer.assert_called_once_with(output_path)
    assert mock_writer.write.call_count == 1
