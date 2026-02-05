import uuid
from dataclasses import dataclass

from rating_app.models.choices import EducationLevel


@dataclass(frozen=True)
class Student:
    id: uuid.UUID
    first_name: str
    last_name: str
    patronymic: str | None
    education_level: EducationLevel | str
    speciality_id: uuid.UUID
    email: str | None = None
    user_id: int | None = None
    speciality_name: str | None = None
