import uuid
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel

from rating_app.constants import MAX_RATING_VALUE, MIN_PAGE_NUMBER, MIN_PAGE_SIZE, MIN_RATING_VALUE
from rating_app.models.rating import IRating

from .pagination import PaginationMetadata
from .validators import validate_uuid_string


class RatingReadParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    rating_id: str = Field(description="ID of the rating being read")

    validate_rating_id = validate_uuid_string("rating_id")


# needs external validation
class RatingFilterCriteria(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    course_id: uuid.UUID | None = Field(default=None)
    page: int | None = Field(default=MIN_PAGE_NUMBER, ge=MIN_PAGE_NUMBER)
    page_size: int | None = Field(default=None, ge=MIN_PAGE_SIZE)


# needs external validation
class RatingCreateParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    course_offering: uuid.UUID = Field(description="UUID of the course offering being rated")
    student: uuid.UUID = Field(description="UUID of the student creating the rating")
    difficulty: int = Field(ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    usefulness: int = Field(ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    comment: str | None = Field(default=None)
    is_anonymous: bool = Field(default=False)


class RatingPutParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    difficulty: int = Field(ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    usefulness: int = Field(ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    comment: str | None = Field(default=None)
    is_anonymous: bool = Field(default=False)


# needs external validation
class RatingPatchParams(BaseModel):
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }

    difficulty: int | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    usefulness: int | None = Field(default=None, ge=MIN_RATING_VALUE, le=MAX_RATING_VALUE)
    comment: str | None = Field(default=None)
    is_anonymous: bool | None = Field(default=None)


# is constructed internally
@dataclass(frozen=True)
class RatingSearchResult:
    items: list[IRating]
    pagination: PaginationMetadata
    applied_filters: dict[str, Any]
