import uuid
from dataclasses import dataclass

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake

from rating_app.models.choices import AcademicDegree, AcademicTitle


class InstructorReadParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    instructor_id: uuid.UUID = Field(description="Unique identifier of instructor")


@dataclass(frozen=True)
class InstructorInput:
    first_name: str
    patronymic: str | None
    last_name: str
    academic_degree: AcademicDegree | str
    academic_title: AcademicTitle | str


@dataclass(frozen=True)
class Instructor:
    id: uuid.UUID
    first_name: str
    patronymic: str | None
    last_name: str
    academic_degree: AcademicDegree | str
    academic_title: AcademicTitle | str
