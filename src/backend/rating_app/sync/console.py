"""Plain Ukrainian words for `manage.py catalog_sync`.

Every line fits a 100-column terminal. The JSON shapes here are what the
`--json` flag prints, so a Claude session can parse them.
"""

from __future__ import annotations

import datetime
from collections.abc import Iterable, Mapping
from typing import Any, cast
from zoneinfo import ZoneInfo

from django.utils import timezone

from rating_app.models import SyncChange, SyncChangeState
from rating_app.sync import fields as field_pairs
from rating_app.sync.answers import ANSWERS_BY_KIND, MAPPING_KINDS
from rating_app.sync.decisions import ChangeOutcome, DecisionResult
from rating_app.sync.questions import Question

WIDTH = 100
VALUE_WIDTH = 36
KYIV = ZoneInfo("Europe/Kyiv")

GROUP_LABELS: dict[str, str] = {
    "new": "Нові записи",
    "link": "Зв'язки",
    "change": "Зміни",
    "mapping": "Питання",
    "removed": "Зникли з САЗ",
    "other": "Інше",
}

GROUP_HINTS: dict[str, str] = {
    "new": "записи САЗ, яких ще немає на сайті; після застосування з'являться",
    "link": "той самий запис є і на сайті, і в САЗ; застосування лише запам'ятовує зв'язок",
    "change": "САЗ змінив поле запису, що вже є на сайті",
    "mapping": "САЗ і сайт групують курси по-різному; спершу потрібна відповідь",
    "removed": "запис зник із САЗ; сайт його не видаляє, застосування лише позначає",
    "other": "зміни викладачів та інші, що не входять у групи вище",
}

KIND_LABELS: dict[str, str] = {
    "new_faculty": "Новий факультет",
    "link_faculty": "Факультет",
    "change_faculty": "Факультет",
    "new_department": "Нова кафедра",
    "link_department": "Кафедра",
    "change_department": "Кафедра",
    "new_course": "Новий курс",
    "link_course": "Курс",
    "change_course": "Курс",
    "new_offering": "Новий курс у семестрі",
    "link_offering": "Курс у семестрі",
    "change_offering": "Курс у семестрі",
    "teacher_created": "Новий викладач",
    "teacher_link_added": "Доданий викладач",
    "teacher_link_removed": "Прибраний викладач",
    "relink_course": "Переприв'язати курс?",
    "place_offering": "До якого курсу прикріпити курс у семестрі?",
    "move_offering": "Перенести курс у семестрі?",
    "merge_courses": "Об'єднати курси?",
    "removed_course": "Курс зник з САЗ",
    "removed_offering": "Курс у семестрі зник з САЗ",
}

POLICY_LABELS: dict[str, str] = {
    "new_faculty": "Нові факультети",
    "link_faculty": "Зв'язки факультетів",
    "change_faculty": "Зміни факультетів",
    "new_department": "Нові кафедри",
    "link_department": "Зв'язки кафедр",
    "change_department": "Зміни кафедр",
    "new_course": "Нові курси",
    "link_course": "Зв'язки курсів",
    "change_course": "Зміни курсів",
    "new_offering": "Нові курси в семестрі",
    "link_offering": "Зв'язки курсів у семестрі",
    "change_offering": "Зміни курсів у семестрі",
    "teacher_created": "Нові викладачі",
    "teacher_link_added": "Додані викладачі",
    "teacher_link_removed": "Прибрані викладачі",
    "relink_course": "Переприв'язка курсів",
    "place_offering": "Курси в семестрі без курсу",
    "move_offering": "Перенесення курсів у семестрі",
    "merge_courses": "Об'єднання курсів",
    "removed_course": "Курси, що зникли з САЗ",
    "removed_offering": "Курси в семестрі, що зникли",
}

