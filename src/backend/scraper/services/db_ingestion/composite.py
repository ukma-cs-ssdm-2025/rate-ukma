from pathlib import Path

import structlog

from rateukma.protocols.artifacts import IOperation, implements

from ...models.deduplicated import DeduplicatedCourse
from .file_reader import IFileReader
from .injector import IDbInjector

logger = structlog.get_logger()


class CoursesIngestion(IOperation[[Path, int, bool]]):
    def __init__(self, file_reader: IFileReader[DeduplicatedCourse], db_injector: IDbInjector):
        self.file_reader = file_reader
        self.db_injector = db_injector

    def _count_total_records(self, file_path: Path) -> int:
        file_path = Path(file_path) if not isinstance(file_path, Path) else file_path
        total = 0
        with file_path.open("r", encoding="utf-8") as file:
            for raw_line in file:
                if raw_line.strip():
                    total += 1
        return total

    @implements
    def execute(self, file_path: Path, batch_size: int = 100, dry_run: bool = False) -> None:
        if hasattr(self.db_injector, "reset_state"):
            self.db_injector.reset_state()

        total_records = 0
        processed_records = 0
        if not dry_run:
            total_records = self._count_total_records(file_path)
            if total_records:
                logger.info(
                    "overall_injection_starting",
                    total_courses=total_records,
                    batch_size=batch_size,
                )

        batch_index = 0
        for batch in self.file_reader.provide(file_path, batch_size):
            batch_index += 1
            if hasattr(self.db_injector, "set_batch_number"):
                self.db_injector.set_batch_number(batch_index)

            if dry_run:
                logger.info("dry_run_mode_enabled", skipping_batch=True)
                continue

            self.db_injector.execute(batch)
            if total_records:
                processed_records += len(batch)
                percentage = (processed_records / total_records) * 100
                logger.info(
                    "overall_injection_progress",
                    processed=processed_records,
                    total=total_records,
                    percentage=f"{percentage:.1f}%",
                    batch_number=batch_index,
                )

        if total_records:
            logger.info(
                "overall_injection_completed",
                processed=processed_records,
                total=total_records,
                percentage="100.0%",
            )
