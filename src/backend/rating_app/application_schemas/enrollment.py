import uuid
from dataclasses import dataclass
from datetime import datetime

from rating_app.models.choices import EnrollmentStatus


@dataclass(frozen=True)
class EnrollmentInput:
    student_id: uuid.UUID
    offering_id: uuid.UUID
    status: EnrollmentStatus | str


@dataclass(frozen=True)
class Enrollment:
    id: uuid.UUID
    student_id: uuid.UUID
    offering_id: uuid.UUID
    status: EnrollmentStatus | str
    enrolled_at: datetime | None = None