FIELD_LABELS: dict[str, str] = {
    "name": "назва",
    "title": "назва",
    "department": "кафедра",
    "education_level": "рівень освіти",
    "level": "рівень",
    "status": "стан",
    "description": "опис",
    "year": "рік",
    "term": "семестр",
    "exam_type": "форма контролю",
    "study_year": "рік навчання",
    "max_students": "макс. студентів",
    "max_groups": "макс. груп",
    "group_size_min": "мін. у групі",
    "group_size_max": "макс. у групі",
    "credits": "кредити",
    "weekly_hours": "годин на тиждень",
    "lecture_count": "лекцій",
    "practice_count": "практик",
    "practice_type": "тип практик",
    "specialities": "спеціальності",
    "terms": "семестри",
    "saz_code": "код САЗ",
    "ukma_data_id": "id в UKMA Data",
    "majority_share": "частка збігу",
    "faculty_ukma_id": "факультет в UKMA Data",
    "department_ukma_id": "кафедра в UKMA Data",
    "course_id": "курс",
    "course_ukma_id": "курс в UKMA Data",
    "candidates": "курси-кандидати",
    "from_course": "з курсу",
    "to_course_id": "до курсу",
    "to_course_ukma_id": "до курсу в UKMA Data",
    "ukma_course_id": "курс в UKMA Data",
    "merge_source": "джерело об'єднання",
    "email": "пошта",
    "teacher_email": "пошта викладача",
    "last_name": "прізвище",
    "first_name": "ім'я",
    "middle_name": "по батькові",
    "role": "роль",
    "instructor_id": "викладач",
    "removed_at": "зник з САЗ",
    "other": "інше",
}

STATE_REASON_TEXT: dict[str, str] = {
    "replaced": "замінена новішою зміною",
    "stale": "запис на сайті вже інший, ніж бачило читання САЗ",
    "exists": "такий запис уже є на сайті",
    "identity_collision": "два записи з однаковою назвою й кафедрою",
    "dependency_rejected": "відхилено зміну, від якої вона залежить",
}

SKIP_REASON_TEXT: dict[str, str] = {
    "no_term": "немає семестру",
    "zero_credits": "нуль кредитів",
    "credits_out_of_range": "кредити поза межами",
    "title_too_long": "задовга назва",
    "bad_saz_code": "некоректний код САЗ",
    "no_department": "немає кафедри",
    "unknown_programme": "невідома освітня програма",
    "identity_collision": "два записи з однаковою назвою й кафедрою",
}

MODE_TEXT: dict[str, str] = {
    "needs_approval": "потребує рішення",
    "auto": "авто",
}


def plural(count: int, one: str, few: str, many: str) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return one
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return few
    return many


def number(count: int) -> str:
    return f"{count:,}".replace(",", " ")


def changes_word(count: int) -> str:
    return f"{number(count)} {plural(count, 'зміна', 'зміни', 'змін')}"


def changes_accusative(count: int) -> str:
    return f"{number(count)} {plural(count, 'зміну', 'зміни', 'змін')}"


def decisions_word(count: int) -> str:
    return f"{number(count)} {plural(count, 'рішення', 'рішення', 'рішень')}"


def questions_word(count: int) -> str:
    return f"{number(count)} {plural(count, 'питання', 'питання', 'питань')}"


def ratings_word(count: int) -> str:
    return f"{number(count)} {plural(count, 'оцінка', 'оцінки', 'оцінок')}"


