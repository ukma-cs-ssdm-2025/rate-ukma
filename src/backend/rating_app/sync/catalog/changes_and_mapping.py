"""Propose catalog changes, mapping questions and removals from UKMA Data.

Pure over the two snapshots (M3, M4, M7, M9-M13, M15). Mapping questions carry
in ``after`` everything a later answer records as its premise: the Rate UKMA
course ids and their ratings, the UKMA Data course id and its ``mergeSource``.
A live decision whose premise no longer matches is ignored, so the question is
asked again.

Keys follow the key contract: a change's key is the Rate UKMA id of the row it
changes, except ``merge_courses`` whose key is the UKMA Data course id. A move's
``requires`` names the UKMA Data course its destination must carry, or the new
course the same run creates for it.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from decimal import Decimal

from rating_app.application_schemas import ukma_data_api as ukma_data
from rating_app.sync.constants import IDENTITY_COLLISION, MAX_NAME, NO_TERM, TITLE_TOO_LONG
from rating_app.sync.current_values import current_values
from rating_app.sync.drafts import ChangeDraft, DecisionView, make_before
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.matching import (
    academic_year_of,
    course_majority,
    courses_by_ud,
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
_ANSWERS = {
    "merge_courses": frozenset({"keep_apart", "merge"}),
    "move_offering": frozenset({"keep", "move"}),
    "relink_course": frozenset({"relink"}),
}


def propose_changes_and_mapping(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    decisions: Sequence[DecisionView],
    *,
    academic_year: int,
) -> tuple[list[ChangeDraft], dict[str, list[str]]]:
    """Changes, mapping questions and removals, plus the ids skipped per reason.

    Sorted by the registry's kind order, then key, so two runs over the same
    snapshots write the same rows.
    """
    offering_match = match_offerings(ud, ru)
    majority = course_majority(ud, ru, offering_match)
    departments = match_departments(ud, ru)
    skipped: dict[str, list[str]] = defaultdict(list)

    drafts: list[ChangeDraft] = [
        *_faculty_changes(ud, ru, skipped),
        *_department_changes(ud, ru, skipped),
        *_course_changes(ud, ru, offering_match, departments, academic_year, skipped),
        *_offering_changes(ud, ru, offering_match, skipped),
        *_relink_questions(ud, ru, majority, decisions),
        *_move_questions(ud, ru, majority, offering_match, departments, decisions),
        *_merge_questions(ud, ru, majority, decisions),
        *_removed_courses(ud, ru),
        *_removed_offerings(ud, ru),
    ]
    return _sorted_drafts(drafts), _sorted_skips(skipped)


def _faculty_changes(
    ud: UkmaDataSnapshot, ru: RateUkmaSnapshot, skipped: dict[str, list[str]]
) -> list[ChangeDraft]:
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
            _draft(ru, "change_faculty", ru_id, ru_id, ud_id, after, {"name": ud_faculty.name})
        )
    return drafts


def _department_changes(
    ud: UkmaDataSnapshot, ru: RateUkmaSnapshot, skipped: dict[str, list[str]]
) -> list[ChangeDraft]:
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
            _draft(
                ru, "change_department", ru_id, ru_id, ud_id, after, {"name": ud_department.name}
            )
        )
    return drafts


def _course_changes(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    offering_match: dict[str, str],
    departments: dict[str, str],
    academic_year: int,
    skipped: dict[str, list[str]],
) -> list[ChangeDraft]:
    ud_offering_of = {ru_id: ud_id for ud_id, ru_id in offering_match.items()}
    identities: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for course in ru.courses.values():
        identities[_identity(course.title, course.department_id, course.education_level)].append(
            course.id
        )

    drafts = []
    for course_id in sorted(ru.courses):
        course = ru.courses[course_id]
        if course.ukma_data_id is None:
            continue
        ud_course = ud.courses.get(course.ukma_data_id)
        if ud_course is None or resolve_course(ud, ud_course.id) != ud_course.id:
            continue

        after = _course_after(ud, ru, course, ud_course, departments, ud_offering_of, academic_year)
        if not after:
            continue
        title = after.get("title")
        if isinstance(title, str) and len(title) > MAX_NAME:
            skipped[TITLE_TOO_LONG].append(course_id)
            continue
        if _identity_collides(identities, course, after):
            skipped[IDENTITY_COLLISION].append(course_id)
            continue
        drafts.append(
            _draft(
                ru,
                "change_course",
                course_id,
                course_id,
                ud_course.id,
                after,
                {"course": _course_display(ru, course)},
                ratings=course.ratings,
                requires=_course_requires(after),
            )
        )
    return drafts


def _course_requires(after: dict[str, object]) -> list[dict[str, str]]:
    """A department the course moves to is created in the same run (M10)."""
    department = after.get("department")
    if isinstance(department, dict) and department.get("id") == "":
        ud_department_id = department.get("ukma_data_id")
        if isinstance(ud_department_id, str):
            return [{"kind": "new_department", "key": ud_department_id}]
    return []


def _course_after(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    course: RuCourse,
    ud_course: ukma_data.Course,
    departments: dict[str, str],
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
            if department_id != course.department_id:
                after["department"] = {
                    "id": department_id or "",
                    "ukma_data_id": ud_department.id,
                    "name": ud_department.name,
                }

    level = ud_course.level.value.upper()
    if level != course.education_level:
        after["education_level"] = level

    latest = _latest_offering(ru, course.id)
    status = _status(latest, academic_year)
    if status != course.status:
        after["status"] = status

    if not course.description and latest is not None:
        ud_offering = ud.offerings.get(ud_offering_of.get(latest.id, ""))
        if ud_offering is not None and ud_offering.annotation:
            after["description"] = ud_offering.annotation
    return after


def _identity_collides(
    identities: dict[tuple[str, str, str], list[str]], course: RuCourse, after: dict[str, object]
) -> bool:
    title = after.get("title")
    new_title = title if isinstance(title, str) else course.title
    department = after.get("department")
    new_department_id = course.department_id
    if isinstance(department, dict):
        ref = department.get("id")
        if isinstance(ref, str) and ref:
            new_department_id = ref
    level = after.get("education_level")
    new_level = level if isinstance(level, str) else course.education_level

    new_identity = _identity(new_title, new_department_id, new_level)
    if new_identity == _identity(course.title, course.department_id, course.education_level):
        return False
    return any(other_id != course.id for other_id in identities.get(new_identity, ()))


def _identity(title: str, department_id: str, education_level: str) -> tuple[str, str, str]:
    return title, department_id, education_level


def _offering_changes(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    offering_match: dict[str, str],
    skipped: dict[str, list[str]],
) -> list[ChangeDraft]:
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
            {"course": _course_display(ru, course)} if course is not None else {}
        )
        drafts.append(
            _draft(
                ru,
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
        "semester": {"year": last_year, "term": last_term},
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
            continue
        semester = semester_of(ud_term)
        rows.append((semester, _term_payload(term, semester)))
    return sorted(rows, key=lambda row: (row[0][0], _TERM_RANK.get(row[0][1], 0)))


def _term_payload(term: ukma_data.OfferingTerm, semester: tuple[int, str]) -> dict[str, object]:
    practice_type, practice_count = _practice(term)
    return {
        "year": semester[0],
        "term": semester[1],
        "credits": _credits(term.credits),
        "weekly_hours": term.hours_per_week or 0,
        "lecture_count": term.lecture_hours,
        "practice_count": practice_count,
        "practice_type": practice_type,
        "exam_type": exam_type_of(term.control),
    }


def _practice(term: ukma_data.OfferingTerm) -> tuple[str, int | None]:
    if term.seminar_hours is not None:
        return "SEMINAR", term.seminar_hours
    if term.practice_hours is not None:
        return "PRACTICE", term.practice_hours
    return "PRACTICE", None


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


def _relink_questions(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    majority: dict[str, str],
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    drafts = []
    for course_id in sorted(majority):
        course = ru.courses.get(course_id)
        if course is None or course.ukma_data_id is None:
            continue
        wanted = majority[course_id]
        if wanted == course.ukma_data_id:
            continue
        ud_course = ud.courses.get(wanted)
        if ud_course is None:
            continue
        premise = {
            "course_ids": [course_id],
            "ukma_course_id": wanted,
            "merge_source": _merge_source(ud_course),
            "ratings": course.ratings,
        }
        if _answered(decisions, "relink_course", course_id, premise):
            continue
        after: dict[str, object] = {"ukma_data_id": wanted}
        drafts.append(
            _draft(
                ru,
                "relink_course",
                course_id,
                course_id,
                wanted,
                after,
                {
                    "course": _course_display(ru, course),
                    "ukma_course": _ukma_course_display(ud, ud_course),
                },
                ratings=course.ratings,
            )
        )
    return drafts


def _move_questions(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    majority: dict[str, str],
    offering_match: dict[str, str],
    departments: dict[str, str],
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    groups = courses_by_ud(majority)
    linked: dict[str, list[str]] = defaultdict(list)
    for course in ru.courses.values():
        if course.ukma_data_id is not None:
            linked[course.ukma_data_id].append(course.id)

    drafts = []
    for ud_offering_id in sorted(offering_match):
        ud_offering = ud.offerings[ud_offering_id]
        ru_offering = ru.offerings[offering_match[ud_offering_id]]
        if ud_offering.course_id is None:
            continue
        ud_course_id = resolve_course(ud, ud_offering.course_id)
        if ud_course_id is None:
            continue
        source = ru.courses.get(ru_offering.course_id)
        if source is None:
            continue
        current_link = majority.get(source.id) or source.ukma_data_id
        if current_link is None or current_link == ud_course_id:
            continue

        ud_course = ud.courses[ud_course_id]
        destination = _move_destination(
            ru,
            ud_course,
            source,
            departments,
            linked.get(ud_course_id) or groups.get(ud_course_id, []),
        )
        if destination is None:
            continue
        target_id, after, requires = destination
        premise = {
            "course_ids": [source.id] if target_id is None else [source.id, target_id],
            "ukma_course_id": ud_course_id,
            "merge_source": _merge_source(ud_course),
            "saz_code": ru_offering.code,
            "ratings": ru_offering.ratings,
        }
        if _answered(decisions, "move_offering", ru_offering.id, premise):
            continue

        target = ru.courses.get(target_id) if target_id is not None else None
        display: dict[str, object] = {"ukma_course": _ukma_course_display(ud, ud_course)}
        display["courses"] = [_course_display(ru, source)]
        if target is not None:
            display["courses"] = [
                _course_display(ru, source),
                _course_display(ru, target),
            ]
        drafts.append(
            _draft(
                ru,
                "move_offering",
                ru_offering.id,
                ru_offering.id,
                ud_course_id,
                after,
                display,
                ratings=ru_offering.ratings,
                requires=requires,
            )
        )
    return drafts


def _move_destination(
    ru: RateUkmaSnapshot,
    ud_course: ukma_data.Course,
    source: RuCourse,
    departments: dict[str, str],
    targets: Sequence[str],
) -> tuple[str | None, dict[str, object], list[dict[str, str]]] | None:
    """Where a stray offering goes, or None when several courses compete for it."""
    targets = [target for target in targets if target != source.id]
    link_requires = [{"kind": "link_course", "key": ud_course.id}]
    if len(targets) > 1:
        return None
    if targets:
        return targets[0], {"from_course": source.id, "to_course_id": targets[0]}, link_requires

    if ud_course.department_id is None:
        return None
    target_id = _same_identity_course(ru, ud_course, departments, exclude=source.id)
    if target_id is not None:
        return target_id, {"from_course": source.id, "to_course_id": target_id}, link_requires
    return (
        None,
        {"from_course": source.id, "to_course_ukma_id": ud_course.id},
        [{"kind": "new_course", "key": ud_course.id}],
    )


def _same_identity_course(
    ru: RateUkmaSnapshot,
    ud_course: ukma_data.Course,
    departments: dict[str, str],
    *,
    exclude: str,
) -> str | None:
    """The course a new UKMA Data course links to instead of a new row (M6)."""
    if ud_course.department_id is None:
        return None
    department_id = departments.get(ud_course.department_id)
    if department_id is None:
        return None
    level = ud_course.level.value.upper()
    matches = [
        course.id
        for course in ru.courses.values()
        if course.id != exclude
        and course.title == ud_course.title
        and course.department_id == department_id
        and course.education_level == level
    ]
    return matches[0] if len(matches) == 1 else None


def _merge_questions(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    majority: dict[str, str],
    decisions: Sequence[DecisionView],
) -> list[ChangeDraft]:
    drafts = []
    for ud_id, course_ids in sorted(courses_by_ud(majority).items()):
        if ud_id not in ud.courses:
            continue
        courses = [ru.courses[course_id] for course_id in course_ids if course_id in ru.courses]
        if len(courses) < 2:
            continue
        course_ids = [course.id for course in courses]
        ud_course = ud.courses[ud_id]
        ratings = sum(course.ratings for course in courses)
        premise = {
            "course_ids": list(course_ids),
            "ukma_course_id": ud_id,
            "merge_source": _merge_source(ud_course),
            "ratings": ratings,
        }
        if _answered(decisions, "merge_courses", ud_id, premise):
            continue
        after: dict[str, object] = {
            "merge_source": _merge_source(ud_course),
            "courses": [
                {
                    "id": course.id,
                    "title": course.title,
                    "department": _department_ref(ru, course),
                    "years": _course_years(ru, course.id),
                    "ratings": course.ratings,
                }
                for course in courses
            ],
        }
        drafts.append(
            _draft(
                ru,
                "merge_courses",
                ud_id,
                None,
                ud_id,
                after,
                {
                    "courses": [_course_display(ru, course) for course in courses],
                    "ukma_course": _ukma_course_display(ud, ud_course),
                },
                ratings=ratings,
            )
        )
    return drafts


def _removed_courses(ud: UkmaDataSnapshot, ru: RateUkmaSnapshot) -> list[ChangeDraft]:
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
            _draft(
                ru,
                "removed_course",
                course_id,
                course_id,
                course.ukma_data_id,
                after,
                {"course": _course_display(ru, course)},
                ratings=course.ratings,
            )
        )
    return drafts


def _removed_offerings(ud: UkmaDataSnapshot, ru: RateUkmaSnapshot) -> list[ChangeDraft]:
    by_code = {offering.saz_code: offering for offering in ud.offerings.values()}
    drafts = []
    for offering_id in sorted(ru.offerings):
        offering = ru.offerings[offering_id]
        if offering.ukma_data_id is not None:
            ud_offering = ud.offerings.get(offering.ukma_data_id)
            if ud_offering is not None and ud_offering.removed_at is None:
                continue
        else:
            ud_offering = by_code.get(offering.code)
            if ud_offering is not None and ud_offering.removed_at is None:
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
            _draft(
                ru,
                "removed_offering",
                offering_id,
                offering_id,
                ud_offering.id if ud_offering is not None else None,
                after,
                {"course": _course_display(ru, course)} if course is not None else {},
                ratings=offering.ratings,
            )
        )
    return drafts


def _draft(
    ru: RateUkmaSnapshot,
    kind: str,
    key: str,
    target_id: str | None,
    ukma_data_id: str | None,
    after: dict[str, object],
    display: dict[str, object],
    *,
    ratings: int = 0,
    requires: Iterable[dict[str, str]] = (),
) -> ChangeDraft:
    return ChangeDraft(
        kind=kind,
        key=key,
        ukma_data_id=ukma_data_id,
        target_id=target_id,
        before=make_before(kind, ru, target_id, after),
        after=after,
        requires=list(requires),
        ratings=ratings,
        display=display,
    )


def _answered(
    decisions: Sequence[DecisionView], kind: str, key: str, premise: dict[str, object]
) -> bool:
    """A live answer whose premise still holds; a changed premise asks again."""
    for decision in decisions:
        if decision.kind != kind or decision.question_key != key:
            continue
        if decision.answer not in _ANSWERS[kind]:
            continue
        if kind == "merge_courses" and decision.answer == "merge" and decision.into_id is None:
            continue
        if all(
            name in decision.premise and decision.premise[name] == value
            for name, value in premise.items()
        ):
            return True
    return False


def _merge_source(course: ukma_data.Course) -> str | None:
    return None if course.merge_source is None else course.merge_source.value


def _ukma_course_display(ud: UkmaDataSnapshot, course: ukma_data.Course) -> dict[str, object]:
    department = None
    if course.department_id is not None:
        row = ud.departments.get(course.department_id)
        if row is not None:
            department = row.name
    return {
        "title": course.title,
        "department": department,
        "merge_source": _merge_source(course),
    }


def _course_display(ru: RateUkmaSnapshot, course: RuCourse) -> dict[str, object]:
    offerings = [row for row in ru.offerings.values() if row.course_id == course.id]
    department = ru.departments.get(course.department_id)
    years = sorted({academic_year_of(row.semester_year, row.semester_term) for row in offerings})
    teachers = []
    for year in years:
        names = {
            instructor.name
            for row in offerings
            if academic_year_of(row.semester_year, row.semester_term) == year
            for link in row.instructor_links
            if (instructor := ru.instructors.get(link.instructor_id)) is not None
        }
        teachers.append({"year": year, "teachers": sorted(names)})
    return {
        "title": course.title,
        "department": department.name if department is not None else "",
        "years": years,
        "saz_codes": sorted({row.code for row in offerings}),
        "teachers": teachers,
    }


def _department_ref(ru: RateUkmaSnapshot, course: RuCourse) -> dict[str, object]:
    department = ru.departments.get(course.department_id)
    if department is None:
        return {"id": course.department_id, "ukma_data_id": None, "name": ""}
    return {
        "id": department.id,
        "ukma_data_id": department.ukma_data_id,
        "name": department.name,
    }


def _course_years(ru: RateUkmaSnapshot, course_id: str) -> list[int]:
    return sorted(
        {
            academic_year_of(row.semester_year, row.semester_term)
            for row in ru.offerings.values()
            if row.course_id == course_id
        }
    )


def _latest_offering(ru: RateUkmaSnapshot, course_id: str) -> RuOffering | None:
    rows = [row for row in ru.offerings.values() if row.course_id == course_id]
    if not rows:
        return None
    return max(
        rows,
        key=lambda row: (
            academic_year_of(row.semester_year, row.semester_term),
            _TERM_RANK.get(row.semester_term, 0),
            row.code,
        ),
    )


def _status(latest: RuOffering | None, academic_year: int) -> str:
    if latest is None:
        return "FINISHED"
    return (
        "ACTIVE"
        if academic_year_of(latest.semester_year, latest.semester_term) >= academic_year
        else "FINISHED"
    )


def _sorted_drafts(drafts: list[ChangeDraft]) -> list[ChangeDraft]:
    return sorted(drafts, key=lambda draft: (KIND_BY_NAME[draft.kind].order, draft.key))


def _sorted_skips(skipped: dict[str, list[str]]) -> dict[str, list[str]]:
    return {reason: sorted(ids) for reason, ids in sorted(skipped.items()) if ids}
