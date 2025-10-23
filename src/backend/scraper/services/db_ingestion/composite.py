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

    @implements
    def execute(self, file_path: Path, batch_size: int = 100, dry_run: bool = False) -> None:
        for batch in self.file_reader.provide(file_path, batch_size):
            if dry_run:
                logger.info("dry_run_mode_enabled", skipping_batch=True)
                continue

            self.db_injector.execute(batch)