def ago(moment: datetime.datetime | None, now: datetime.datetime | None = None) -> str:
    """«3 год тому» with the Kyiv date and time after it: «3 год тому (22.11 06:55)»."""
    if moment is None:
        return "ніколи"
    seconds = max(0, int(((now or timezone.now()) - moment).total_seconds()))
    if seconds < 3600:
        minutes = max(1, seconds // 60)
        relative = f"{minutes} хв тому"
    elif seconds < 48 * 3600:
        relative = f"{seconds // 3600} год тому"
    else:
        days = seconds // 86400
        relative = f"{days} {plural(days, 'день', 'дні', 'днів')} тому"
    return f"{relative} ({stamp(moment)})"


def stamp(moment: datetime.datetime) -> str:
    return moment.astimezone(KYIV).strftime("%d.%m %H:%M")


def clip(text: str, width: int = VALUE_WIDTH) -> str:
    text = " ".join(text.split())
    return text if len(text) <= width else text[: width - 1] + "…"


def _dict(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _list(value: object) -> list[object]:
    return cast(list[object], value) if isinstance(value, list) else []


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def change_title(change: SyncChange) -> str:
    """The name a person recognises: a teacher, a course title, a faculty name."""
    after, before = _dict(change.after), _dict(change.before)
    display = _dict(after.get("display")) or _dict(before.get("display"))
    teacher = _text(_dict(display.get("teacher")).get("name"))
    course = _text(_dict(display.get("course")).get("title"))
    ukma = _text(_dict(display.get("ukma_course")).get("title"))
    courses = [
        title for row in _list(display.get("courses")) if (title := _text(_dict(row).get("title")))
    ]
    for candidate in (teacher, course, _text(display.get("name")), ukma):
        if candidate is not None:
            return candidate
    if courses:
        return courses[0] if len(courses) == 1 else f"{courses[0]} та ще {len(courses) - 1}"
    title = (
        _text(before.get("title"))
        or _text(before.get("name"))
        or _text(after.get("title"))
        or _text(after.get("name"))
    )
    if title is not None:
        return title
    code = _text(after.get("saz_code"))
    return f"САЗ {code}" if code else change.key


def saz_codes(change: SyncChange) -> list[str]:
    after = _dict(change.after)
    code = _text(after.get("saz_code"))
    if code:
        return [code]
    display = _dict(after.get("display"))
    return [str(item) for item in _list(_dict(display.get("course")).get("saz_codes"))][:3]


def field_rows(change: SyncChange) -> list[tuple[str, str, str]]:
    """Each field the change sets, old and new value, as the review screen pairs them."""
    pairs = field_pairs.value_pairs(_dict(change.after), _dict(change.before))
    return [pair for pair in pairs if pair[0] != field_pairs.OTHER_FIELD]


def field_text(name: str, old: str, new: str) -> str:
    label = FIELD_LABELS.get(name, name)
    if old == "":
        return f"{label}: «{clip(new)}»"
    if new == "":
        return f"{label}: «{clip(old)}» → (порожньо)"
    return f"{label}: «{clip(old)}» → «{clip(new)}»"


def change_lines(change: SyncChange, *, max_fields: int = 6, with_state: bool = True) -> list[str]:
    """`#48121  Курс «…» (САЗ 245810) · 12 оцінок`, then one line per field."""
    codes = saz_codes(change)
    kind = KIND_LABELS.get(change.kind, change.kind)
    head = f"#{change.pk}  {kind} «{clip(change_title(change), 48)}»"
    if codes:
        head += f" (САЗ {', '.join(codes)})"
    if change.ratings:
        head += f" · {ratings_word(change.ratings)}"
    lines = [head[:WIDTH]]
    rows = field_rows(change)
    for name, old, new in rows[:max_fields]:
        lines.append(f"    {field_text(name, old, new)}"[:WIDTH])
    if len(rows) > max_fields:
        lines.append(f"    і ще {len(rows) - max_fields} полів")
    if not with_state:
        return lines
    if change.state != SyncChangeState.PROPOSED:
        lines.append(f"    стан: {state_text(change.state, change.state_reason)}")
    elif change.waiting_on:
        lines.append(f"    чекає на зміни {_ids(_list(change.waiting_on))}")
    return lines


def question_lines(question: Question) -> list[str]:
    """A mapping question with every course it touches and the answers it takes."""
    change = question.change
    head = f"#{change.pk}  {KIND_LABELS.get(change.kind, change.kind)}"
    if question.ratings or question.plans:
        head += f" · {ratings_word(question.ratings)}, планів {question.plans}"
    else:
        head += " · без оцінок"
    lines = [head]
    if question.offering:
        offering = question.offering
        lines.append(
            f"    курс у семестрі: САЗ {offering.get('saz_code')}, "
            f"{offering.get('year')} {offering.get('term')}"
        )
    for course in question.courses:
        mark = " ← пропонуємо лишити" if course["id"] == question.suggested_into else ""
        lines.append(
            f"    «{clip(str(course['title']), 40)}» ({clip(str(course['department'] or '—'), 24)})"
            f" · {ratings_word(int(course['ratings']))}{mark}"[:WIDTH]
        )
        lines.append(f"      id {course['id']}")
    choices = " | ".join(sorted(ANSWERS_BY_KIND.get(change.kind, ())))
    hint = " --into <id курсу>" if change.kind in {"place_offering", "merge_courses"} else ""
    lines.append(f"    відповіді: {choices}{hint}")
    if question.answer:
        answer = question.answer
        lines.append(f"    відповідь уже є: {answer['answer']}, {ago(answer.get('decided_at'))}")
    return lines


def state_text(state: str, reason: str = "") -> str:
    labels = {
        "proposed": "чекає рішення",
        "applied": "застосовано",
        "rejected": "відхилено",
        "superseded": "неактуальна",
    }
    text = labels.get(state, state)
    if reason:
        text += f": {STATE_REASON_TEXT.get(reason, reason)}"
    return text


def _ids(values: Iterable[object], limit: int = 8) -> str:
    items = [f"#{value}" for value in values]
    shown = ", ".join(items[:limit])
    return shown + (f" і ще {len(items) - limit}" if len(items) > limit else "")


def change_json(change: SyncChange) -> dict[str, Any]:
    return {
        "id": change.pk,
        "run_id": change.run_id,
        "group": change.group,
        "kind": change.kind,
        "state": change.state,
        "state_reason": change.state_reason,
        "title": change_title(change),
        "saz_codes": saz_codes(change),
        "ratings": change.ratings,
        "fields": [{"field": n, "before": o, "after": a} for n, o, a in field_rows(change)],
        "waiting_on": change.waiting_on,
        "answers": sorted(ANSWERS_BY_KIND.get(change.kind, ())),
    }


def question_json(question: Question) -> dict[str, Any]:
    change = question.change
    return {
        **change_json(change),
        "courses": [
            {key: value for key, value in course.items() if key != "latest_year"}
            for course in question.courses
        ],
        "plans": question.plans,
        "suggested_into": question.suggested_into,
        "answer": None
        if question.answer is None
        else {**question.answer, "decided_at": str(question.answer.get("decided_at"))},
    }


def kind_breakdown(kinds: Mapping[str, int]) -> str:
    parts = [
        f"{POLICY_LABELS.get(kind, kind).lower()} {number(count)}"
        for kind, count in sorted(kinds.items(), key=lambda item: -item[1])
        if count
    ]
    return ", ".join(parts)


def decision_lines(result: DecisionResult, *, limit: int) -> list[str]:
    """What an apply or reject did or would do: counts per kind, the changes it
    writes with old → new, and every change it leaves with the reason."""
    verb_done = "Застосувало б" if result.dry_run else "Застосовано"
    if result.action == "reject":
        verb_done = "Відхилило б" if result.dry_run else "Відхилено"
    done_state = "rejected" if result.action == "reject" else "applied"
    done = result.decided(done_state)
    kinds: dict[str, int] = {}
    for item in done:
        kinds[item.change.kind] = kinds.get(item.change.kind, 0) + 1
    head = f"{verb_done} {changes_accusative(len(done))}"
    if kinds:
        head += f": {kind_breakdown(kinds)}"
    lines = [head + "."]
    if result.ratings_moved or result.plans_moved:
        verb = "Перенесе" if result.dry_run else "Перенесено"
        lines.append(
            f"{verb} {ratings_word(result.ratings_moved)} і планів {result.plans_moved} "
            "на інші сторінки курсів."
        )
    lines.extend(_listed(done, limit))
    lines.extend(_left_out(result.outcomes, done, limit, dry_run=result.dry_run))
    return lines


def _listed(items: list[ChangeOutcome], limit: int) -> list[str]:
    lines: list[str] = []
    shown = items if limit <= 0 else items[:limit]
    for item in shown:
        lines.extend(
            f"  {line}" for line in change_lines(item.change, max_fields=4, with_state=False)
        )
    if len(items) > len(shown):
        lines.append(f"  … і ще {number(len(items) - len(shown))}. Усі: --limit 0.")
    return lines


def _left_out(
    outcomes: list[ChangeOutcome], done: list[ChangeOutcome], limit: int, *, dry_run: bool
) -> list[str]:
    done_ids = {item.change.pk for item in done}
    reasons: dict[str, list[ChangeOutcome]] = {}
    for item in outcomes:
        if item.change.pk in done_ids:
            continue
        reasons.setdefault(why_left(item), []).append(item)
    if not reasons:
        return ["Пропущено 0, чекають 0."]
    head = "Не увійде:" if dry_run else "Не увійшло:"
    lines = [head if outcomes else "Нічого не вибрано."]
    for reason, items in reasons.items():
        lines.append(f"  {changes_word(len(items))}: {reason}")
        ids = [item.change.pk for item in items]
        lines.append(f"    {_ids(ids, 12 if limit <= 0 else min(limit, 12))}")
    return lines


def why_left(item: ChangeOutcome) -> str:
    """Why a selected change did not apply, in words a newcomer can act on."""
    if item.state == SyncChangeState.SUPERSEDED:
        return "неактуальна, " + STATE_REASON_TEXT.get(item.state_reason, item.state_reason)
    if item.state == SyncChangeState.REJECTED:
        return "уже відхилена"
    if item.state == SyncChangeState.APPLIED:
        return "уже застосована"
    if item.waiting_on:
        return "чекає на інші зміни (спершу застосуйте їх або вкажіть усю групу)"
    if item.change.kind in MAPPING_KINDS:
        return "питання без відповіді: спершу catalog_sync answer"
    return "пропущено цього разу (рядок на сайті змінився або вибірку звужено)"
