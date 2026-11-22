"""Propose catalog changes and removals from UKMA Data (M7, M9-M12).

Pure over the two snapshots. A change carries only the fields that differ and
its ``before`` comes from ``make_before``, so an apply can tell whether it is
still fresh. Keys follow the key contract: a change's key is the Rate UKMA id of
the row it changes.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Sequence
from decimal import Decimal

from rating_app.application_schemas import ukma_data_api as ukma_data
from rating_app.sync.catalog.common import (
    CatalogIndex,
    course_display,
    make_draft,
    sorted_drafts,
    sorted_skips,
)
from rating_app.sync.constants import IDENTITY_COLLISION, MAX_NAME, NO_TERM, TITLE_TOO_LONG
from rating_app.sync.current_values import current_values
from rating_app.sync.drafts import ChangeDraft, DecisionView
from rating_app.sync.matching import (
    academic_year_of,
    exam_type_of,
    match_departments,
    match_faculties,
    match_offerings,
    offering_skip_reason,
    resolve_course,
    semester_of,
)
from rating_app.sync.snapshot import RateUkmaSnapshot, RuCourse, RuOffering, UkmaDataSnapshot

_TERM_RANK = {"FALL": 1, "SPRING": 2, "SUMMER": 3}


def propose_changes(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    decisions: Sequence[DecisionView],
    *,
    academic_year: int,
) -> tuple[list[ChangeDraft], dict[str, list[str]]]:
    """Changes and removals, plus the ids skipped per reason.

    ``decisions`` answers mapping questions, which the mapping builder proposes;
    these kinds never read them. Sorted by the registry's kind order, then key,
    so two runs over the same snapshots write the same rows.
    """
    del decisions
    index = CatalogIndex.build(ru)
    offering_match = match_offerings(ud, ru)
    departments = match_departments(ud, ru)
    skipped: dict[str, list[str]] = defaultdict(list)

    drafts: list[ChangeDraft] = [
        *_faculty_changes(index, ud, skipped),
        *_department_changes(index, ud, skipped),
        *_course_changes(index, ud, departments, offering_match, academic_year, skipped),
        *_offering_changes(index, ud, offering_match, skipped),
        *_removed_courses(index, ud),
        *_removed_offerings(index, ud, set(offering_match.values())),
    ]
    return sorted_drafts(drafts), sorted_skips(skipped)


def _faculty_changes(
    index: CatalogIndex, ud: UkmaDataSnapshot, skipped: dict[str, list[str]]
) -> list[ChangeDraft]:
    ru = index.ru
    drafts = []
    for ud_id, ru_id in sorted(match_faculties(ud, ru).items()):
        ud_faculty = ud.faculties[ud_id]
        if ud_faculty.name == ru.faculties[ru_id].name:
            continue
        if len(ud_faculty.name) > MAX_NAME:
            skipped[TITLE_TOO_LONG].append(ru_id)
            continue
        after: dict[str, object] = {"name": ud_faculty.name}
        drafts.append(
            make_draft(
                index,
                "change_faculty",
                ru_id,
                ru_id,
                ud_id,
                after,
                {"name": ud_faculty.name},
            )
        )
    return drafts


def _department_changes(
    index: CatalogIndex, ud: UkmaDataSnapshot, skipped: dict[str, list[str]]
) -> list[ChangeDraft]:
    ru = index.ru
    drafts = []
    for ud_id, ru_id in sorted(match_departments(ud, ru).items()):
        ud_department = ud.departments[ud_id]
        if ud_department.name == ru.departments[ru_id].name:
            continue
        if len(ud_department.name) > MAX_NAME:
            skipped[TITLE_TOO_LONG].append(ru_id)
            continue
        after: dict[str, object] = {"name": ud_department.name}
        drafts.append(
            make_draft(
                index,
                "change_department",
                ru_id,
                ru_id,
                ud_id,
                after,
                {"name": ud_department.name},
            )
        )
    return drafts


def _course_changes(
    index: CatalogIndex,
    ud: UkmaDataSnapshot,
    departments: dict[str, str],
    offering_match: dict[str, str],
    academic_year: int,
    skipped: dict[str, list[str]],
) -> list[ChangeDraft]:
    ru = index.ru
    ud_offering_of = {ru_id: ud_id for ud_id, ru_id in offering_match.items()}
    creatable = _creatable_departments(ud, set(match_faculties(ud, ru)), set(departments))

    pending: list[tuple[RuCourse, str, dict[str, object]]] = []
    for course_id in sorted(ru.courses):
        course = ru.courses[course_id]
        if course.ukma_data_id is None:
            continue
        ud_course = ud.courses.get(course.ukma_data_id)
        if ud_course is None or resolve_course(ud, ud_course.id) != ud_course.id:
            continue

        after = _course_after(
            index, ud, course, ud_course, departments, creatable, ud_offering_of, academic_year
        )
        if not after:
            continue
        title = after.get("title")
        if isinstance(title, str) and len(title) > MAX_NAME:
            skipped[TITLE_TOO_LONG].append(course_id)
            continue
        if _identity_collides(index, course, after):
            skipped[IDENTITY_COLLISION].append(course_id)
            continue
        pending.append((course, ud_course.id, after))

    # Two courses changed into one identity would break ``course_identity_unique``.
    targets = Counter(_new_identity(course, after) for course, _, after in pending)
    drafts = []
    for course, ud_course_id, after in pending:
        if _new_identity(course, after) != _identity(course) and (
            targets[_new_identity(course, after)] > 1
        ):
            skipped[IDENTITY_COLLISION].append(course.id)
            continue
        drafts.append(
            make_draft(
                index,
                "change_course",
                course.id,
                course.id,
                ud_course_id,
                after,
                {"course": course_display(index, course)},
                ratings=course.ratings,
                requires=_course_requires(after),
            )
        )
    return drafts


def _creatable_departments(
    ud: UkmaDataSnapshot, matched_faculties: set[str], matched_departments: set[str]
) -> set[str]:
    """UKMA Data departments ``links_and_new`` creates: unmatched, a name that
    fits, under a live faculty that is matched or created in the same run."""
    creatable = set()
    for department in ud.departments.values():
        if department.id in matched_departments or department.removed_at is not None:
            continue
        if len(department.name) > MAX_NAME or department.faculty_id is None:
            continue
        faculty = ud.faculties.get(department.faculty_id)
        if faculty is None or faculty.removed_at is not None:
            continue
        if faculty.id in matched_faculties or len(faculty.name) <= MAX_NAME:
            creatable.add(department.id)
    return creatable


def _course_requires(after: dict[str, object]) -> list[dict[str, str]]:
    """A department the course moves to is created in the same run (M10)."""
    department = after.get("department")
    if isinstance(department, dict) and department.get("id") == "":
        ud_department_id = department.get("ukma_data_id")
        if isinstance(ud_department_id, str):
            return [{"kind": "new_department", "key": ud_department_id}]
    return []


def _course_after(
    index: CatalogIndex,
    ud: UkmaDataSnapshot,
    course: RuCourse,
    ud_course: ukma_data.Course,
    departments: dict[str, str],
    creatable: set[str],
    ud_offering_of: dict[str, str],
    academic_year: int,
) -> dict[str, object]:
    after: dict[str, object] = {}
    if ud_course.title != course.title:
        after["title"] = ud_course.title

    if ud_course.department_id is not None:
        ud_department = ud.departments.get(ud_course.department_id)
        if ud_department is not None and ud_department.removed_at is None:
            department_id = departments.get(ud_department.id)
            if department_id is None and ud_department.id not in creatable:
                pass  # no builder creates it, so a move there would wait forever
            elif department_id != course.department_id:
                after["department"] = {
                    "id": department_id or "",
                    "ukma_data_id": ud_department.id,
                    "name": ud_department.name,
                }

    level = ud_course.level.value.upper()
    if level != course.education_level:
        after["education_level"] = level

    latest = index.latest_offering(course.id)
    status = _status(latest, academic_year)
    if status != course.status:
        after["status"] = status

    if not course.description and latest is not None:
        ud_offering = ud.offerings.get(ud_offering_of.get(latest.id, ""))
        if ud_offering is not None and ud_offering.annotation:
            after["description"] = ud_offering.annotation
    return after


Identity = tuple[str, str, str]


def _identity(course: RuCourse) -> Identity:
    return (course.title, course.department_id, course.education_level)


def _new_identity(course: RuCourse, after: dict[str, object]) -> Identity:
    """The identity after the change; a department the run creates is keyed by
    its UKMA Data id, so it never equals an existing department's id."""
    title = after.get("title")
    department = after.get("department")
    department_id = course.department_id
    if isinstance(department, dict):
        ref = department.get("id") or f"new:{department.get('ukma_data_id')}"
        department_id = str(ref)
    level = after.get("education_level")
    return (
        title if isinstance(title, str) else course.title,
        department_id,
        level if isinstance(level, str) else course.education_level,
    )


