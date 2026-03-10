from pathlib import Path

import pytest

from scraper.models import ParsedCourseDetails
from scraper.services.deduplication.base import DataValidationError
from scraper.services.deduplication.loader import CourseLoader


def test_load_courses_success(course_loader, temp_input_file):
    # Arrange
    expected_count = 2

    # Act
    result = course_loader.process(temp_input_file)

    # Assert
    assert isinstance(result, list)
    assert len(result) == expected_count
    assert all(isinstance(course, ParsedCourseDetails) for course in result)


def test_load_courses_file_not_found(course_loader):
    # Arrange
    non_existent_file = Path("/non/existent/file.jsonl")

    # Act & Assert
    with pytest.raises(FileNotFoundError):
        course_loader.process(non_existent_file)


def test_load_courses_invalid_json(course_loader, temp_invalid_json_file):
    # Act & Assert
    with pytest.raises(DataValidationError):
        course_loader.process(temp_invalid_json_file)

    # Cleanup
    temp_invalid_json_file.unlink()


def test_course_loader_validation_error_missing_id(course_loader, temp_missing_id_file):
    # Act & Assert
    with pytest.raises(DataValidationError):
        course_loader.process(temp_missing_id_file)

    # Cleanup
    temp_missing_id_file.unlink()


def test_course_loader_returns_parsed_courses(course_loader, temp_input_file):
    # Act
    result = course_loader.process(temp_input_file)

    # Assert
    assert len(result) == 2
    assert all(isinstance(course, ParsedCourseDetails) for course in result)
    assert result[0].title == "Веб-розробка: основи та практики"
    assert result[1].title == "Структури даних та алгоритми"


def test_course_loader_skips_invalid_courses_when_enabled(
    temp_input_file,
    temp_missing_title_file,
    tmp_path,
):
    combined_file = tmp_path / "combined.jsonl"
    combined_file.write_text(
        temp_input_file.read_text(encoding="utf-8")
        + temp_missing_title_file.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    tolerant_loader = CourseLoader(skip_invalid_courses=True)

    result = tolerant_loader.process(combined_file)

    assert len(result) == 2
    assert all(isinstance(course, ParsedCourseDetails) for course in result)
