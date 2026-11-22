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


class SyncRunChangesPathParams(BaseModel):
    run_id: int = Field(ge=1, description="Identifier of the sync run")
