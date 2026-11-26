"""The selection a group filter of the review screen or the console resolves."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.db.models import QuerySet

from rating_app.models import SyncChange, SyncChangeState, SyncRun
from rating_app.sync import fields, review


def filter_ids(run: SyncRun, source: str, filters: Mapping[str, Any]) -> list[int]:
    """The run's proposed changes that match one group filter of the review screen."""
    changes = review.in_group(
        SyncChange.objects.filter(run=run, source=source, state=SyncChangeState.PROPOSED),
        str(filters["group"]),
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
    changes = narrow(
        changes,
        changed_field=filters.get("changed_field") or None,
        blanks=filters.get("blanks"),
        quiet=filters.get("quiet"),
        year_from=filters.get("year_from"),
        year_to=filters.get("year_to"),
    )
    excluded = set(excluded_ids(filters))
    return sorted(
        int(change_id)
        for change_id in changes.values_list("id", flat=True)
        if int(change_id) not in excluded
    )


def excluded_ids(filters: Mapping[str, Any] | None) -> list[int]:
    """The changes a filter selection leaves out; an approval never applies them,
    even when a selected change's unit or requirements name them."""
    return sorted({int(change_id) for change_id in (filters or {}).get("exclude_ids") or []})


def narrow(
    changes: QuerySet[SyncChange],
    *,
    changed_field: str | None,
    blanks: bool | None,
    year_from: int | None,
    year_to: int | None,
    quiet: bool | None = None,
) -> QuerySet[SyncChange]:
    """The sync page's own facets: a field and value pair, a blanked field, changes
    no student sees and the academic years of a semester."""
    if changed_field is not None or blanks is not None:
        changes = changes.filter(
            kind__in=fields.CHANGE_KINDS,
            pk__in=fields.field_ids(changes, changed_field, blanks),
        )
    if quiet is not None:
        changes = changes.filter(
            kind__in=fields.CHANGE_KINDS, pk__in=fields.quiet_ids(changes, quiet)
        )
    if year_from is not None or year_to is not None:
        changes = changes.filter(pk__in=fields.year_ids(changes, year_from, year_to))
    return changes


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
