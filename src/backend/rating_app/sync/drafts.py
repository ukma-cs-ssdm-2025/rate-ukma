"""Drafts a builder turns into `SyncChange` rows, and the decisions it reads."""

from __future__ import annotations

from dataclasses import dataclass, field

from rating_app.models import CatalogMappingDecision, SyncChange
from rating_app.sync.current_values import TargetMissingError, current_values
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.payloads import BEFORE_PAYLOADS
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
    question_key: str
    ukma_course_id: str
    saz_code: str
    course_id: str | None
    offering_id: str | None
    answer: str
    into_id: str | None
    premise: dict[str, object]


def load_decisions() -> list[DecisionView]:
    """Live decisions in id order, each with its question key; one whose course,
    offering or into course is gone is left out so the builder asks again."""
    rows = CatalogMappingDecision.objects.filter(superseded_at__isnull=True).order_by("id")
    return [
        DecisionView(
            kind=row.kind,
            question_key=row.question_key,
            ukma_course_id=row.ukma_course_id,
            saz_code=row.saz_code,
            course_id=str(row.course_id) if row.course_id is not None else None,
            offering_id=str(row.offering_id) if row.offering_id is not None else None,
            answer=row.answer,
            into_id=str(row.into_id) if row.into_id is not None else None,
            premise=row.premise,
        )
        for row in rows
        if not _row_gone(row)
    ]


def _row_gone(row: CatalogMappingDecision) -> bool:
    return (
        (bool(row.course_ref) and row.course_id is None)
        or (bool(row.offering_ref) and row.offering_id is None)
        or (bool(row.into_ref) and row.into_id is None)
    )


def make_before(
    kind: str,
    ru: RateUkmaSnapshot,
    target_id: str | None,
    after: dict[str, object],
) -> dict[str, object]:
    """The current values of the keys ``after`` writes, or all of them for a kind
    whose `before` has its own shape; ``is_stale`` compares the same keys."""
    values = current_values(kind, ru, target_id)
    if kind in BEFORE_PAYLOADS:
        return values
    return {key: value for key, value in values.items() if key in after}


def is_stale(
    kind: str,
    ru: RateUkmaSnapshot,
    target_id: str | None,
    before: dict[str, object],
) -> bool:
    """Whether the target is gone or a value ``before`` recorded has changed since.

    Only the keys in ``before`` count, so an edit to a field the change does not
    write leaves it fresh.
    """
    if kind == "removed_course":
        return target_id not in ru.courses
    if kind == "removed_offering":
        return target_id not in ru.offerings
    try:
        values = current_values(kind, ru, target_id)
    except TargetMissingError:
        return True
    if kind in BEFORE_PAYLOADS:
        return values != before
    return any(
        key not in values or _differs(kind, key, values[key], value)
        for key, value in before.items()
    )


def _differs(kind: str, key: str, current: object, recorded: object) -> bool:
    """Compare the values a change writes; a ``change_course`` department by id.

    A department linked or renamed earlier in the same run changes its
    ``ukma_data_id`` or name in ``current_values``; the course still sits on the
    same department, so only the id decides whether the change is stale.
    """
    if kind == "change_course" and key == "department":
        return _department_id(current) != _department_id(recorded)
    return current != recorded


def _department_id(value: object) -> object:
    return value.get("id") if isinstance(value, dict) else None
