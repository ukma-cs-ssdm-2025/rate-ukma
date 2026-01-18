import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake

from rating_app.models.choices import ExamType, PracticeType

from .instructor import Instructor


class CourseOfferingCourseFilterParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_id: uuid.UUID = Field(description="Unique identifier of offering course")


class CourseOfferingRetrieveParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_offering_id: uuid.UUID = Field(description="Unique identifier of course offering")


@dataclass(frozen=True)
class CourseOffering:
    id: uuid.UUID
    code: str
    course_id: uuid.UUID
    semester_id: uuid.UUID
    credits: Decimal
    weekly_hours: int
    exam_type: ExamType | str
    lecture_count: int | None = None
    practice_count: int | None = None
    practice_type: PracticeType | str = ""
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None
    instructors: list[Instructor] = field(default_factory=list)
