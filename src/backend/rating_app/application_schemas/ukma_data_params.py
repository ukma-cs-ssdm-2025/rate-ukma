import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from rating_app.application_schemas.ukma_data_base import UkmaDataModel

UKMA_DATA_MAX_PAGE_SIZE = 1000

ReviewCaseKind = Literal["course_match", "instructor_match", "student_match", "removals_held"]
ReviewCaseStatus = Literal["open", "decided", "obsolete"]


class UkmaDataPageParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    after: int | None = Field(
        default=None,
        ge=0,
        description="Change number saved after the last sync; omit or 0 for all rows",
    )
    limit: int | None = Field(
        default=None,
        ge=1,
        description=(
            f"Rows per page; UKMA Data's default is 500, "
            f"values above {UKMA_DATA_MAX_PAGE_SIZE} are capped"
        ),
    )


class UkmaDataReviewCaseParams(UkmaDataPageParams):
    status: ReviewCaseStatus | None = Field(
        default=None, description="Only cases with this status; omit for every status"
    )
    kind: ReviewCaseKind | None = Field(
        default=None, description="Only cases of this kind; omit for every kind"
    )


class UkmaDataKey(UkmaDataModel):
    """UKMA Data's ``GET /v1/key``, written by hand on purpose.

    The generated model types ``scopes`` as an enum of the scopes UKMA Data
    knows today; a scope it adds later would fail validation and stop every
    sync. Scopes stay plain strings so Rate UKMA keeps reading the key.
    """

    id: str
    scopes: list[str]
    expires_at: str = Field(alias="expiresAt")


class UkmaDataStatus(BaseModel):
    """Rate UKMA's own answer for the /data status endpoint, not a UKMA Data row."""

    key_id: str
    scopes: list[str]
    decide_scopes: list[str]
    key_expires_at: datetime.datetime
    data_updated_at: datetime.datetime | None
