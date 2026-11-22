"""Read-only facts about one sync run for the review screen.

Everything here runs in a bounded number of queries: the 33k proposed changes of
a nightly catalog run are read as small value tuples, and `after` is loaded only
for the kinds whose facets need it.
"""

from __future__ import annotations

import hashlib
import uuid
from collections import Counter, defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any, cast

from django.db.models import Count, Q, QuerySet

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    Department,
    PlannedCourse,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncRun,
    SyncRunStatus,
)
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.matching import normalise_title, same_title

LINK_KINDS: frozenset[str] = frozenset(
    kind.name for kind in KIND_BY_NAME.values() if kind.group == SyncChangeGroup.LINK
)
MAPPING_KINDS: frozenset[str] = frozenset(
    kind.name for kind in KIND_BY_NAME.values() if kind.group == SyncChangeGroup.MAPPING
)
NEW_KINDS: frozenset[str] = frozenset(
    kind.name for kind in KIND_BY_NAME.values() if kind.group == SyncChangeGroup.NEW
)
CHANGE_KINDS: frozenset[str] = frozenset(
    kind.name for kind in KIND_BY_NAME.values() if kind.group == SyncChangeGroup.CHANGE
)
_COURSE_KINDS = frozenset({"link_course", "change_course", "relink_course", "removed_course"})
_OFFERING_KINDS = frozenset({"link_offering", "change_offering", "removed_offering"})
_LIST_FIELDS = frozenset({"terms", "specialities_added"})
_ANSWERS: tuple[str, ...] = ("merge", "keep_apart", "keep", "place", "move")

STEP_ORDER: tuple[tuple[str, str], ...] = (
    ("exact_links", SyncChangeGroup.LINK),
    ("rated_questions", SyncChangeGroup.MAPPING),
    ("other_questions", SyncChangeGroup.MAPPING),
    ("review_links", SyncChangeGroup.LINK),
    ("new_rows", SyncChangeGroup.NEW),
    ("field_changes", SyncChangeGroup.CHANGE),
    ("removed", SyncChangeGroup.REMOVED),
)


@dataclass
class ReviewIndex:
    courses: dict[str, dict[str, Any]]
    offering_course: dict[str, str]
    plans: dict[str, int]


@dataclass
class _StepFacts:
    kinds: Counter[str]
    count: int = 0
    rated: int = 0
    ratings: int = 0
    waiting: int = 0
    course_ids: set[str] = field(default_factory=set)


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text or None


def _uuids(values: Iterable[object]) -> set[uuid.UUID]:
    ids: set[uuid.UUID] = set()
    for value in values:
        if value is None:
            continue
        try:
            ids.add(uuid.UUID(str(value)))
        except (ValueError, TypeError):
            continue
    return ids


