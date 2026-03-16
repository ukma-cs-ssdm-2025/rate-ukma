import json
from pathlib import Path

import structlog
from pydantic import ValidationError

from ...models import ParsedCourseDetails
from .base import DataValidationError, DeduplicationComponent

logger = structlog.get_logger(__name__)


class CourseLoader(DeduplicationComponent[Path, list[ParsedCourseDetails]]):
    def __init__(self, *, skip_invalid_courses: bool = False):
        self.skip_invalid_courses = skip_invalid_courses

    def process(self, data: Path) -> list[ParsedCourseDetails]:
        if not data.exists():
            logger.error("file_not_found", path=str(data))
            raise FileNotFoundError(f"Input file not found: {data}")

        courses: list[ParsedCourseDetails] = []
        skipped_count = 0
        with data.open("r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                result = self._parse_line(line, line_num)
                if result is not None:
                    courses.append(result)
                else:
                    skipped_count += 1

        logger.info(
            "courses_loaded_successfully",
            total=len(courses),
            skipped=skipped_count,
            input_path=str(data),
        )
        return courses

    def _parse_line(self, line: str, line_num: int) -> ParsedCourseDetails | None:
        try:
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise DataValidationError(
                    f"Expected JSON object at line {line_num}, got {type(payload).__name__}"
                )
            course = ParsedCourseDetails(**payload)
            self._validate_basic_structure(course)
            return course
        # skip_invalid_courses only applies to structural validation failures
        # from _validate_basic_structure, not malformed JSON or schema violations
        except json.JSONDecodeError as e:
            logger.warning("json_decode_error", line_num=line_num, error=str(e))
            raise DataValidationError(f"Invalid JSON at line {line_num}: {e}") from e
        except ValidationError as e:
            logger.warning("pydantic_validation_error", line_num=line_num, error=str(e))
            raise DataValidationError(f"Validation error at line {line_num}: {e}") from e
        except DataValidationError as e:
            if self.skip_invalid_courses:
                logger.warning(
                    "course_data_validation_skipped",
                    line_num=line_num,
                    error=str(e),
                )
                return None
            logger.error("course_data_validation_failed", line_num=line_num, error=str(e))
            raise
        except Exception as e:
            logger.error("unexpected_parsing_error", line_num=line_num, error=str(e))
            raise DataValidationError(f"Unexpected error at line {line_num}: {e}") from e

    def _validate_basic_structure(self, course: ParsedCourseDetails) -> None:
        if not course.id:
            raise DataValidationError("Course must have an ID")

        if not course.title:
            raise DataValidationError(f"Course {course.id} must have a title")
