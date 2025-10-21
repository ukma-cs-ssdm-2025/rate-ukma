from pathlib import Path

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider

from ...models import DeduplicatedCourse


class CourseFileReader(IProvider[[Path], list[DeduplicatedCourse]]):
    @implements
    def provide(self, file_path: Path) -> list[DeduplicatedCourse]:
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return []