def _after(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def target_refs(
    kind: str, target_id: str | None, after: dict[str, Any] | None = None
) -> tuple[set[str], set[str]]:
    """The Rate UKMA course ids and offering ids a change touches."""
    payload = after or {}
    courses: set[str] = set()
    offerings: set[str] = set()
    if kind == "new_course":
        return courses, offerings
    if kind == "merge_courses":
        rows = payload.get("courses")
        if isinstance(rows, list):
            for row in cast(list[object], rows):
                if isinstance(row, dict) and (value := _text(row.get("id"))):
                    courses.add(value)
        return courses, offerings
    if kind == "move_offering":
        for key in ("from_course", "to_course_id"):
            if (value := _text(payload.get(key))) is not None:
                courses.add(value)
        if target_id is not None:
            offerings.add(target_id)
        return courses, offerings
    if kind == "place_offering":
        rows = payload.get("candidates")
        if isinstance(rows, list):
            for row in cast(list[object], rows):
                if (value := _text(row)) is not None:
                    courses.add(value)
        return courses, offerings
    if kind == "new_offering":
        if (value := _text(payload.get("course_id"))) is not None:
            courses.add(value)
        return courses, offerings
    if target_id is None:
        return courses, offerings
    if kind in _COURSE_KINDS:
        courses.add(target_id)
    elif kind in _OFFERING_KINDS:
        offerings.add(target_id)
    return courses, offerings


def build_index(course_ids: Iterable[str], offering_ids: Iterable[str]) -> ReviewIndex:
    """Resolve the touched rows in three queries: courses, offerings, plans."""
    offering_course = {
        str(offering_id): str(course_id)
        for offering_id, course_id in CourseOffering.objects.filter(
            pk__in=_uuids(offering_ids)
        ).values_list("id", "course_id")
    }
    course_uuids = _uuids({*course_ids, *offering_course.values()})
    courses = {
        str(row["id"]): {
            "title": row["title"],
            "ukma_data_id": row["ukma_data_id"],
            "department": row["department__name"],
            "faculty_id": str(row["department__faculty_id"]),
        }
        for row in Course.objects.filter(pk__in=course_uuids).values(
            "id", "title", "ukma_data_id", "department__name", "department__faculty_id"
        )
    }
    plans = {
        str(row["offering__course_id"]): int(row["count"])
        for row in PlannedCourse.objects.filter(offering__course_id__in=course_uuids)
        .values("offering__course_id")
        .annotate(count=Count("id"))
    }
    return ReviewIndex(courses=courses, offering_course=offering_course, plans=plans)


def link_course_is_exact(after: dict[str, Any]) -> bool:
    """Same title and a full majority (M2); an old change without a share is review."""
    share = after.get("majority_share")
    if not isinstance(share, (int, float)) or float(share) != 1.0:
        return False
    display = _after(after.get("display"))
    course = _after(display.get("course"))
    ukma_course = _after(display.get("ukma_course"))
    title = course.get("title")
    ukma_title = ukma_course.get("title")
    if not isinstance(title, str) or not isinstance(ukma_title, str):
        return False
    return same_title(title, ukma_title)


def changed_fields(after: dict[str, Any]) -> list[str]:
    return [key for key in after if key != "display"]


def similar_existing_ids(rows: Sequence[tuple[int, dict[str, Any]]]) -> set[int]:
    """A new course whose normalised title exists, in its department or anywhere."""
    if not rows:
        return set()
    anywhere: set[str] = set()
    by_department: set[tuple[str, str]] = set()
    for title, department_id in Course.objects.values_list("title", "department_id"):
        normalised = normalise_title(str(title))
        if not normalised:
            continue
        anywhere.add(normalised)
        by_department.add((normalised, str(department_id)))
    department_ukma_ids = {
        value for _, after in rows if (value := _text(after.get("department_ukma_id"))) is not None
    }
    department_by_ukma = {
        str(ukma_id): str(department_id)
        for ukma_id, department_id in Department.objects.filter(
            ukma_data_id__in=department_ukma_ids
        ).values_list("ukma_data_id", "id")
    }
    similar: set[int] = set()
    for change_id, after in rows:
        title = after.get("title")
        if not isinstance(title, str):
            continue
        normalised = normalise_title(title)
        if not normalised:
            continue
        department_id = department_by_ukma.get(str(after.get("department_ukma_id") or ""))
        if normalised in anywhere or (
            department_id is not None and (normalised, department_id) in by_department
        ):
            similar.add(change_id)
    return similar


def answer_counts(rows: Sequence[dict[str, Any]]) -> dict[str, int]:
    keys = {(str(row["kind"]), str(row["key"])) for row in rows}
    counts = dict.fromkeys(_ANSWERS, 0)
    decisions = CatalogMappingDecision.objects.filter(
        superseded_at__isnull=True, kind__in=MAPPING_KINDS
    ).values_list("kind", "question_key", "answer")
    for kind, question_key, answer in decisions:
        if (kind, question_key) in keys and answer in counts:
            counts[answer] += 1
    return counts


def plan_counts(index: ReviewIndex, course_ids: Iterable[str]) -> int:
    return sum(index.plans.get(course_id, 0) for course_id in course_ids)


def _kind_labels() -> dict[str, str]:
    return {
        "link_faculty": "Факультети",
        "link_department": "Кафедри",
        "link_course": "Курси",
        "link_offering": "Курси в семестрі",
        "new_faculty": "Нові факультети",
        "new_department": "Нові кафедри",
        "new_course": "Нові курси",
        "new_offering": "Нові курси в семестрі",
        "change_faculty": "Зміни факультетів",
        "change_department": "Зміни кафедр",
        "change_course": "Зміни курсів",
        "change_offering": "Зміни курсів у семестрі",
        "teacher_created": "Викладачі",
        "teacher_link_added": "Викладачі",
        "teacher_link_removed": "Викладачі",
        "relink_course": "Переприв'язка курсів",
        "place_offering": "Курси в семестрі без курсу",
        "move_offering": "Перенесення курсів у семестрі",
        "merge_courses": "Об'єднання курсів",
        "removed_course": "Курси, що зникли з САЗ",
        "removed_offering": "Курси в семестрі, що зникли з САЗ",
    }


_GROUP_LABELS: dict[str, str] = {
    SyncChangeGroup.LINK: "Зв'язки",
    SyncChangeGroup.NEW: "Нові записи",
    SyncChangeGroup.CHANGE: "Зміни",
    SyncChangeGroup.MAPPING: "Питання",
    SyncChangeGroup.REMOVED: "Зникли з САЗ",
}
_KIND_LABELS = _kind_labels()


def selection_description(approval: Any) -> str:
    """«Зв'язки, 28 950 змін»: the scope in words and how many changes it held."""
    count = len(approval.change_ids or [])
    group = str(approval.group or "")
    kind = str(approval.kind or "")
    if kind:
        label = _KIND_LABELS.get(kind, kind)
    else:
        label = _GROUP_LABELS.get(group, group or "Зміни")
    return f"{label}, {count} {_changes_word(count)}"


def _changes_word(count: int) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return "зміна"
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return "зміни"
    return "змін"


def scalar_pairs(
    rows: Sequence[tuple[dict[str, Any], dict[str, Any], int]],
) -> dict[str, dict[str, Any]]:
    """Per changed field: how many changes, how many rated, and the top value pairs."""
    facet: dict[str, dict[str, Any]] = {}
    pairs: dict[str, Counter[tuple[str, str]]] = defaultdict(Counter)
    for after, before, ratings in rows:
        for name in changed_fields(after):
            entry = facet.setdefault(name, {"count": 0, "rated": 0, "pairs": pairs[name]})
            entry["count"] += 1
            if ratings > 0:
                entry["rated"] += 1
            if name in _LIST_FIELDS:
                continue
            value = after.get(name)
            old = before.get(name)
            if _is_scalar(value) and _is_scalar(old):
                pairs[name][(_as_text(old), _as_text(value))] += 1
    for entry in facet.values():
        counter = cast(Counter[tuple[str, str]], entry["pairs"])
        entry["top_pairs"] = [
            {"before": before, "after": after, "count": count}
            for (before, after), count in sorted(
                counter.items(), key=lambda item: (-item[1], item[0])
            )[:3]
        ]
        del entry["pairs"]
    return facet


def _is_scalar(value: object) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _as_text(value: object) -> str:
    return "" if value is None else str(value)


def summary_payload(run: SyncRun) -> dict[str, Any]:
    changes = SyncChange.objects.filter(run=run, state=SyncChangeState.PROPOSED)
    base = list(changes.values_list("id", "kind", "target_id", "ratings"))
    link_after = {
        int(row[0]): _after(row[1])
        for row in changes.filter(kind="link_course").values_list("id", "after")
    }
    new_course_after = [
        (int(row[0]), _after(row[1]))
        for row in changes.filter(kind="new_course").values_list("id", "after")
    ]
    new_offering_after = {
        int(row[0]): _after(row[1])
        for row in changes.filter(kind="new_offering").values_list("id", "after")
    }
    mapping_rows = [
        {
            "id": int(row[0]),
            "kind": str(row[1]),
            "key": str(row[2]),
            "target_id": None if row[3] is None else str(row[3]),
            "ratings": int(row[4]),
            "after": _after(row[5]),
        }
        for row in changes.filter(kind__in=MAPPING_KINDS).values_list(
            "id", "kind", "key", "target_id", "ratings", "after"
        )
    ]
    change_rows = {
        int(row[0]): (_after(row[1]), _after(row[2]), int(row[3]))
        for row in changes.filter(kind__in=CHANGE_KINDS).values_list(
            "id", "after", "before", "ratings"
        )
    }
    after_by_id: dict[int, dict[str, Any]] = {**link_after, **new_offering_after}
    after_by_id.update(dict(new_course_after))
    after_by_id.update({row["id"]: row["after"] for row in mapping_rows})

    review_link_ids = {
        change_id for change_id, after in link_after.items() if not link_course_is_exact(after)
    }
    similar_ids = similar_existing_ids(new_course_after)

    refs = [
        target_refs(str(kind), target_id, after_by_id.get(int(change_id)))
        for change_id, kind, target_id, _ in base
    ]
    index = build_index(
        (course for courses, _ in refs for course in courses),
        (offering for _, offerings in refs for offering in offerings),
    )
    mapping_plans = {
        row["id"]: plan_counts(
            index, target_refs(str(row["kind"]), row["target_id"], row["after"])[0]
        )
        for row in mapping_rows
    }
    rated_question_ids = {
        row["id"] for row in mapping_rows if row["ratings"] > 0 or mapping_plans[row["id"]] > 0
    }
    waiting_ids = set(changes.exclude(waiting_on=[]).values_list("id", flat=True))

    facts = {step: _StepFacts(kinds=Counter()) for step, _ in STEP_ORDER}
    for change_id, kind, target_id, ratings in base:
        step = _step_for(kind, change_id, review_link_ids, rated_question_ids)
        entry = facts[step]
        entry.kinds[str(kind)] += 1
        entry.count += 1
        entry.ratings += int(ratings)
        if ratings > 0:
            entry.rated += 1
        if change_id in waiting_ids:
            entry.waiting += 1
        courses, offerings = target_refs(kind, target_id, after_by_id.get(change_id))
        entry.course_ids.update(courses)
        entry.course_ids.update(
            index.offering_course[offering]
            for offering in offerings
            if offering in index.offering_course
        )

    steps = [
        {
            "step": step,
            "group": group,
            "kinds": dict(sorted(facts[step].kinds.items())),
            "count": facts[step].count,
            "rated": facts[step].rated,
            "ratings": facts[step].ratings,
            "plans": plan_counts(index, facts[step].course_ids),
            "waiting": facts[step].waiting,
            "facets": _facets(
                step,
                facts,
                review_link_ids,
                similar_ids,
                change_rows,
            ),
        }
        for step, group in STEP_ORDER
    ]
    return {
        "run": run,
        "newer_run_id": newer_run_id(run),
        "steps": steps,
        "answers": answer_counts(mapping_rows),
        "not_proposed": _not_proposed(run),
    }


def _step_for(
    kind: str, change_id: int, review_link_ids: set[int], rated_question_ids: set[int]
) -> str:
    if kind in LINK_KINDS:
        return "review_links" if change_id in review_link_ids else "exact_links"
    if kind in MAPPING_KINDS:
        return "rated_questions" if change_id in rated_question_ids else "other_questions"
    if kind in NEW_KINDS:
        return "new_rows"
    if kind in CHANGE_KINDS:
        return "field_changes"
    return "removed"


def _facets(
    step: str,
    facts: dict[str, _StepFacts],
    review_link_ids: set[int],
    similar_ids: set[int],
    change_rows: dict[int, tuple[dict[str, Any], dict[str, Any], int]],
) -> dict[str, Any]:
    if step in {"exact_links", "review_links"}:
        link_count = facts["exact_links"].count + facts["review_links"].count
        return {
            "match": {
                "exact": link_count - len(review_link_ids),
                "review": len(review_link_ids),
            }
        }
    if step == "new_rows":
        return {"similar_existing": len(similar_ids)}
    if step == "field_changes":
        return {"fields": scalar_pairs(list(change_rows.values()))}
    return {}


def _not_proposed(run: SyncRun) -> dict[str, dict[str, int]]:
    skipped = run.counts.get("skipped") if isinstance(run.counts, dict) else None
    rated = run.skipped_rated if isinstance(run.skipped_rated, dict) else {}
    if not isinstance(skipped, dict):
        return {}
    return {
        str(reason): {"count": int(count), "rated": int(rated.get(reason, 0))}
        for reason, count in skipped.items()
    }


def newer_run_id(run: SyncRun) -> int | None:
    return (
        SyncRun.objects.filter(
            source=run.source,
            status=SyncRunStatus.SUCCEEDED,
            pk__gt=run.pk,
        )
        .order_by("-pk")
        .values_list("pk", flat=True)
        .first()
    )


def sample_ids(changes: QuerySet[SyncChange], seed: int, per_faculty: int = 20) -> list[int]:
    """Up to `per_faculty` ids per faculty, each bucket ordered by md5(id || seed)."""
    base = list(changes.values_list("id", "kind", "target_id"))
    needs_after = {
        "merge_courses",
        "move_offering",
        "place_offering",
        "new_course",
        "new_offering",
    }
    after_by_id = {
        int(row[0]): _after(row[1])
        for row in changes.filter(kind__in=needs_after).values_list("id", "after")
    }
    new_course_departments = {
        int(change_id): str(after.get("department_ukma_id"))
        for change_id, kind, _ in base
        if kind == "new_course"
        and (after := after_by_id.get(int(change_id))) is not None
        and after.get("department_ukma_id") is not None
    }
    department_faculty = {
        str(ukma_id): str(faculty_id)
        for ukma_id, faculty_id in Department.objects.filter(
            ukma_data_id__in=set(new_course_departments.values())
        ).values_list("ukma_data_id", "faculty_id")
    }
    refs = [
        target_refs(str(kind), target_id, after_by_id.get(int(change_id)))
        for change_id, kind, target_id in base
    ]
    index = build_index(
        (course for courses, _ in refs for course in courses),
        (offering for _, offerings in refs for offering in offerings),
    )
    buckets: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for (change_id, _, _), (courses, offerings) in zip(base, refs, strict=True):
        course_ids = set(courses)
        course_ids.update(
            index.offering_course[offering]
            for offering in offerings
            if offering in index.offering_course
        )
        faculty = next(
            (
                str(index.courses[course_id]["faculty_id"])
                for course_id in sorted(course_ids)
                if course_id in index.courses
            ),
            department_faculty.get(new_course_departments.get(int(change_id), ""), ""),
        )
        digest = hashlib.md5(f"{change_id}{seed}".encode()).hexdigest()
        buckets[faculty].append((digest, int(change_id)))
    sample: list[int] = []
    for faculty in sorted(buckets):
        sample.extend(change_id for _, change_id in sorted(buckets[faculty])[:per_faculty])
    return sample


def match_ids(changes: QuerySet[SyncChange], match: str) -> set[int]:
    review = {
        int(row[0])
        for row in changes.filter(kind="link_course").values_list("id", "after")
        if not link_course_is_exact(_after(row[1]))
    }
    if match == "review":
        return review
    exact = changes.filter(kind__in=LINK_KINDS).exclude(pk__in=review)
    return set(exact.values_list("id", flat=True))


def similar_ids_in(changes: QuerySet[SyncChange], similar: bool) -> set[int]:
    rows = [
        (int(row[0]), _after(row[1]))
        for row in changes.filter(kind="new_course").values_list("id", "after")
    ]
    found = similar_existing_ids(rows)
    if similar:
        return found
    return {
        int(row[0]) for row in changes.filter(kind="new_course").values_list("id", flat=True)
    } - found


def field_ids(changes: QuerySet[SyncChange], field: str | None, subset: str | None) -> set[int]:
    names = {part.strip() for part in (subset or "").split(",") if part.strip()}
    ids: set[int] = set()
    for change_id, after in changes.filter(kind__in=CHANGE_KINDS).values_list("id", "after"):
        changed = set(changed_fields(_after(after)))
        if field is not None and field not in changed:
            continue
        if names and not changed <= names:
            continue
        ids.add(int(change_id))
    return ids


def search_ids(changes: QuerySet[SyncChange], query: str) -> set[int]:
    needle = normalise_title(query)
    ids: set[int] = set()
    if not needle:
        return ids
    for change_id, _kind, after in changes.values_list("id", "kind", "after"):
        if needle in normalise_title(_search_text(_after(after))):
            ids.add(int(change_id))
    return ids


def _search_text(after: dict[str, Any]) -> str:
    parts: list[str] = []
    display = _after(after.get("display"))
    for key in ("title", "name", "saz_code"):
        value = after.get(key)
        if isinstance(value, str):
            parts.append(value)
    for card in (display.get("course"), display.get("ukma_course")):
        payload = _after(card)
        parts.extend(str(payload.get(key) or "") for key in ("title", "department"))
        codes = payload.get("saz_codes")
        if isinstance(codes, list):
            parts.extend(str(code) for code in cast(list[object], codes))
    for card in cast(list[object], display.get("courses") or []):
        payload = _after(card)
        parts.extend(str(payload.get(key) or "") for key in ("title", "department"))
    return " ".join(part for part in parts if part)


def moved_counts(changes: Sequence[SyncChange]) -> tuple[int, int]:
    """Ratings and plans a dry run would move, as the preview and history show them."""
    merge_changes = [change for change in changes if change.kind == "merge_courses"]
    targets = _merge_targets(merge_changes)
    course_ids: set[str] = set()
    offering_ids: set[str] = set()
    ratings = 0
    for change in merge_changes:
        after = _after(change.after)
        target = targets.get(change.pk)
        courses = cast(list[object], after.get("courses") or [])
        for row in courses:
            payload = _after(row)
            course_id = _text(payload.get("id"))
            if course_id is None or course_id == target:
                continue
            course_ids.add(course_id)
            ratings += int(payload.get("ratings") or 0)
    for change in changes:
        if change.kind != "move_offering":
            continue
        if change.target_id is not None:
            offering_ids.add(change.target_id)
        ratings += int(change.ratings or 0)
    plans = PlannedCourse.objects.filter(
        Q(offering__course_id__in=_uuids(course_ids)) | Q(offering_id__in=_uuids(offering_ids))
    ).count()
    return ratings, plans


def _merge_targets(changes: Sequence[SyncChange]) -> dict[int, str | None]:
    keys = {change.key: change.pk for change in changes}
    if not keys:
        return {}
    decisions = CatalogMappingDecision.objects.filter(
        kind="merge_courses", question_key__in=keys
    ).order_by("id")
    targets: dict[int, str | None] = {}
    for question_key, into_ref in decisions.values_list("question_key", "into_ref"):
        targets[keys[question_key]] = into_ref or None
    return targets


def merged_courses(changes: Sequence[SyncChange]) -> list[dict[str, str]]:
    merge_changes = [change for change in changes if change.kind == "merge_courses"]
    targets = _merge_targets(merge_changes)
    from_ids: dict[str, str] = {}
    for change in merge_changes:
        target = targets.get(change.pk)
        if target is None:
            continue
        for row in cast(list[object], _after(change.after).get("courses") or []):
            payload = _after(row)
            course_id = _text(payload.get("id"))
            if course_id is not None and course_id != target:
                from_ids[course_id] = target
    titles = {
        str(course_id): title
        for course_id, title in Course.objects.filter(pk__in=_uuids(from_ids)).values_list(
            "id", "title"
        )
    }
    return [
        {"from_id": from_id, "into_id": into_id, "title": titles.get(from_id, "")}
        for from_id, into_id in sorted(from_ids.items())
    ]
