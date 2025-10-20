import json
from collections.abc import Generator
from pathlib import Path
from typing import TypeVar

import structlog
from pydantic import BaseModel, ValidationError

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider

from ...models import DeduplicatedCourse

logger = structlog.get_logger(__name__)


_T = TypeVar("_T", bound=BaseModel)


class IFileReader(IProvider[[Path | str, int], Generator[list[_T], None, None]]):
    def provide(
        self, file_path: Path | str, batch_size: int = 100
    ) -> Generator[list[_T], None, None]: ...


class CourseFileReader(IFileReader[DeduplicatedCourse]):
    BATCH_SIZE = 100

    @implements
    def provide(
        self, file_path: Path | str, batch_size: int = 100
    ) -> Generator[list[DeduplicatedCourse], None, None]:
        file_path = Path(file_path) if isinstance(file_path, str) else file_path
        self._validate_file(file_path)

        line_num = 0
        valid_count = 0
        invalid_count = 0
        batch: list[DeduplicatedCourse] = []

        with file_path.open("r", encoding="utf-8") as file:
            for line in file:
                line = self._read_line(line, line_num)
                course = self._read_course(line)
                if not course:
                    # currently skipping invalid by default
                    logger.warning("invalid_course", line=line, line_num=line_num)
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

    def _read_line(self, line: str, line_num: int) -> str | None:
        line_num += 1
        stripped_line = line.strip()
        return stripped_line

    def _read_course(self, line: str | None) -> DeduplicatedCourse | None:
        if not line:
            return None

        try:
            data = json.loads(line)
            return DeduplicatedCourse.model_validate(data)
        except json.JSONDecodeError as e:
            logger.error(
                "json_decode_error",
                line=line,
                error=str(e),
            )
            return None
        except ValidationError as e:
            logger.error(
                "validation_error",
                line=line,
                error=str(e),
            )
            return None

    def _validate_file(self, file_path: Path | str) -> None:
        # TODO: format logging
        logger.info("validating_file", file_path=str(file_path))

        file_path = Path(file_path) if isinstance(file_path, str) else file_path

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        if not file_path.is_file():
            raise ValueError(f"Path is not a file: {file_path}")
        if file_path.suffix.lower() not in [".jsonl", ".json"]:
            logger.warning(
                "file_format_warning",
                path=str(file_path),
                message="Expected .jsonl or .json extension",
            )
