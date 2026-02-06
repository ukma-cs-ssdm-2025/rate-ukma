import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class SpecialityInput:
    name: str
    faculty_id: uuid.UUID
    alias: str | None = None


@dataclass(frozen=True)
class Speciality:
    id: uuid.UUID
    name: str
    faculty_id: uuid.UUID
    alias: str | None = None
    faculty_name: str | None = None
