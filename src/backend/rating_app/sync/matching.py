"""Pure catalog matching rules shared by the builders (M1, M2, M8, M10, M14)."""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Mapping
from decimal import Decimal
from typing import Protocol

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.sync.constants import (
    BAD_SAZ_CODE,
    CREDITS_OUT_OF_RANGE,
    MAX_CREDITS,
    MAX_NAME,
    NO_DEPARTMENT,
    NO_TERM,
    TITLE_TOO_LONG,
    ZERO_CREDITS,
)
from rating_app.sync.snapshot import RateUkmaSnapshot, UkmaDataSnapshot


class _NamedRow(Protocol):
    @property
    def name(self) -> str: ...


class _UkmaDataNamedRow(_NamedRow, Protocol):
    @property
    def removed_at(self) -> object | None: ...


class _LinkedNamedRow(_NamedRow, Protocol):
    @property
    def ukma_data_id(self) -> str | None: ...


def semester_of(term: ud.Term) -> tuple[int, str]:
    """The Rate UKMA semester for a UKMA Data term (M14)."""
    if term.season == ud.Season.fall:
        return term.academic_year, term.season
    return term.academic_year + 1, term.season


def exam_type_of(control: str | None) -> str:
    """The Rate UKMA exam type for a UKMA Data control (M7)."""
    return "CREDIT" if control == "pass_fail" else "EXAM"


def academic_year_of(year: int, term: str) -> int:
    """The academic year a Rate UKMA semester belongs to."""
    return year if term == "FALL" else year - 1


def match_offerings(ud: UkmaDataSnapshot, ru: RateUkmaSnapshot) -> dict[str, str]:
    """UKMA Data offering id -> Rate UKMA offering id (M1).

    The САЗ code only matches an offering not yet linked, so a row linked to one
    UKMA Data offering is never claimed by another.
    """
    by_ukma_data_id: dict[str, str] = {}
    by_code: dict[str, str] = {}
    for offering_id, offering in ru.offerings.items():
        if offering.ukma_data_id is not None:
            by_ukma_data_id[offering.ukma_data_id] = offering_id
        else:
            by_code[offering.code] = offering_id

    matches: dict[str, str] = {}
    for ud_offering in ud.offerings.values():
        if ud_offering.removed_at is not None:
            continue
        rate_ukma_id = by_ukma_data_id.get(ud_offering.id)
        if rate_ukma_id is None:
            rate_ukma_id = by_code.get(ud_offering.saz_code)
        if rate_ukma_id is not None:
            matches[ud_offering.id] = rate_ukma_id
    return matches


def resolve_course(ud: UkmaDataSnapshot, course_id: str) -> str | None:
    """Follow ``mergedInto`` to the course that now holds this one's offerings, or None
    when that course is removed (M6 ignores removed courses)."""
    seen: set[str] = set()
    current: str | None = course_id
    while current is not None:
        if current in seen:
            return None
        seen.add(current)
        course = ud.courses.get(current)
        if course is None:
            return None
        if course.merged_into is None:
            return current if course.removed_at is None else None
        current = course.merged_into
    return None


def course_majority(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    offering_match: dict[str, str],
) -> dict[str, str]:
    """Rate UKMA course id -> the UKMA Data course holding most of its matches (M2);
    a tie keeps the stored link, else the smallest id."""
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    for ud_offering_id, ru_offering_id in offering_match.items():
        ud_offering = ud.offerings.get(ud_offering_id)
        ru_offering = ru.offerings.get(ru_offering_id)
        if ud_offering is None or ud_offering.course_id is None or ru_offering is None:
            continue
        ud_course_id = resolve_course(ud, ud_offering.course_id)
        if ud_course_id is None:
            continue
        counts[ru_offering.course_id][ud_course_id] += 1

    def pick(ru_course_id: str, course_counts: Counter[str]) -> str:
        # A tie keeps the stored link, so an even split does not ask to relink every night.
        course = ru.courses.get(ru_course_id)
        stored = (
            resolve_course(ud, course.ukma_data_id)
            if course is not None and course.ukma_data_id is not None
            else None
        )
        return min(course_counts, key=lambda ud_id: (-course_counts[ud_id], ud_id != stored, ud_id))

    return {
        ru_course_id: pick(ru_course_id, course_counts)
        for ru_course_id, course_counts in sorted(counts.items())
    }


def courses_by_ud(majority: dict[str, str]) -> dict[str, list[str]]:
    """Invert ``course_majority``: UKMA Data course id -> sorted Rate UKMA course ids."""
    grouped: dict[str, list[str]] = defaultdict(list)
    for ru_course_id, ud_course_id in majority.items():
        grouped[ud_course_id].append(ru_course_id)
    return {ud_course_id: sorted(grouped[ud_course_id]) for ud_course_id in sorted(grouped)}


def match_departments(ud: UkmaDataSnapshot, ru: RateUkmaSnapshot) -> dict[str, str]:
    """UKMA Data department id -> Rate UKMA department id (M10)."""
    return _match_by_name(ud.departments, ru.departments)


def match_faculties(ud: UkmaDataSnapshot, ru: RateUkmaSnapshot) -> dict[str, str]:
    """UKMA Data faculty id -> Rate UKMA faculty id (M10)."""
    return _match_by_name(ud.faculties, ru.faculties)


def _match_by_name(
    ud_rows: Mapping[str, _UkmaDataNamedRow],
    ru_rows: Mapping[str, _LinkedNamedRow],
) -> dict[str, str]:
    """Removed UKMA Data rows never match, so they cannot take a row from a live namesake."""
    live = {ud_id: row for ud_id, row in ud_rows.items() if row.removed_at is None}
    by_ukma_data_id: dict[str, str] = {}
    by_name: dict[str, str] = {}
    ambiguous: set[str] = {
        name for name, count in Counter(row.name for row in live.values()).items() if count > 1
    }
    for row_id, row in ru_rows.items():
        if row.ukma_data_id is not None:
            by_ukma_data_id[row.ukma_data_id] = row_id
            continue
        if row.name in by_name:
            ambiguous.add(row.name)
        else:
            by_name[row.name] = row_id

    matches: dict[str, str] = {}
    for ud_id, ud_row in live.items():
        target = by_ukma_data_id.get(ud_id)
        if target is None and ud_row.name not in ambiguous:
            target = by_name.get(ud_row.name)
        if target is not None:
            matches[ud_id] = target
    return matches


def offering_skip_reason(offering: ud.Offering) -> str | None:
    """Why Rate UKMA cannot store this offering, or None when it can (M8)."""
    if not offering.terms:
        return NO_TERM

    credits = [Decimal(str(term.credits)) for term in offering.terms]
    if any(value <= 0 for value in credits):
        return ZERO_CREDITS
    if any(value > MAX_CREDITS or _has_more_than_one_decimal(value) for value in credits):
        return CREDITS_OUT_OF_RANGE
    if len(offering.title) > MAX_NAME:
        return TITLE_TOO_LONG
    if len(offering.saz_code) != 6:
        return BAD_SAZ_CODE
    if offering.department_id is None:
        return NO_DEPARTMENT
    return None


def _has_more_than_one_decimal(value: Decimal) -> bool:
    exponent = value.as_tuple().exponent
    return isinstance(exponent, int) and exponent < -1
