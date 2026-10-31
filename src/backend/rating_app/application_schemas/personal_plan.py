import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake

from rating_app.models.choices import CourseTypeKind, PlanSlot, PlanYearStatus, SemesterTerm


@dataclass(frozen=True)
class OfferingTermLoad:
    year: int
    term: SemesterTerm
    credits: Decimal
    weekly_hours: int


@dataclass(frozen=True)
class PlanOffering:
    id: uuid.UUID
    year: int
    term: SemesterTerm
    loads: tuple[OfferingTermLoad, ...]
    kinds: Mapping[uuid.UUID, CourseTypeKind] = field(default_factory=dict)


@dataclass(frozen=True)
class PlanCourseSource:
    course_id: uuid.UUID
    title: str
    faculty_name: str
    offerings: tuple[PlanOffering, ...]


@dataclass(frozen=True)
class TakenCourse:
    course: PlanCourseSource
    offering: PlanOffering


@dataclass(frozen=True)
class MandatoryCourse:
    course: PlanCourseSource
    offering: PlanOffering
    study_year: int


@dataclass(frozen=True)
class PlannedCourseEntry:
    course: PlanCourseSource
    offering: PlanOffering
    study_year: int
    term: SemesterTerm
    slot: PlanSlot


class PlanCoursePutRequest(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    study_year: int = Field(ge=1)
    semester_term: SemesterTerm
    slot: PlanSlot


class PlanCoursePathParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_id: uuid.UUID = Field(description="A course of the student's plan")


# Internal schema used by service layer (includes the course)
class PlanCoursePutParams(PlanCoursePutRequest):
    course_id: uuid.UUID


@dataclass(frozen=True)
class PlanCourse:
    course_id: uuid.UUID
    title: str
    type_kind: CourseTypeKind
    faculty_name: str
    credits: Decimal
    weekly_hours: int
    is_mandatory: bool


@dataclass(frozen=True)
class PlanTimeline:
    enrollment_year_start: int
    current_year_start: int
    year_count: int


@dataclass(frozen=True)
class SemesterCourses:
    main: list[PlanCourse]
    backup: list[PlanCourse]


@dataclass(frozen=True)
class PlanSemester:
    semester_term: SemesterTerm
    is_graduation_summer: bool
    main: list[PlanCourse]
    backup: list[PlanCourse]


@dataclass(frozen=True)
class PlanYear:
    study_year: int
    academic_year_start: int
    year_status: PlanYearStatus
    semesters: list[PlanSemester]


@dataclass(frozen=True)
class PersonalPlan:
    enrollment_year_start: int
    current_year_start: int
    plan_years: list[PlanYear]
