from pathlib import Path

import pytest

from .file_reader import CourseFileReader


@pytest.fixture
def file_reader() -> CourseFileReader:
    return CourseFileReader()


def test_provide_raises_if_file_not_exists(file_reader: CourseFileReader, tmp_path: Path):
    fake_file = tmp_path / "inexistent.jsonl"
    with pytest.raises(FileNotFoundError):
        list(file_reader.provide(fake_file))
