import datetime
import uuid
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field, model_validator
from pydantic.alias_generators import to_snake
from pydantic.json_schema import SkipJsonSchema

from rating_app.constants import (
    DEFAULT_PAGE_NUMBER,
    DEFAULT_PAGE_SIZE,
    MIN_PAGE_NUMBER,
    MIN_PAGE_SIZE,
)

from .pagination import PaginationMetadata


class CommentFilterParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    rating_id: uuid.UUID = Field(description="Unique identifier of a rating")


class CommentReplyFilterParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    comment_id: uuid.UUID = Field(description="Unique identifier of a comment")


class CommentListQueryParams(BaseModel):
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


class CommentFilterCriteria(BaseModel):
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
    rating_id: uuid.UUID | None = None
    comment_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_exactly_one_parent(self):
        has_rating = self.rating_id is not None
        has_comment = self.comment_id is not None

        if has_rating == has_comment:
            raise ValueError("Exactly one of rating_id or comment_id must be provided")

        return self


# API request schema (user is set automatically from authenticated user)
class CommentCreateRequest(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }
    parent_comment: uuid.UUID | SkipJsonSchema[None] = None
    content: str
    is_anonymous: bool


class CommentCreateParams(CommentCreateRequest):
    rating_id: uuid.UUID
    user_id: int = Field(description="ID of the user creating the comment")


class CommentUpsertParams(CommentCreateParams):
    id: uuid.UUID = Field(description="Existing comment ID for idempotent import/upsert flows")


class CommentPutParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    content: str
    is_anonymous: bool


class CommentPatchParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    content: str | SkipJsonSchema[None] = None
    is_anonymous: bool | SkipJsonSchema[None] = None


class CommentAuthor(BaseModel):
    model_config = {
        "from_attributes": True,
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    user_id: int | None
    user_name: str | None
    user_avatar_url: str | None = None
    is_anonymous: bool


class CommentDTO(BaseModel):
    model_config = {
        "from_attributes": True,
        "alias_generator": to_snake,
        "populate_by_name": True,
    }
    id: uuid.UUID
    user_id: int | None
    user_name: str | None
    user_avatar_url: str | None = None
    rating_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    content: str
    is_anonymous: bool
    created_at: datetime.datetime

    replies_count: int
    reply_authors: list[CommentAuthor] = Field(default_factory=list)


@dataclass(frozen=True)
class CommentSearchResult:
    items: list[CommentDTO]
    pagination: PaginationMetadata
    applied_filters: dict[str, Any]
