from pathlib import Path
from typing import TYPE_CHECKING

import structlog

from scraper.models.deduplicated import DeduplicatedCourse

from ...browser import JSONLWriter
from .base import ProcessingChain
from .grouper import CourseGrouper
from .loader import CourseLoader

if TYPE_CHECKING:
    pass

logger = structlog.get_logger(__name__)


class CourseGroupingService:
    def __init__(self):
        self.processing_chain = (
            ProcessingChain[Path, Path]().add_step(CourseLoader()).add_step(CourseGrouper())
        )

    def group_courses(self, input_path: Path, output_path: Path) -> None:
        logger.info("grouping_started", input_path=str(input_path))

        try:
            grouped_courses = self.processing_chain.execute(input_path)
            logger.info(
                "grouping_completed_successfully",
                output_count=len(grouped_courses),
            )
            self._save_grouped(grouped_courses, output_path)

        except Exception as e:
            logger.error("grouping_process_failed", error=str(e))
            raise

    def _save_grouped(self, courses: list[DeduplicatedCourse], output_path: Path) -> None:
        with JSONLWriter(output_path) as writer:
            for course in courses:
                writer.write(course.model_dump_json_compat())
