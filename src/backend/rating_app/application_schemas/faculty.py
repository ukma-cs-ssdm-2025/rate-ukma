import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class FacultyInput:
    name: str
    custom_abbreviation: str | None = None


@dataclass(frozen=True)
class Faculty:
    id: uuid.UUID
    name: str
    custom_abbreviation: str | None = None
