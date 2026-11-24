"""What a person sees on /data for one change: the record's name, where it lives, its
semester and only the fields a student would notice, in plain words.

The review table shows this instead of the stored payload, so ids, САЗ codes,
JSON and the stored-but-unshown fields stay out of the row.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from django.db.models import QuerySet

from rating_app.models import SyncChange
from rating_app.sync import fields as field_pairs
from rating_app.sync.console import change_title
from rating_app.sync.review import LINK_KINDS, link_course_is_exact

TERM_WORDS = {"FALL": "Осінь", "SPRING": "Весна", "SUMMER": "Літо"}
EXAM_WORDS = {"EXAM": "іспит", "CREDIT": "залік"}
PRACTICE_WORDS = {"PRACTICE": "практики", "SEMINAR": "семінари"}

VISIBLE_FIELDS: dict[str, str] = {
    "title": "Назва",
    "name": "Назва",
    "department": "Кафедра",
    "credits": "Кредити",
    "exam_type": "Форма контролю",
    "year": "Рік",
    "term": "Семестр",
    "study_year": "Рік навчання",
    "specialities": "Спеціальності",
    "education_level": "Рівень освіти",
    "level": "Рівень",
    "weekly_hours": "Годин на тиждень",
    "lecture_count": "Лекцій",
    "practice_count": "Практичних",
    "practice_type": "Тип практичних",
    "max_students": "Максимум студентів",
    "group_size_min": "Мінімум у групі",
    "group_size_max": "Максимум у групі",
    "max_groups": "Максимум груп",
}

NEW_OFFERING_FIELDS = ("credits", "exam_type")


@dataclass(frozen=True)
class FieldView:
    field: str
    label: str
    before: str
    after: str


@dataclass(frozen=True)
class ChangeView:
    title: str
    place: str | None
    semester: str | None
    rows: list[FieldView] = field(default_factory=list)


def _dict(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _list(value: object) -> list[object]:
    return cast(list[object], value) if isinstance(value, list) else []


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def semester_text(value: object) -> str | None:
    semester = _dict(value)
    term = TERM_WORDS.get(str(semester.get("term") or ""))
    year = semester.get("year")
    if term is None or not isinstance(year, int):
        return None
    return f"{term} {year}"


def credits_text(value: str) -> str:
    try:
        number = Decimal(value)
    except InvalidOperation:
        return value
    return str(number.normalize()) if number == number.to_integral() else str(number)


def value_text(name: str, value: str) -> str:
    if value == "":
        return ""
    if name == "credits":
        return credits_text(value)
    if name == "exam_type":
        return EXAM_WORDS.get(value, value)
    if name == "term":
        return TERM_WORDS.get(value, value)
    if name == "practice_type":
        return PRACTICE_WORDS.get(value, value)
    return value


def _names(value: object) -> str:
    names = [
        name
        for item in _list(value)
        if (name := _text(_dict(item).get("name")) or _text(item)) is not None
    ]
    return ", ".join(names)


def _place(display: Mapping[str, Any]) -> str | None:
    course = _dict(display.get("course"))
    return _text(course.get("department")) or _text(
        _dict(display.get("ukma_course")).get("department")
    )


def _changed_fields(change: SyncChange) -> list[FieldView]:
    after, before = _dict(change.after), _dict(change.before)
    rows: list[FieldView] = []
    for name, old, new in field_pairs.value_pairs(after, before):
        label = VISIBLE_FIELDS.get(name)
        if label is None:
            continue
        if name == "specialities":
            new = _names(after.get("specialities_added") or after.get("specialities"))
            old = ""
        rows.append(FieldView(name, label, value_text(name, old), value_text(name, new)))
    return rows


def _new_offering_fields(after: Mapping[str, Any]) -> list[FieldView]:
    terms = _list(after.get("terms"))
    last = _dict(terms[-1]) if terms else {}
    rows = []
    for name in NEW_OFFERING_FIELDS:
        value = last.get(name, after.get(name))
        if value in (None, ""):
            continue
        rows.append(FieldView(name, VISIBLE_FIELDS[name], "", value_text(name, str(value))))
    return rows


def _link_fields(change: SyncChange, after: Mapping[str, Any]) -> list[FieldView]:
    if change.kind != "link_course" or link_course_is_exact(dict(after)):
        return []
    ukma_course = _dict(_dict(after.get("display")).get("ukma_course"))
    title = _text(ukma_course.get("title"))
    return [] if title is None else [FieldView("title", "Назва в САЗ", "", title)]


def change_view(change: SyncChange) -> ChangeView:
    after, before = _dict(change.after), _dict(change.before)
    display = _dict(after.get("display")) or _dict(before.get("display"))
    semester = semester_text(before.get("semester")) or semester_text(after.get("semester"))
    if change.kind in LINK_KINDS:
        rows = _link_fields(change, after)
    elif change.kind == "new_offering":
        rows = _new_offering_fields(after)
    elif change.group == "change":
        rows = _changed_fields(change)
    else:
        rows = []
    return ChangeView(
        title=change_title(change),
        place=_place(display),
        semester=semester,
        rows=rows,
    )


def field_counts(changes: QuerySet[SyncChange]) -> dict[str, int]:
    """Field-change rows per field a student sees, for the review screen's filter."""
    counts: Counter[str] = Counter()
    for pairs in field_pairs.change_pairs(changes).values():
        counts.update({name for name, _, _ in pairs if name in VISIBLE_FIELDS})
    return dict(counts.most_common())
