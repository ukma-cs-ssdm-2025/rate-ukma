"""Drafts a builder turns into `SyncChange` rows, and the decisions it reads."""

from __future__ import annotations

from dataclasses import dataclass, field

from rating_app.models import CatalogMappingDecision, SyncChange
from rating_app.sync.current_values import current_values
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.snapshot import RateUkmaSnapshot


@dataclass(frozen=True)
class ChangeDraft:
    kind: str
    key: str
    ukma_data_id: str | None = None
    target_id: str | None = None
    before: dict[str, object] = field(default_factory=dict)
    after: dict[str, object] = field(default_factory=dict)
    requires: list[dict[str, str]] = field(default_factory=list)
    ratings: int = 0
    display: dict[str, object] = field(default_factory=dict)

    def to_model(self) -> SyncChange:
        """Build the unsaved row; the run and its source are set when recorded."""
        registry_kind = KIND_BY_NAME[self.kind]
        after = {**self.after}
        if self.display:
            after["display"] = self.display
        return SyncChange(
            source=registry_kind.source,
            group=registry_kind.group,
            kind=self.kind,
            key=self.key,
            ukma_data_id=self.ukma_data_id,
            target_id=self.target_id,
            before=self.before,
            after=after,
            requires=self.requires,
            ratings=self.ratings,
        )


@dataclass(frozen=True)
class DecisionView:
    kind: str
    ukma_course_id: str
    course_id: str | None
    offering_id: str | None
    answer: str
    into_id: str | None
    premise: dict[str, object]


def load_decisions() -> list[DecisionView]:
    rows = CatalogMappingDecision.objects.filter(superseded_at__isnull=True).order_by("id")
    return [
        DecisionView(
            kind=row.kind,
            ukma_course_id=row.ukma_course_id,
            course_id=str(row.course_id) if row.course_id is not None else None,
            offering_id=str(row.offering_id) if row.offering_id is not None else None,
            answer=row.answer,
            into_id=str(row.into_id) if row.into_id is not None else None,
            premise=row.premise,
        )
        for row in rows
    ]


def make_before(
    kind: str,
    ru: RateUkmaSnapshot,
    target_id: str | None,
    after: dict[str, object],
) -> dict[str, object]:
    """The current values of only the keys ``after`` writes."""
    values = current_values(kind, ru, target_id)
    return {key: value for key, value in values.items() if key in after}
