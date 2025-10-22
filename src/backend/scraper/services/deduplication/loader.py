import json
from pathlib import Path

import structlog
from pydantic import ValidationError

from ...models import ParsedCourseDetails
from .base import DataValidationError, DeduplicationComponent

logger = structlog.get_logger(__name__)


class CourseLoader(DeduplicationComponent[Path, list[ParsedCourseDetails]]):
    def process(self, data: Path) -> list[ParsedCourseDetails]:
        if not data.exists():
            logger.error("file_not_found", path=str(data))
            raise FileNotFoundError(f"Input file not found: {data}")

        courses = []
        count = 0
        with data.open("r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if not isinstance(data, dict):
                        raise DataValidationError(
                            f"Expected JSON object at line {line_num}, got {type(data).__name__}"
                        )
                    course = ParsedCourseDetails(**data)
                    self._validate_basic_structure(course)
                    courses.append(course)
                    count += 1
                except json.JSONDecodeError as e:
                    logger.warning("json_decode_error", line_num=line_num, error=str(e))
                    raise DataValidationError(f"Invalid JSON at line {line_num}: {e}") from e
                except ValidationError as e:
                    logger.warning("pydantic_validation_error", line_num=line_num, error=str(e))
                    raise DataValidationError(f"Validation error at line {line_num}: {e}") from e
                except DataValidationError as e:
                    logger.error("course_data_validation_failed", line_num=line_num, error=str(e))
                    raise
                except Exception as e:
                    logger.error("unexpected_parsing_error", line_num=line_num, error=str(e))
                    raise DataValidationError(f"Unexpected error at line {line_num}: {e}") from e

        logger.info("courses_loaded_successfully", total=count, input_path=str(data))
        return courses

    def _validate_basic_structure(self, course: ParsedCourseDetails) -> None:
        if not course.id:
            raise DataValidationError("Course must have an ID")

        if not course.title:
            raise DataValidationError(f"Course {course.id} must have a title")
