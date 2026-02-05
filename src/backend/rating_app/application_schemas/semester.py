import uuid
from dataclasses import dataclass

from rating_app.models.choices import SemesterTerm


@dataclass(frozen=True)
class SemesterInput:
    year: int
    term: SemesterTerm | str


@dataclass(frozen=True)
class Semester:
    id: uuid.UUID
    year: int
    term: SemesterTerm | str
    label: str | None = None
