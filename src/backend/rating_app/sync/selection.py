"""Preview tokens and the selection a preview or a confirmed apply resolves."""

from __future__ import annotations

import hashlib
from collections.abc import Iterable, Mapping
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet

from rating_app.models import SyncChange, SyncChangeState, SyncPreview, SyncRun
from rating_app.sync import review


def filter_ids(run: SyncRun, source: str, filters: Mapping[str, Any]) -> list[int]:
    """The run's proposed changes that match one group filter of the review screen."""
    changes = SyncChange.objects.filter(
        run=run,
        source=source,
        group=filters["group"],
        state=SyncChangeState.PROPOSED,
    )
    kind = filters.get("kind") or None
    if kind:
        changes = changes.filter(kind=kind)
    changes = _rated(changes, filters.get("rated"))
    match = filters.get("match")
    if match is not None:
        changes = changes.filter(
            kind__in=review.LINK_KINDS, pk__in=review.match_ids(changes, str(match))
        )
    similar = filters.get("similar_existing")
    if similar is not None:
        changes = changes.filter(
            kind="new_course", pk__in=review.similar_ids_in(changes, bool(similar))
        )
    subset = filters.get("fields_subset") or None
    if subset:
        changes = changes.filter(
            kind__in=review.CHANGE_KINDS,
            pk__in=review.field_ids(changes, None, str(subset)),
        )
    query = filters.get("q") or None
    if query:
        changes = changes.filter(pk__in=review.search_ids(changes, str(query)))
    return sorted(int(change_id) for change_id in changes.values_list("id", flat=True))


def pending_ids(
    changes: QuerySet[SyncChange],
    *,
    match: str | None,
    similar_existing: bool | None,
    field: str | None,
    fields_subset: str | None,
    q: str | None,
) -> QuerySet[SyncChange]:
    """Narrow the pending list by the review facets; the caller keeps its ordering."""
    if match is not None:
        changes = changes.filter(
            kind__in=review.LINK_KINDS, pk__in=review.match_ids(changes, match)
        )
    if similar_existing is not None:
        changes = changes.filter(
            kind="new_course",
            pk__in=review.similar_ids_in(changes, similar_existing),
        )
    if field or fields_subset:
        changes = changes.filter(
            kind__in=review.CHANGE_KINDS,
            pk__in=review.field_ids(changes, field, fields_subset),
        )
    if q:
        changes = changes.filter(pk__in=review.search_ids(changes, q))
    return changes


def _rated(changes: QuerySet[SyncChange], rated: Any) -> QuerySet[SyncChange]:
    if rated is None:
        return changes
    if rated:
        return changes.filter(ratings__gt=0)
    return changes.filter(ratings=0)


def token_for(run_id: int, change_ids: Iterable[int]) -> str:
    ids = sorted({int(change_id) for change_id in change_ids})
    digest = hashlib.sha256(",".join(str(change_id) for change_id in ids).encode()).hexdigest()
    return f"{run_id}:{digest}"


def parse_token(token: str) -> tuple[int, str] | None:
    run_id, separator, digest = token.partition(":")
    if not separator:
        return None
    try:
        return int(run_id), digest
    except ValueError:
        return None


def record_preview(token: str, run: SyncRun, user: User, count: int) -> None:
    SyncPreview.objects.update_or_create(
        token=token,
        defaults={"run": run, "user": user, "count": count},
    )


def preview_count(token: str) -> int | None:
    count = SyncPreview.objects.filter(token=token).values_list("count", flat=True).first()
    return None if count is None else int(count)
