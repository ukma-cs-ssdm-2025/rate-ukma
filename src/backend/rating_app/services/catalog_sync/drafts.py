from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from rating_app.models import CatalogMappingDecision
from rating_app.models.catalog_sync import KIND_GROUP
from rating_app.services.catalog_sync.current_values import current_values
from rating_app.services.catalog_sync.snapshot import RateUkmaSnapshot


@dataclass(frozen=True)
class ProposalDraft:
    kind: str
    ukma_data_id: str | None
    target_id: str | None
    before: dict[str, object]
    after: dict[str, object]
    ratings: int = 0

    @property
    def group(self) -> str:
        return KIND_GROUP[self.kind]


@dataclass
class DiffResult:
    proposals: list[ProposalDraft] = field(default_factory=list)
    skipped: Counter[str] = field(default_factory=Counter)
    notes: list[dict[str, object]] = field(default_factory=list)

    def merge(self, other: DiffResult) -> None:
        self.proposals.extend(other.proposals)
        self.skipped.update(other.skipped)
        self.notes.extend(other.notes)


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
    values = current_values(kind, ru, target_id)
    return {key: value for key, value in values.items() if key in after}
