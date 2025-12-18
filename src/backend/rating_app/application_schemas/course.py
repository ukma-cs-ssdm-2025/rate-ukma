import uuid
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from pydantic.alias_generators import to_snake

from ..constants import (
    MAX_DIFFICULTY_VALUE,
    MAX_USEFULNESS_VALUE,
    MIN_DIFFICULTY_VALUE,
    MIN_USEFULNESS_VALUE,
)
from ..models.choices import CourseTypeKind, SemesterTerm
from ..models.course import ICourse
from .pagination import PaginationMetadata

AvgOrder = Literal["asc", "desc"]


# needs external validation
class CourseReadParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_id: uuid.UUID = Field(description="A unique identifier for the course")


# needs external validation
class CourseFilterCriteria(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    name: str | None = Field(default=None, description="Filter by course name")
    type_kind: CourseTypeKind | None = Field(
        default=None,
        description="Course type kind (COMPULSORY, ELECTIVE, PROF_ORIENTED)",
    )
    exclude_type_kinds: list[str] | None = Field(
        default=None,
        description="Exclude courses with these type kinds (COMPULSORY, ELECTIVE, PROF_ORIENTED)",
    )
    instructor: uuid.UUID | None = Field(default=None, description="Filter by instructor UUID")
    faculty: uuid.UUID | None = Field(default=None, description="Filter by faculty UUID")
    department: uuid.UUID | None = Field(default=None, description="Filter by department UUID")
    speciality: uuid.UUID | None = Field(default=None, description="Filter by speciality UUID")
    semester_year: str | None = Field(
        default=None, description="Academic year range (e.g., '2024–2025')"
    )
    semester_term: SemesterTerm | None = Field(
        default=None,
        description="Semester term (FALL, SPRING, SUMMER)",
    )
    avg_difficulty_min: float | None = Field(
        default=None,
        ge=MIN_DIFFICULTY_VALUE,
        le=MAX_DIFFICULTY_VALUE,
        description="Minimum average difficulty (1.0 - 5.0)",
    )
    avg_difficulty_max: float | None = Field(
        default=None,
        ge=MIN_DIFFICULTY_VALUE,
        le=MAX_DIFFICULTY_VALUE,
        description="Maximum average difficulty (1.0 - 5.0)",
    )
    avg_usefulness_min: float | None = Field(
        default=None,
        ge=MIN_USEFULNESS_VALUE,
        le=MAX_USEFULNESS_VALUE,
        description="Minimum average usefulness (1.0 - 5.0)",
    )
    avg_usefulness_max: float | None = Field(
        default=None,
        ge=MIN_USEFULNESS_VALUE,
        le=MAX_USEFULNESS_VALUE,
        description="Maximum average usefulness (1.0 - 5.0)",
    )
    ratings_count_min: int | None = Field(
        default=None,
        ge=0,
        description="Minimum ratings count (0+)",
    )
    avg_difficulty_order: AvgOrder | None = Field(
        default=None, description="Sort order for difficulty (asc/desc)"
    )
    avg_usefulness_order: AvgOrder | None = Field(
        default=None, description="Sort order for usefulness (asc/desc)"
    )
    page: int | None = Field(default=1, ge=1, description="Page number")
    page_size: int | None = Field(default=None, ge=1, description="Items per page")

    @field_validator("semester_term", mode="before")
    @classmethod
    def normalize_semester_term(cls, value):
        if isinstance(value, str):
            return value.upper()
        return value

    @field_validator("avg_difficulty_order", "avg_usefulness_order", mode="before")
    @classmethod
    def normalize_sort_order(cls, value):
        if isinstance(value, str):
            return value.lower()
        return value


# is constructed internally
@dataclass(frozen=True)
class CourseSearchResult:
    items: list[ICourse]
    pagination: PaginationMetadata
    applied_filters: dict[str, Any]


# is constructed internally
@dataclass(frozen=True)
class CourseFilterOptions:
    instructors: list[dict[str, Any]]
    faculties: list[dict[str, Any]]
    semester_terms: list[dict[str, Any]]
    semester_years: list[dict[str, Any]]
    course_types: list[dict[str, Any]]
