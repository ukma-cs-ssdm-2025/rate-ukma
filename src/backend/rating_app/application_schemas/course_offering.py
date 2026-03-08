import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake

from rating_app.models.choices import CourseTypeKind, ExamType, PracticeType

from .instructor import Instructor


@dataclass(frozen=True)
class CourseOfferingSpeciality:
    speciality_id: uuid.UUID
    speciality_title: str
    faculty_id: uuid.UUID
    faculty_name: str
    speciality_alias: str | None
    type_kind: CourseTypeKind | None


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
class CourseOfferingInput:
    code: str
    course_id: uuid.UUID
    semester_id: uuid.UUID
    credits: Decimal
    weekly_hours: int
    exam_type: ExamType
    study_year: int | None = None
    lecture_count: int | None = None
    practice_count: int | None = None
    practice_type: PracticeType | None = None
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None


@dataclass(frozen=True)
class CourseOffering:
    id: uuid.UUID
    code: str
    course_id: uuid.UUID
    semester_id: uuid.UUID
    credits: Decimal
    weekly_hours: int
    exam_type: ExamType
    total_hours: int | None = None
    study_year: int | None = None
    lecture_count: int | None = None
    practice_count: int | None = None
    practice_type: PracticeType | None = None
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None
    instructors: list[Instructor] = field(default_factory=list)
    specialities: list[CourseOfferingSpeciality] = field(default_factory=list)
    course_title: str | None = None
    semester_year: int | None = None
    semester_term: str | None = None