def _identity_collides(index: CatalogIndex, course: RuCourse, after: dict[str, object]) -> bool:
    identity = _new_identity(course, after)
    if identity == _identity(course):
        return False
    return any(other_id != course.id for other_id in index.courses_with_identity(*identity))


def _offering_changes(
    index: CatalogIndex,
    ud: UkmaDataSnapshot,
    offering_match: dict[str, str],
    skipped: dict[str, list[str]],
) -> list[ChangeDraft]:
    ru = index.ru
    drafts = []
    for ud_id in sorted(offering_match):
        ru_id = offering_match[ud_id]
        ud_offering = ud.offerings[ud_id]
        ru_offering = ru.offerings[ru_id]
        reason = offering_skip_reason(ud_offering)
        if reason is not None:
            skipped[reason].append(ru_id)
            continue

        terms = _offering_terms(ud, ud_offering)
        if not terms:
            skipped[NO_TERM].append(ru_id)
            continue
        after = _offering_after(ud, ru, ru_offering, ud_offering, terms)
        if not after:
            continue
        course = ru.courses.get(ru_offering.course_id)
        display: dict[str, object] = (
            {"course": course_display(index, course)} if course is not None else {}
        )
        drafts.append(
            make_draft(
                index,
                "change_offering",
                ru_id,
                ru_id,
                ud_offering.id,
                after,
                display,
                ratings=ru_offering.ratings,
            )
        )
    return drafts


