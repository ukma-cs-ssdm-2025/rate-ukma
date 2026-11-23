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

from rating_app.models import CatalogMappingDecision, SyncApproval, SyncPolicyChange
from rating_app.sync import revert as revert_service

APPLY = "apply"
REJECT = "reject"
REVERT = "revert"
POLICY = "policy"
ANSWER = "answer"


@dataclass(frozen=True)
class JournalEntry:
    id: int
    kind: str
    who: str | None
    when: datetime
    counts: dict[str, Any] = field(default_factory=dict)
    outcome: str = ""
    approval_id: int | None = None
    reverts_id: int | None = None
    group: str = ""
    revertible: bool = False
    revert_reason: str = ""
    reverted: bool = False


def entries(limit: int = 20, before: datetime | None = None) -> list[JournalEntry]:
    """Entries newest first; ``before`` pages past the given time."""
    merged = [*_approvals(limit, before), *_policies(limit, before), *_answers(limit, before)]
    merged.sort(key=lambda entry: (entry.when, entry.id), reverse=True)
    return merged[:limit]


def _approvals(limit: int, before: datetime | None) -> list[JournalEntry]:
    rows = SyncApproval.objects.select_related("user").order_by("-created_at", "-id")
    if before is not None:
        rows = rows.filter(created_at__lt=before)
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
                group=approval.group,
                revertible=revertible,
                revert_reason=reason,
                reverted=reason == revert_service.REFUSAL_TEXT["already_reverted"],
            )
        )
    return result


def _policies(limit: int, before: datetime | None) -> list[JournalEntry]:
    rows = SyncPolicyChange.objects.select_related("user").order_by("-changed_at", "-id")
    if before is not None:
        rows = rows.filter(changed_at__lt=before)
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


def _answers(limit: int, before: datetime | None) -> list[JournalEntry]:
    rows = CatalogMappingDecision.objects.select_related("decided_by").order_by(
        "-decided_at", "-id"
    )
    if before is not None:
        rows = rows.filter(decided_at__lt=before)
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
