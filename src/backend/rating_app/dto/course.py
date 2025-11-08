from typing import Literal, TypeAlias

from pydantic import BaseModel, Field, ValidationError, field_validator
from pydantic.alias_generators import to_camel
from pydantic_core import ErrorDetails

from ..constants import (
    DEFAULT_PAGE_NUMBER,
    MAX_PAGE_SIZE,
    MAX_RATING_VALUE,
    MIN_PAGE_NUMBER,
    MIN_PAGE_SIZE,
    MIN_RATING_VALUE,
    MIN_SEMESTER_YEAR,
)
from ..models.choices import CourseTypeKind, InstructorRole, SemesterTerm

AvgOrder: TypeAlias = Literal["asc", "desc"]


class CourseQueryParamsValidationError(ValidationError):
    def __init__(self, errors: list[ErrorDetails]):
        super().__init__("Course query parameters are invalid", errors)


class CourseQueryParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    name: str | None = Field(default=None)
    type_kind: CourseTypeKind | None = Field(default=None)
    instructor: InstructorRole | None = Field(default=None)
    faculty: str | None = Field(default=None)
    department: str | None = Field(default=None)
    speciality: str | None = Field(default=None)
    semester_year: int | None = Field(default=None, ge=MIN_SEMESTER_YEAR)
    semester_term: SemesterTerm | None = Field(default=None)
    avg_difficulty_min: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_difficulty_max: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_usefulness_min: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_usefulness_max: float | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    avg_difficulty_order: AvgOrder | None = Field(default=None)
    avg_usefulness_order: AvgOrder | None = Field(default=None)
    page: int | None = Field(default=DEFAULT_PAGE_NUMBER, ge=MIN_PAGE_NUMBER)
    page_size: int | None = Field(default=None, ge=MIN_PAGE_SIZE, le=MAX_PAGE_SIZE)

    # TODO: check if case insensitivity can be achieved with Pydantic's built-in validation
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
