from pathlib import Path

from rateukma.protocols.artifacts import IOperation, implements

from ...models.deduplicated import DeduplicatedCourse
from .file_reader import IFileReader
from .injector import IDbInjector


class CoursesDeltaIngestion(IOperation[[Path, int]]):
    def __init__(self, file_reader: IFileReader[DeduplicatedCourse], db_injector: IDbInjector):
        self.file_reader = file_reader
        self.db_injector = db_injector

    @implements
    def execute(self, file_path: Path, batch_size: int = 100) -> None:
        for batch in self.file_reader.provide(file_path, batch_size):
            self.db_injector.execute(batch)
