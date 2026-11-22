"""What a change-group row changes, as field and value pairs the review screen groups.

A ``change_offering`` keeps most of its fields inside ``terms``, so the pairs are
read per term matched by semester; a semester or year move is its own pair. A
pair whose new value is empty blanks a field the site shows, and such a change
is reviewed apart from the rest.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping
from typing import Any, cast

from django.db.models import QuerySet

from rating_app.models import SyncChange, SyncChangeGroup
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.matching import academic_year_of

TERM_FIELDS: tuple[str, ...] = (
    "practice_type",
    "practice_count",
    "credits",
    "lecture_count",
    "weekly_hours",
    "exam_type",
)
OTHER_FIELD = "other"
TOP_PAIRS = 4

CHANGE_KINDS: frozenset[str] = frozenset(
    kind.name for kind in KIND_BY_NAME.values() if kind.group == SyncChangeGroup.CHANGE
)

FieldPair = tuple[str, str, str]


def _dict(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _list(value: object) -> list[object]:
    return cast(list[object], value) if isinstance(value, list) else []


def value_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        payload = cast(dict[str, Any], value)
        return str(payload.get("name") or payload.get("title") or "")
    if isinstance(value, list):
        return str(len(cast(list[object], value)))
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _term_key(term: Mapping[str, Any]) -> tuple[str, str]:
    return str(term.get("year")), str(term.get("term"))


def _term_pairs(after_terms: object, before_terms: object) -> set[FieldPair]:
    before = {_term_key(_dict(term)): _dict(term) for term in _list(before_terms)}
    pairs: set[FieldPair] = set()
    for row in _list(after_terms):
        term = _dict(row)
        old = before.get(_term_key(term))
        if old is None:
            continue
        for name in TERM_FIELDS:
            new_value = value_text(term.get(name))
            old_value = value_text(old.get(name))
            if new_value != old_value:
                pairs.add((name, old_value, new_value))
    return pairs


def _semester_pairs(after: object, before: object) -> set[FieldPair]:
    new, old = _dict(after), _dict(before)
    pairs: set[FieldPair] = set()
    for name, key in (("year", "year"), ("term", "term")):
        new_value, old_value = value_text(new.get(key)), value_text(old.get(key))
        if old and new_value != old_value:
            pairs.add((name, old_value, new_value))
    return pairs


def value_pairs(after: Mapping[str, Any], before: Mapping[str, Any]) -> list[FieldPair]:
    """Each field and value pair a change sets, once per change."""
    pairs: set[FieldPair] = set()
    for name, value in after.items():
        if name == "display":
            continue
        if name == "terms":
            pairs |= _term_pairs(value, before.get("terms"))
        elif name == "semester":
            pairs |= _semester_pairs(value, before.get("semester"))
        elif name == "specialities_added":
            pairs.add(("specialities", "", value_text(value)))
        else:
            old_value, new_value = value_text(before.get(name)), value_text(value)
            if old_value != new_value:
                pairs.add((name, old_value, new_value))
    if not pairs:
        pairs.add((OTHER_FIELD, "", ""))
    return sorted(pairs)


def is_blanking(pair: FieldPair) -> bool:
    _, old_value, new_value = pair
    return old_value != "" and new_value == ""


def matches(pairs: Iterable[FieldPair], field: str | None, blanks: bool | None) -> bool:
    rows = list(pairs)
    blanking = any(is_blanking(pair) for pair in rows)
    if blanks is not None and blanking != blanks:
        return False
    if field is None:
        return True
    if blanks:
        return any(pair[0] == field and is_blanking(pair) for pair in rows)
    return any(pair[0] == field for pair in rows)


def change_pairs(changes: QuerySet[SyncChange]) -> dict[int, list[FieldPair]]:
    rows = changes.filter(kind__in=CHANGE_KINDS).values_list("id", "after", "before")
    return {
        int(change_id): value_pairs(_dict(after), _dict(before))
        for change_id, after, before in rows
    }


def field_ids(changes: QuerySet[SyncChange], field: str | None, blanks: bool | None) -> set[int]:
    return {
        change_id
        for change_id, pairs in change_pairs(changes).items()
        if matches(pairs, field, blanks)
    }


def _rows(fields: Counter[str], pairs: dict[str, Counter[FieldPair]]) -> list[dict[str, Any]]:
    return [
        {
            "field": name,
            "count": count,
            "pairs": [
                {"before": before, "after": after, "count": pair_count}
                for (_, before, after), pair_count in sorted(
                    pairs[name].items(), key=lambda item: (-item[1], item[0])
                )[:TOP_PAIRS]
            ],
        }
        for name, count in sorted(fields.items(), key=lambda item: (-item[1], item[0]))
    ]


def field_rows(
    pairs_by_change: Mapping[int, list[FieldPair]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Rows of the updated-data screen: changes that blank nothing, per field, and
    changes that blank a field, per blanked field."""
    fields: Counter[str] = Counter()
    blank_fields: Counter[str] = Counter()
    pairs: dict[str, Counter[FieldPair]] = defaultdict(Counter)
    blank_pairs: dict[str, Counter[FieldPair]] = defaultdict(Counter)
    for rows in pairs_by_change.values():
        blanking = [pair for pair in rows if is_blanking(pair)]
        if blanking:
            for name in {pair[0] for pair in blanking}:
                blank_fields[name] += 1
            for pair in blanking:
                blank_pairs[pair[0]][pair] += 1
            continue
        for name in {pair[0] for pair in rows}:
            fields[name] += 1
        for pair in rows:
            pairs[pair[0]][pair] += 1
    return _rows(fields, pairs), _rows(blank_fields, blank_pairs)


def semester_year(after: Mapping[str, Any]) -> int | None:
    """The academic year of the semester a change's row is in, when it has one."""
    semester = _dict(after.get("semester"))
    year = semester.get("year")
    if not isinstance(year, int):
        return None
    return academic_year_of(year, str(semester.get("term") or ""))


def year_ids(changes: QuerySet[SyncChange], year_from: int | None, year_to: int | None) -> set[int]:
    ids: set[int] = set()
    for change_id, after in changes.values_list("id", "after"):
        year = semester_year(_dict(after))
        if year is None:
            continue
        if year_from is not None and year < year_from:
            continue
        if year_to is not None and year > year_to:
            continue
        ids.add(int(change_id))
    return ids