def _offering_after(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    ru_offering: RuOffering,
    ud_offering: ukma_data.Offering,
    terms: list[tuple[tuple[int, str], dict[str, object]]],
) -> dict[str, object]:
    (last_year, last_term), last = terms[-1]
    derived: dict[str, object] = {
        "semester": {"year": last_year, "term": str(last_term)},
        "exam_type": last["exam_type"],
        "study_year": ud_offering.study_year,
        "max_students": ud_offering.max_students,
        "max_groups": ud_offering.max_groups,
        "group_size_min": ud_offering.group_size_min,
        "group_size_max": ud_offering.group_size_max,
        "terms": [payload for _, payload in terms],
    }
    current = current_values("change_offering", ru, ru_offering.id)
    after = {key: value for key, value in derived.items() if current[key] != value}
    added = _specialities_added(ud, ru, ru_offering, ud_offering)
    if added:
        after["specialities_added"] = added
    return after


def _offering_terms(
    ud: UkmaDataSnapshot, offering: ukma_data.Offering
) -> list[tuple[tuple[int, str], dict[str, object]]]:
    rows = []
    for term in offering.terms:
        ud_term = ud.terms.get(term.term_id)
        if ud_term is None:
            return []  # a partial term list would delete a stored term
        semester = semester_of(ud_term)
        rows.append((semester, _term_payload(term, semester)))
    return sorted(rows, key=lambda row: (row[0][0], _TERM_RANK.get(row[0][1], 0)))


def _term_payload(term: ukma_data.OfferingTerm, semester: tuple[int, str]) -> dict[str, object]:
    practice_type, practice_count = _practice(term)
    return {
        "year": semester[0],
        "term": str(semester[1]),
        "credits": _credits(term.credits),
        "weekly_hours": term.hours_per_week or 0,
        "lecture_count": term.lecture_hours,
        "practice_count": practice_count,
        "practice_type": practice_type,
        "exam_type": exam_type_of(term.control),
    }


