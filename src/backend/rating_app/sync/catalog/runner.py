"""Read UKMA Data's whole catalog and record one run of proposals.

Every list is read from change number 0, so a change applied out of order
cannot hide a row. The builders only draft: this module writes `SyncRun` and
`SyncChange` rows and never the catalog itself.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import replace
from typing import Any, Protocol

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import (
    UKMA_DATA_MAX_PAGE_SIZE,
    UkmaDataPageParams,
    UkmaDataStatus,
)
from rating_app.models.sync import SyncChange, SyncRun
from rating_app.repositories.instructor_repository import current_academic_year_start
from rating_app.sync.catalog.changes import propose_changes
from rating_app.sync.catalog.links_and_new import propose_links_and_new
from rating_app.sync.catalog.mapping import propose_mapping_questions
from rating_app.sync.drafts import ChangeDraft, DecisionView, load_decisions
from rating_app.sync.matching import academic_year_of
from rating_app.sync.runs import finish_run
from rating_app.sync.snapshot import (
    RateUkmaSnapshot,
    UkmaDataSnapshot,
    load_rate_ukma_snapshot,
)

# A year is short when UKMA Data holds under 90% of Rate UKMA's offerings for it.
SHORT_READ_RATIO = 0.9


class CatalogRow(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def change_no(self) -> int: ...


class CatalogPage[T](Protocol):
    @property
    def items(self) -> list[T]: ...

    @property
    def cursor(self) -> int: ...

    @property
    def has_more(self) -> bool: ...


class CatalogReader(Protocol):
    def list_faculties(self, params: UkmaDataPageParams) -> ud.FacultyPage: ...

    def list_departments(self, params: UkmaDataPageParams) -> ud.DepartmentPage: ...

    def list_programmes(self, params: UkmaDataPageParams) -> ud.ProgrammePage: ...

    def list_terms(self, params: UkmaDataPageParams) -> ud.TermPage: ...

    def list_courses(self, params: UkmaDataPageParams) -> ud.CoursePage: ...

    def list_offerings(self, params: UkmaDataPageParams) -> ud.OfferingPage: ...

    def get_status(self) -> UkmaDataStatus: ...


class CatalogDataChangedError(RuntimeError):
    """UKMA Data finished a crawl twice while this run was reading it."""


class ShortReadError(RuntimeError):
    """UKMA Data returned under 90% of Rate UKMA's offerings for a year."""

    def __init__(self, years: Sequence[int]) -> None:
        self.years = list(years)
        super().__init__("short_read")


def record_catalog_run(run: SyncRun, reader: CatalogReader) -> SyncRun:
    """Read, guard and record one run, or raise before any change is written."""
    ud_snapshot = read_ukma_data_snapshot(reader)
    ru_snapshot = load_rate_ukma_snapshot()

    short_years = short_read_years(ud_snapshot, ru_snapshot)
    if short_years:
        raise ShortReadError(short_years)

    changes, counts = build_proposals(
        ud_snapshot,
        ru_snapshot,
        load_decisions(),
        academic_year=current_academic_year_start(),
    )
    run.cursor_from = {"after": 0}
    run.cursor_to = {"after": _max_change_no(ud_snapshot)}
    run.data_updated_at = ud_snapshot.data_updated_at
    run.save(update_fields=["cursor_from", "cursor_to", "data_updated_at"])
    return finish_run(run, changes, counts)


def read_ukma_data_snapshot(reader: CatalogReader) -> UkmaDataSnapshot:
    """Read every list, once more if the data changed under the first read."""
    before = reader.get_status().data_updated_at
    snapshot = _read_lists(reader)
    after = reader.get_status().data_updated_at
    if after != before:
        before = after
        snapshot = _read_lists(reader)
        after = reader.get_status().data_updated_at
        if after != before:
            raise CatalogDataChangedError()
    return replace(snapshot, data_updated_at=after)


def short_read_years(ud_snapshot: UkmaDataSnapshot, ru_snapshot: RateUkmaSnapshot) -> list[int]:
    """Years where UKMA Data returned under 90% of Rate UKMA's offerings.

    A removed UKMA Data row is still returned, so only a missing row counts as
    short; a truncated list would otherwise look like a mass removal.
    """
    ru_counts = Counter(
        academic_year_of(offering.semester_year, offering.semester_term)
        for offering in ru_snapshot.offerings.values()
    )
    ud_counts = Counter(offering.academic_year for offering in ud_snapshot.offerings.values())
    return sorted(
        year for year, count in ru_counts.items() if ud_counts[year] < count * SHORT_READ_RATIO
    )


def build_proposals(
    ud_snapshot: UkmaDataSnapshot,
    ru_snapshot: RateUkmaSnapshot,
    decisions: Sequence[DecisionView],
    *,
    academic_year: int,
) -> tuple[list[SyncChange], dict[str, Any]]:
    """The run's rows and its counts: one per kind plus skipped ids per reason."""
    links, link_skips = propose_links_and_new(
        ud_snapshot, ru_snapshot, decisions, academic_year=academic_year
    )
    changes, change_skips = propose_changes(
        ud_snapshot, ru_snapshot, decisions, academic_year=academic_year
    )
    drafts: list[ChangeDraft] = [
        *links,
        *changes,
        *propose_mapping_questions(ud_snapshot, ru_snapshot, decisions),
    ]

    counts: dict[str, Any] = dict(sorted(Counter(draft.kind for draft in drafts).items()))
    counts["skipped"] = _skipped_counts(link_skips, change_skips)
    return [draft.to_model() for draft in drafts], counts


def _read_lists(reader: CatalogReader) -> UkmaDataSnapshot:
    return UkmaDataSnapshot(
        faculties=_read_list(reader.list_faculties),
        departments=_read_list(reader.list_departments),
        programmes=_read_list(reader.list_programmes),
        terms=_read_list(reader.list_terms),
        courses=_read_list(reader.list_courses),
        offerings=_read_list(reader.list_offerings),
        data_updated_at=None,
    )


def _read_list[T: CatalogRow](
    fetch: Callable[[UkmaDataPageParams], CatalogPage[T]],
) -> dict[str, T]:
    """Every row from change 0, the newest copy of an id that moved under the read."""
    rows: dict[str, T] = {}
    after = 0
    while True:
        page = fetch(UkmaDataPageParams(after=after, limit=UKMA_DATA_MAX_PAGE_SIZE))
        for row in page.items:
            seen = rows.get(row.id)
            if seen is None or row.change_no > seen.change_no:
                rows[row.id] = row
        after = page.cursor
        if not page.has_more:
            return rows


def _skipped_counts(*groups: dict[str, list[str]]) -> dict[str, int]:
    skipped: dict[str, set[str]] = defaultdict(set)
    for group in groups:
        for reason, ids in group.items():
            skipped[reason].update(ids)
    return {reason: len(ids) for reason, ids in sorted(skipped.items())}


def _max_change_no(snapshot: UkmaDataSnapshot) -> int:
    rows: Iterable[CatalogRow] = (
        *snapshot.faculties.values(),
        *snapshot.departments.values(),
        *snapshot.programmes.values(),
        *snapshot.terms.values(),
        *snapshot.courses.values(),
        *snapshot.offerings.values(),
    )
    return max((row.change_no for row in rows), default=0)
