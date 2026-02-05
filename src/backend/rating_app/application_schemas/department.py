import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class Department:
    id: uuid.UUID
    name: str
    faculty_id: uuid.UUID
    faculty_name: str | None = None
