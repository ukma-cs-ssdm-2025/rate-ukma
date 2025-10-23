import json
from collections.abc import Generator
from pathlib import Path
from typing import Generic, TypeVar

import structlog
from pydantic import BaseModel, ValidationError

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider

from ...models import DeduplicatedCourse

logger = structlog.get_logger(__name__)

_T = TypeVar("_T", bound=BaseModel)


class IFileReader(IProvider[[Path, int], Generator[list[_T], None, None]], Generic[_T]):
    _is_protocol = True

    def provide(
        self, file_path: Path, batch_size: int = 100
    ) -> Generator[list[_T], None, None]: ...


class CoursesJSONLFileReader(IFileReader[DeduplicatedCourse]):
    BATCH_SIZE = 100

    @implements
    def provide(
        self, file_path: Path, batch_size: int = 100
    ) -> Generator[list[DeduplicatedCourse], None, None]:
        file_path = Path(file_path) if isinstance(file_path, str) else file_path
        self._validate_file(file_path)

        line_num = 0
        valid_count = 0
        invalid_count = 0
        batch: list[DeduplicatedCourse] = []

        with file_path.open("r", encoding="utf-8") as file:
            for raw_line in file:
                line_num += 1
                course_raw_data = self._read_line(raw_line)
                if not course_raw_data:
                    continue

                course = self._read_course(course_raw_data)
                if not course:
                    logger.warning(
                        "invalid_course",
                        data_keys=list(course_raw_data.keys()),
                        line_num=line_num,
                        skipped=True,
                    )
                    invalid_count += 1
                    continue

                valid_count += 1
                batch.append(course)
                logger.info("course_read", course_title=course.title, line_num=line_num)

                if len(batch) >= batch_size:
                    yield batch
                    batch = []

        if batch:
            yield batch

        logger.info(
            "file_reading_completed",
            file=str(file_path),
            total_lines=line_num,
            valid_records=valid_count,
            invalid_records=invalid_count,
        )

    def _read_line(self, line: str) -> dict | None:
        stripped_line = line.strip()
        if not stripped_line:
            return None

        try:
            return json.loads(stripped_line)
        except json.JSONDecodeError as e:
            logger.error("json_decode_error", error=str(e), line_len=len(line))
            return None

    def _read_course(self, data: dict) -> DeduplicatedCourse | None:
        try:
            return DeduplicatedCourse.model_validate(data)
        except ValidationError as e:
            logger.error("validation_error", error=str(e), fields=list(data.keys()))
            return None

    def _validate_file(self, file_path: Path) -> None:
        logger.info("validating_file", file_path=str(file_path))
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if not file_path.is_file():
            raise ValueError(f"Path is not a file: {file_path}")

        if file_path.suffix.lower() != ".jsonl":
            logger.error(
                "file_format_mismatch",
                path=str(file_path),
                expected_extension=".jsonl",
            )
            raise ValueError(f"Unsupported file extension: {file_path.suffix}")
