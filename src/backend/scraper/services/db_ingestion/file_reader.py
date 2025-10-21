from pathlib import Path

from rateukma.protocols.decorators import implements
from rateukma.protocols.generic import IProvider

from ...models import DeduplicatedCourse


class CourseFileReader(IProvider[[Path | str], list[DeduplicatedCourse]]):
    @implements
    def provide(self, file_path: Path | str) -> list[DeduplicatedCourse]:
        return []
