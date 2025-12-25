import datetime
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, Field
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
from rating_app.models.choices import RatingVoteType

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


class StudentCourseRatingsParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    student_id: uuid.UUID = Field(description="Unique identifier of rating")
    course_id: uuid.UUID = Field(description="Unique identifier of a course")


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
    separate_current_user: bool = Field(
        default=False,
        description="Separate the current user's rating from the list",
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
    separate_current_user: uuid.UUID | None = Field(
        default=None,
        description="Separate ratings from this student ID",
    )
    viewer_id: uuid.UUID | None = Field(
        default=None,
        description="ID of the user viewing the ratings (for vote status)",
    )


def strip_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


class RatingRead(BaseModel):
    model_config = {
        "from_attributes": True,
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    id: uuid.UUID
    course_offering_id: uuid.UUID
    student_id: uuid.UUID | None
    student_name: str | None
    course_offering: uuid.UUID
    course: uuid.UUID
    difficulty: int
    usefulness: int
    comment: str | None
    is_anonymous: bool
    created_at: datetime.datetime

    upvotes: int
    downvotes: int
    viewer_vote: RatingVoteType | None


class RatingListResponse(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    ratings: list[RatingRead]
    user_ratings: list[RatingRead] | None = None


# API request schema (student is set automatically from authenticated user)
class RatingCreateRequest(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    course_offering: uuid.UUID = Field(description="UUID of the course offering being rated")
    difficulty: RatingValue = Field()
    usefulness: RatingValue = Field()
    comment: Annotated[str | SkipJsonSchema[None], BeforeValidator(strip_string)] = Field(
        default=None
    )
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
    comment: Annotated[str | SkipJsonSchema[None], BeforeValidator(strip_string)] = Field(
        default=None
    )
    is_anonymous: bool = Field(default=False)


class RatingPutParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    difficulty: RatingValue = Field()
    usefulness: RatingValue = Field()
    comment: Annotated[str | SkipJsonSchema[None], BeforeValidator(strip_string)] = Field(
        default=None
    )
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
    comment: Annotated[str | SkipJsonSchema[None], BeforeValidator(strip_string)] = Field(
        default=None
    )
    is_anonymous: bool | SkipJsonSchema[None] = Field(
        default=None,
    )


# is constructed internally
@dataclass(frozen=True)
class RatingSearchResult:
    items: RatingListResponse
    pagination: PaginationMetadata
    applied_filters: dict[str, Any]


@dataclass(frozen=True)
class AggregatedCourseRatingStats:
    avg_difficulty: Decimal
    avg_usefulness: Decimal
    ratings_count: int
