import datetime
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Annotated, Any, Literal

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
from rating_app.models.choices import RatingVoteStrType

from .pagination import PaginationMetadata

RatingValue = Annotated[int, Field(ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)]

OrderOption = Literal["asc", "desc"]
PopularityOrderOption = Literal["desc"]


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

    student_id: uuid.UUID = Field(description="Unique identifier of the student")
    course_id: uuid.UUID = Field(description="Unique identifier of a course")


class RatingListQueryParams(BaseModel):
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
    time_order: OrderOption | None = Field(
        default=None,
        description="Order ratings by creation time",
    )
    order_by_popularity: bool = Field(
        default=False,
        description="Order ratings by popularity (Wilson score)",
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
    separate_current_user: bool | None = Field(
        default=False,
        description="Separate ratings from current user ones",
    )
    viewer_id: uuid.UUID | None = Field(
        default=None,
        description="ID of the user requesting the ratings",
    )
    time_order: OrderOption | None = Field(
        default=None,
        description="Order ratings by creation time",
    )
    popularity_order: bool = Field(
        default=False,
        description="Order ratings by popularity (Wilson score, most popular first)",
    )


def strip_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


class Rating(BaseModel):
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
    viewer_vote: RatingVoteStrType | None


class RatingsWithUserList(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    ratings: list[Rating]
    user_ratings: list[Rating] | None = None


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
class RatingCreateParams(RatingCreateRequest):
    student: uuid.UUID = Field(description="UUID of the student creating the rating")


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


@dataclass(frozen=True)
class RatingSearchResult:
    items: RatingsWithUserList
    pagination: PaginationMetadata
    applied_filters: dict[str, Any]


@dataclass(frozen=True)
class AggregatedCourseRatingStats:
    avg_difficulty: Decimal
    avg_usefulness: Decimal
    ratings_count: int
