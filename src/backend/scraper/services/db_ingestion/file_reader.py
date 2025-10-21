import json
from collections.abc import Generator
from pathlib import Path
from typing import Any

import structlog
from pydantic import ValidationError

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider

from ...models import DeduplicatedCourse

logger = structlog.get_logger()


class CourseFileReader(IProvider[[Path], Generator[list[DeduplicatedCourse], Any, None]]):
    @implements
    def provide(
        self, file_path: Path, batch_size: int = 100
    ) -> Generator[list[DeduplicatedCourse], Any, None]:
        if not file_path.exists():
            raise FileNotFoundError

        batch = []
        with file_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error("json_decode_error", error=str(e))
                    continue

                try:
                    course = DeduplicatedCourse.model_validate(data)
                except ValidationError as e:
                    logger.error("validation_error", error=str(e))
                    continue

                batch.append(course)
                if len(batch) >= batch_size:
                    yield batch
                    batch = []

        if batch:
            yield batch
