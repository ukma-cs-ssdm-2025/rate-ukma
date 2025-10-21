from pathlib import Path

import pytest

from scraper.models.deduplicated import CourseStatus, DeduplicatedCourse

from .file_reader import CourseFileReader


@pytest.fixture
def file_reader() -> CourseFileReader:
    return CourseFileReader()


@pytest.fixture
def valid_course_data() -> DeduplicatedCourse:
    return DeduplicatedCourse(
        title="Math",
        department="Science",
        faculty="STEM",
        status=CourseStatus.ACTIVE,
    )


def test_provide_raises_if_file_not_exists(file_reader: CourseFileReader, tmp_path: Path):
    # Arrange
    fake_file = tmp_path / "inexistent.jsonl"

    # Act & Assert
    with pytest.raises(FileNotFoundError):
        list(file_reader.provide(fake_file))


def test_reads_valid_json_line(
    file_reader: CourseFileReader, tmp_path: Path, valid_course_data: DeduplicatedCourse
):
    # Arrange
    file = tmp_path / "courses.jsonl"
    file.write_text(valid_course_data.model_dump_json() + "\n")

    # Act
    courses = file_reader.provide(file)

    # Assert
    assert len(courses) == 1
    assert isinstance(courses[0], DeduplicatedCourse)
    assert courses[0] == valid_course_data


def test_skips_invalid_json(
    file_reader: CourseFileReader,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
    valid_course_data: DeduplicatedCourse,
):
    # Arrange
    file = tmp_path / "courses.jsonl"
    file.write_text(valid_course_data.model_dump_json() + "\n" + "Invalid JSON line\n")

    # Act
    courses = file_reader.provide(file)

    # Assert
    assert len(courses) == 1
    assert "json_decode_error" in caplog.text


def test_batches_by_size(
    file_reader: CourseFileReader, tmp_path: Path, valid_course_data: DeduplicatedCourse
):
    # Arrange
    file = tmp_path / "courses.jsonl"
    file.write_text("\n".join(valid_course_data.model_dump_json() for _ in range(5)))

    # Act
    batches = file_reader.provide(file, batch_size=2)

    # Assert
    assert len(batches) == 3
    assert len(batches[0]) == 2
