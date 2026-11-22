from typing import Literal

from pydantic import BaseModel, Field, field_validator

from rating_app.models.sync import SyncChangeGroup, SyncChangeState, SyncSource
from rating_app.sync.kinds import KIND_BY_NAME


class SyncListParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Field(default=20, ge=1, le=100, description="Rows per page")


class SyncRunListParams(SyncListParams):
    source: SyncSource | None = Field(
        default=None, description="Only runs of this source; omit for both"
    )


class SyncChangeListParams(SyncListParams):
    group: SyncChangeGroup | None = Field(
        default=None, description="Only changes of this group; omit for every group"
    )
    kind: str | None = Field(
        default=None, description="Only changes of this kind from the registry"
    )
    state: SyncChangeState | None = Field(
        default=None, description="Only changes in this state; omit for every state"
    )

    @field_validator("kind")
    @classmethod
    def _known_kind(cls, value: str | None) -> str | None:
        if value is not None and value not in KIND_BY_NAME:
            raise ValueError("Unknown sync kind")
        return value


class SyncPendingParams(SyncChangeListParams):
    source: SyncSource | None = Field(
        default=None, description="Only changes of this source; omit for both"
    )
    state: SyncChangeState | None = Field(
        default=SyncChangeState.PROPOSED,
        description="State to list; `proposed` by default",
    )
    run: int | None = Field(
        default=None, ge=1, description="Pin one run; omit for each source's current run"
    )
    q: str | None = Field(default=None, max_length=200, description="Match a title or a САЗ code")
    rated: bool | None = Field(
        default=None, description="Only rows with ratings (`true`) or without (`false`)"
    )
    match: Literal["exact", "review"] | None = Field(
        default=None, description="Link strength: exact (code or same title) or review"
    )
    similar_existing: bool | None = Field(
        default=None, description="New courses whose normalised title already exists"
    )
    field: str | None = Field(default=None, description="Change rows that touch this field")
    fields_subset: str | None = Field(
        default=None, description="Comma-separated fields the change must stay within"
    )
    view: Literal["all", "sample"] = Field(
        default="all", description="`sample` takes up to 20 rows per faculty"
    )
    seed: int = Field(default=0, description="Sample order seed")


class SyncRunChangesPathParams(BaseModel):
    run_id: int = Field(ge=1, description="Identifier of the sync run")


class SyncSummaryParams(BaseModel):
    source: SyncSource = Field(default=SyncSource.CATALOG, description="Source of the run")
    run: int | None = Field(default=None, ge=1, description="Pin one run; omit for the current run")


class SyncQuestionListParams(BaseModel):
    source: SyncSource = Field(default=SyncSource.CATALOG, description="Source of the run")
    run: int | None = Field(default=None, ge=1, description="Pin one run; omit for the current run")
    rated: bool | None = Field(
        default=None, description="Only questions with ratings or plans (`true`) or without"
    )
    after: int | None = Field(
        default=None, ge=1, description="Keyset cursor: the id of the last question seen"
    )
    limit: int = Field(default=20, ge=1, le=100, description="Questions per page")