def _practice(term: ukma_data.OfferingTerm) -> tuple[str, int | None]:
    """The same mapping ``new_offering`` uses, so a fresh row proposes no change."""
    if term.seminar_hours:
        return "SEMINAR", term.seminar_hours
    if term.practice_hours:
        return "PRACTICE", term.practice_hours
    return "", None


def _credits(credits: float | ukma_data.Credits) -> str:
    return f"{Decimal(str(credits)):.1f}"


def _specialities_added(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    ru_offering: RuOffering,
    ud_offering: ukma_data.Offering,
) -> list[dict[str, object]]:
    """Only names Rate UKMA already has; an existing link keeps its kind (M9)."""
    linked = {name for name, _ in ru_offering.specialities}
    added: dict[str, str] = {}
    for link in sorted(ud_offering.programmes, key=lambda row: row.programme_id):
        programme = ud.programmes.get(link.programme_id)
        if programme is None or programme.removed_at is not None:
            continue
        if programme.name not in ru.speciality_names or programme.name in linked:
            continue
        added.setdefault(programme.name, link.kind.value.upper())
    return [{"name": name, "kind": kind} for name, kind in sorted(added.items())]


def _removed_courses(index: CatalogIndex, ud: UkmaDataSnapshot) -> list[ChangeDraft]:
    ru = index.ru
    drafts = []
    for course_id in sorted(ru.courses):
        course = ru.courses[course_id]
        if course.ukma_data_id is None:
            continue
        ud_course = ud.courses.get(course.ukma_data_id)
        if ud_course is not None and resolve_course(ud, ud_course.id) is not None:
            continue
        after: dict[str, object] = {
            "ukma_data_id": course.ukma_data_id,
            "title": course.title,
            "removed_at": ud_course.removed_at if ud_course is not None else None,
        }
        drafts.append(
            make_draft(
                index,
                "removed_course",
                course_id,
                course_id,
                course.ukma_data_id,
                after,
                {"course": course_display(index, course)},
                ratings=course.ratings,
            )
        )
    return drafts


def _removed_offerings(
    index: CatalogIndex, ud: UkmaDataSnapshot, matched: set[str]
) -> list[ChangeDraft]:
    """A linked offering UKMA Data dropped, or an unlinked one whose code it lists
    only as removed. A code UKMA Data never listed is not a removal: its years
    may predate what UKMA Data covers."""
    ru = index.ru
    live_codes = {row.saz_code for row in ud.offerings.values() if row.removed_at is None}
    removed_by_code: dict[str, ukma_data.Offering] = {}
    for row in sorted(ud.offerings.values(), key=lambda row: row.id):
        if row.removed_at is not None and row.saz_code not in live_codes:
            removed_by_code.setdefault(row.saz_code, row)

    drafts = []
    for offering_id in sorted(ru.offerings):
        if offering_id in matched:
            continue
        offering = ru.offerings[offering_id]
        if offering.ukma_data_id is not None:
            ud_offering = ud.offerings.get(offering.ukma_data_id)
            if ud_offering is not None and ud_offering.removed_at is None:
                continue
        else:
            ud_offering = removed_by_code.get(offering.code)
            if ud_offering is None:
                continue

        course = ru.courses.get(offering.course_id)
        title = ""
        if ud_offering is not None:
            title = ud_offering.title
        elif course is not None:
            title = course.title
        after: dict[str, object] = {
            "saz_code": offering.code,
            "title": title,
            "removed_at": ud_offering.removed_at if ud_offering is not None else None,
        }
        drafts.append(
            make_draft(
                index,
                "removed_offering",
                offering_id,
                offering_id,
                ud_offering.id if ud_offering is not None else None,
                after,
                {"course": course_display(index, course)} if course is not None else {},
                ratings=offering.ratings,
            )
        )
    return drafts


def _status(latest: RuOffering | None, academic_year: int) -> str:
    if latest is None:
        return "FINISHED"
    return (
        "ACTIVE"
        if academic_year_of(latest.semester_year, latest.semester_term) >= academic_year
        else "FINISHED"
    )
