"""One newest-first list of every sync decision, for the console and the API.

Approvals (apply, reject, revert; by a person or by the nightly job), policy
changes and mapping answers merge here, so «Журнал» and `catalog_sync log` never
disagree. Each entry is a plain dataclass: the API serializes it and the console
prints it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from django.db.models import Q
from django.utils import timezone

from rating_app.models import (
    CatalogMappingDecision,
    SyncApproval,
    SyncPolicyChange,
    UkmaDataDecision,
)
from rating_app.sync import revert as revert_service

APPLY = "apply"
REJECT = "reject"
REVERT = "revert"
POLICY = "policy"
ANSWER = "answer"
DECISION = "decision"


@dataclass(frozen=True)
class JournalEntry:
    id: int
    kind: str
    who: str | None
    when: datetime
    counts: dict[str, Any] = field(default_factory=dict)
    outcome: str = ""
    error: str = ""
    approval_id: int | None = None
    reverts_id: int | None = None
    group: str | None = None
    revertible: bool = False
    revert_reason: str = ""
    reverted: bool = False


@dataclass(frozen=True)
class Cursor:
    """A page break that stays put when several entries share one timestamp."""

    when: datetime
    kind: str
    id: int


def entries(limit: int = 20, before: Cursor | None = None) -> list[JournalEntry]:
    """Entries newest first; ``before`` pages past the given entry."""
    merged = [
        *_approvals(limit, before),
        *_policies(limit, before),
        *_answers(limit, before),
        *_decisions(limit, before),
    ]
    merged.sort(key=lambda entry: (entry.when, entry.kind, entry.id), reverse=True)
    return merged[:limit]


def cursor_of(entry: JournalEntry) -> str:
    return f"{entry.when.isoformat()}|{entry.kind}|{entry.id}"


def parse_cursor(value: str) -> Cursor | None:
    parts = value.split("|")
    if len(parts) != 3 or not parts[2].isdigit():
        return None
    try:
        when = datetime.fromisoformat(parts[0])
    except ValueError:
        return None
    if timezone.is_naive(when):
        when = timezone.make_aware(when, timezone.get_default_timezone())
    return Cursor(when=when, kind=parts[1], id=int(parts[2]))


def _approvals(limit: int, before: Cursor | None) -> list[JournalEntry]:
    rows = SyncApproval.objects.select_related("user").order_by("-created_at", "-action", "-id")
    if before is not None:
        rows = rows.filter(
            Q(created_at__lt=before.when)
            | Q(created_at=before.when, action__lt=before.kind)
            | Q(created_at=before.when, action=before.kind, id__lt=before.id)
        )
    result = []
    for approval in rows[:limit]:
        revertible, reason = (False, "")
        if approval.action == APPLY:
            revertible, reason = revert_service.quick_verdict(approval)
        result.append(
            JournalEntry(
                id=approval.pk,
                kind=str(approval.action),
                who=None if approval.user is None else approval.user.username,
                when=approval.created_at,
                counts=dict(approval.counts or {}),
                outcome=str(approval.outcome),
                approval_id=approval.pk,
                reverts_id=approval.reverts_id,
                group=approval.group or None,
                revertible=revertible,
                revert_reason=reason,
                reverted=reason == revert_service.REFUSAL_TEXT["already_reverted"],
            )
        )
    return result


def _policies(limit: int, before: Cursor | None) -> list[JournalEntry]:
    rows = SyncPolicyChange.objects.select_related("user").order_by("-changed_at", "-id")
    if before is not None:
        rows = rows.filter(_after("changed_at", POLICY, before))
    return [
        JournalEntry(
            id=row.pk,
            kind=POLICY,
            who=row.user.username,
            when=row.changed_at,
            counts={"kind": row.kind, "old_mode": str(row.old_mode), "new_mode": str(row.new_mode)},
            outcome="changed",
        )
        for row in rows[:limit]
    ]


def _answers(limit: int, before: Cursor | None) -> list[JournalEntry]:
    rows = CatalogMappingDecision.objects.select_related("decided_by").order_by(
        "-decided_at", "-id"
    )
    if before is not None:
        rows = rows.filter(_after("decided_at", ANSWER, before))
    return [
        JournalEntry(
            id=row.pk,
            kind=ANSWER,
            who=row.decided_by.username,
            when=row.decided_at,
            counts={
                "kind": row.kind,
                "answer": str(row.answer),
                "into": None if row.into_id is None else str(row.into_id),
            },
            outcome=str(row.answer),
        )
        for row in rows[:limit]
    ]


def _decisions(limit: int, before: Cursor | None) -> list[JournalEntry]:
    rows = UkmaDataDecision.objects.select_related("user").order_by("-created_at", "-id")
    if before is not None:
        rows = rows.filter(_after("created_at", DECISION, before))
    return [
        JournalEntry(
            id=row.pk,
            kind=DECISION,
            who=row.user.username,
            when=row.created_at,
            counts={
                "action": str(row.action),
                "target_id": row.target_id,
                "related_id": row.related_id or None,
            },
            outcome=str(row.outcome),
            error=row.error,
        )
        for row in rows[:limit]
    ]


def _after(field: str, kind: str, before: Cursor) -> Q:
    older = Q(**{f"{field}__lt": before.when})
    if kind < before.kind:
        return older | Q(**{field: before.when})
    if kind == before.kind:
        return older | Q(**{field: before.when, "id__lt": before.id})
    return older
