import uuid
from dataclasses import dataclass
from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, Field, ValidationError, field_validator
from pydantic.alias_generators import to_camel

from ..constants import (
    MAX_RATING_VALUE,
    MIN_PAGE_NUMBER,
    MIN_PAGE_SIZE,
    MIN_RATING_VALUE,
    MIN_SEMESTER_YEAR,
)
from ..models.choices import CourseTypeKind, SemesterTerm
from ..models.course import ICourse
from .pagination import PaginationMetadata

AvgOrder: TypeAlias = Literal["asc", "desc"]


class CourseReadParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    course_id: str = Field(description="ID of the course being read")

    @field_validator("course_id", mode="before")
    @classmethod
    def normalize_course_id(cls, value):
        try:
            uuid.UUID(value)
        except ValueError as e:
            raise ValidationError("Invalid course id") from e

        return value


# needs external validation
class CourseFilterCriteria(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    name: str | None = Field(default=None)
    type_kind: CourseTypeKind | None = Field(default=None)
    instructor: uuid.UUID | None = Field(default=None)
    faculty: uuid.UUID | None = Field(default=None)
    department: uuid.UUID | None = Field(default=None)
    speciality: uuid.UUID | None = Field(default=None)
    semester_year: int | None = Field(default=None, ge=MIN_SEMESTER_YEAR)
    semester_term: SemesterTerm | None = Field(default=None)
    avg_difficulty_min: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_difficulty_max: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_usefulness_min: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_usefulness_max: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_difficulty_order: AvgOrder = Field(default="asc")
    avg_usefulness_order: AvgOrder = Field(default="asc")
    page: int | None = Field(default=MIN_PAGE_NUMBER, ge=MIN_PAGE_NUMBER)
    page_size: int | None = Field(default=None, ge=MIN_PAGE_SIZE)

    @field_validator("semester_term", mode="before")
    @classmethod
    def normalize_semester_term(cls, value):
        if isinstance(value, str):
            return SemesterTerm(value.upper())
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
    departments: list[dict[str, Any]]
    semester_terms: list[dict[str, Any]]
    semester_years: list[dict[str, Any]]
    course_types: list[dict[str, Any]]
    specialities: list[dict[str, Any]]
