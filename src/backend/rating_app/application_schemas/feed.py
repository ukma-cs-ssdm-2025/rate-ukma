import datetime
import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from pydantic import BaseModel, Field
from pydantic.alias_generators import to_snake

from rating_app.constants import (
    DEFAULT_FEED_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MIN_PAGE_SIZE,
)
from rating_app.models.choices import FeedPostAccent, SemesterTerm


@dataclass(frozen=True)
class FeedItemBase:
    id: uuid.UUID
    occurred_at: datetime.datetime


@dataclass(frozen=True)
class FeedReviewItem(FeedItemBase):
    course_id: uuid.UUID
    course_title: str
    difficulty: int
    usefulness: int
    comment: str
    semester_year: int
    semester_term: SemesterTerm
    course_avg_difficulty: Decimal
    course_avg_usefulness: Decimal


@dataclass(frozen=True)
class FeedPromoItem(FeedItemBase):
    """An admin-authored post."""

    title: str
    body: str
    accent: FeedPostAccent
    pinned: bool = False
    label: str = ""
    cta_label: str = ""
    cta_href: str = ""
    image_url: str | None = None


@dataclass(frozen=True)
class FeedPage:
    items: list[FeedReviewItem | FeedPromoItem] = field(default_factory=list)
    next_cursor: str | None = None


class FeedListQueryParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    cursor: str | None = Field(
        default=None,
        description="Opaque position token from the previous page. Omit for the first page.",
    )
    limit: int = Field(
        default=DEFAULT_FEED_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
        description=f"Items per page (default: {DEFAULT_FEED_PAGE_SIZE})",
    )
