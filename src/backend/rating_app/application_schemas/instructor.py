import uuid
from dataclasses import dataclass

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake

from rating_app.application_schemas.pagination import PaginationMetadata


class InstructorReadParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    instructor_id: uuid.UUID = Field(description="Unique identifier of instructor")


class InstructorListParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Field(default=20, ge=1, le=100, description="Page size")
    search: str | None = Field(
        default=None,
        description="Substring match on name or email (case-insensitive)",
    )
    course_offering_id: uuid.UUID | None = Field(
        default=None,
        description="Boost instructors most mentioned on this course offering",
    )
    speciality_id: uuid.UUID | None = Field(
        default=None,
        description="Boost instructors most mentioned on this speciality",
    )


@dataclass(frozen=True)
class InstructorInput:
    first_name: str
    patronymic: str | None
    last_name: str
    email: str


@dataclass(frozen=True)
class Instructor:
    id: uuid.UUID
    first_name: str
    patronymic: str | None
    last_name: str
    email: str


@dataclass(frozen=True)
class InstructorListResult:
    items: list[Instructor]
    pagination: PaginationMetadata
