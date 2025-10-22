from pathlib import Path
from typing import TYPE_CHECKING

import structlog

from scraper.models.deduplicated import DeduplicatedCourse

from ...browser import JSONLWriter
from .base import ProcessingChain
from .loader import CourseLoader
from .merger import CourseMerger

if TYPE_CHECKING:
    pass

logger = structlog.get_logger(__name__)


class CourseDeduplicatorService:
    def __init__(self):
        self.processing_chain = (
            ProcessingChain[Path, Path]().add_step(CourseLoader()).add_step(CourseMerger())
        )

    def deduplicate_courses(self, input_path: Path, output_path: Path) -> None:
        logger.info("deduplication_started", input_path=str(input_path))

        try:
            deduplicated_courses = self.processing_chain.execute(input_path)
            logger.info(
                "deduplication_completed_successfully",
                output_count=len(deduplicated_courses),
            )
            self._save_deduplicated(deduplicated_courses, output_path)

        except Exception as e:
            logger.error("deduplication_process_failed", error=str(e))
            raise

    def _save_deduplicated(self, courses: list[DeduplicatedCourse], output_path: Path) -> None:
        writer = JSONLWriter(output_path)
        for course in courses:
            writer.write(course.model_dump_json_compat())
