import uuid
from dataclasses import dataclass
from typing import Annotated, Any

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake
from pydantic.json_schema import SkipJsonSchema

from rating_app.constants import (
    DEFAULT_PAGE_NUMBER,
    DEFAULT_PAGE_SIZE,
    MAX_RATING_VALUE,
    MIN_PAGE_NUMBER,
    MIN_PAGE_SIZE,
    MIN_RATING_VALUE,
)
from rating_app.models.rating import IRating

from .pagination import PaginationMetadata

RatingValue = Annotated[int, Field(ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)]


class RatingCourseFilterParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_id: uuid.UUID = Field(description="Unique identifier of rating course")


class RatingRetrieveParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    rating_id: uuid.UUID = Field(description="Unique identifier of rating")


class RatingPaginationParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    page: int | None = Field(
        default=MIN_PAGE_NUMBER,
        ge=MIN_PAGE_NUMBER,
        description=f"Page number (default: {DEFAULT_PAGE_NUMBER})",
    )
    page_size: int | None = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        description=f"Items per page (default: {DEFAULT_PAGE_SIZE})",
    )
    exclude_current_user: bool = Field(
        default=False,
        description="Exclude the current user's rating from the list",
    )


class RatingFilterCriteria(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    page: int | None = Field(
        default=MIN_PAGE_NUMBER,
        ge=MIN_PAGE_NUMBER,
    )
    page_size: int | None = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
    )
    course_id: uuid.UUID | None = Field(default=None)
    exclude_student_id: uuid.UUID | None = Field(
        default=None,
        description="Exclude ratings from this student ID",
    )


# API request schema (student is set automatically from authenticated user)
class RatingCreateRequest(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_offering: uuid.UUID = Field(description="UUID of the course offering being rated")
    difficulty: RatingValue = Field()
    usefulness: RatingValue = Field()
    comment: str | SkipJsonSchema[None] = Field(default=None)
    is_anonymous: bool = Field(default=False)


# Internal schema used by service layer (includes student)
class RatingCreateParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_offering: uuid.UUID = Field(description="UUID of the course offering being rated")
    student: uuid.UUID = Field(description="UUID of the student creating the rating")
    difficulty: RatingValue = Field()
    usefulness: RatingValue = Field()
    comment: str | SkipJsonSchema[None] = Field(default=None)
    is_anonymous: bool = Field(default=False)


class RatingPutParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    difficulty: RatingValue = Field()
    usefulness: RatingValue = Field()
    comment: str | SkipJsonSchema[None] = Field(default=None)
    is_anonymous: bool = Field(default=False)


# needs external validation
class RatingPatchParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    difficulty: RatingValue | SkipJsonSchema[None] = Field(
        default=None,
    )
    usefulness: RatingValue | SkipJsonSchema[None] = Field(
        default=None,
    )
    comment: str | SkipJsonSchema[None] = Field(default=None)
    is_anonymous: bool = Field(default=False)


# is constructed internally
@dataclass(frozen=True)
class RatingSearchResult:
    items: list[IRating]
    pagination: PaginationMetadata
    applied_filters: dict[str, Any]
