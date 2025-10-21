import json
from pathlib import Path

import structlog
from pydantic import ValidationError

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider

from ...models import DeduplicatedCourse

logger = structlog.get_logger()


class CourseFileReader(IProvider[[Path], list[DeduplicatedCourse]]):
    @implements
    def provide(self, file_path: Path) -> list[DeduplicatedCourse]:
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        courses = []
        with file_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    logger.error("json_decode_error", line=line)
                    continue

                try:
                    courses.append(DeduplicatedCourse.model_validate(data))
                except ValidationError:
                    logger.error("validation_error", line=line)
                    continue

        return courses
