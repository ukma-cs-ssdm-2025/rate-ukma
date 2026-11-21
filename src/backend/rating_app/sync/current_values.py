"""The Rate UKMA side of every key a sync kind writes.

A builder fills a change's `before` with it (`drafts.make_before`); an apply
calls it again and compares the keys `before` holds (`drafts.is_stale`). Ids are
strings, decimals are strings with one decimal, terms are sorted by (year, term)
and specialities by name.
"""

from __future__ import annotations

from rating_app.sync.snapshot import RateUkmaSnapshot, RuCourse, RuOffering


class TargetMissingError(Exception):
    """A change names a Rate UKMA row the snapshot does not hold."""


_WRITELESS_KINDS = frozenset(
    {
        "new_faculty",
        "new_department",
        "new_course",
        "new_offering",
        "place_offering",
        "merge_courses",
        "removed_course",
        "removed_offering",
        "teacher_created",
    }
)

_TEACHER_LINK_KINDS = frozenset({"teacher_link_added", "teacher_link_removed"})


def current_values(kind: str, ru: RateUkmaSnapshot, target_id: str | None) -> dict[str, object]:
    """The Rate UKMA values of every key ``kind`` writes, in canonical JSON form.

    For the teacher link kinds the value is the offering's whole link set, so an
    apply notices any link that changed and supersedes the change as stale.
    """
    if kind in _WRITELESS_KINDS:
        return {}
    if target_id is None:
        raise TargetMissingError(f"{kind}: target is missing")

    if kind == "link_faculty":
        return {"ukma_data_id": _row(ru.faculties, target_id, kind).ukma_data_id}
    if kind == "link_department":
        return {"ukma_data_id": _row(ru.departments, target_id, kind).ukma_data_id}
    if kind == "link_course":
        return {"ukma_data_id": _row(ru.courses, target_id, kind).ukma_data_id}
    if kind == "link_offering":
        return {"ukma_data_id": _row(ru.offerings, target_id, kind).ukma_data_id}
    if kind == "change_faculty":
        return {"name": _row(ru.faculties, target_id, kind).name}
    if kind == "change_department":
        return {"name": _row(ru.departments, target_id, kind).name}
    if kind == "change_course":
        return _course_values(_row(ru.courses, target_id, kind), ru)
    if kind == "change_offering":
        return _offering_values(_row(ru.offerings, target_id, kind))
    if kind == "move_offering":
        return {"from_course": _row(ru.offerings, target_id, kind).course_id}
    if kind == "relink_course":
        return {"ukma_data_id": _row(ru.courses, target_id, kind).ukma_data_id}
    if kind in _TEACHER_LINK_KINDS:
        return _link_values(_row(ru.offerings, target_id, kind))
    raise ValueError(f"unknown sync kind: {kind}")


def _row[Row](rows: dict[str, Row], target_id: str, kind: str) -> Row:
    row = rows.get(target_id)
    if row is None:
        raise TargetMissingError(f"{kind}: target {target_id} not found")
    return row


def _course_values(course: RuCourse, ru: RateUkmaSnapshot) -> dict[str, object]:
    department = _row(ru.departments, course.department_id, "change_course")
    return {
        "title": course.title,
        "department": {
            "id": department.id,
            "ukma_data_id": department.ukma_data_id,
            "name": department.name,
        },
        "education_level": course.education_level,
        "status": course.status,
        "description": course.description,
    }


def _offering_values(offering: RuOffering) -> dict[str, object]:
    return {
        "semester": {"year": offering.semester_year, "term": offering.semester_term},
        "exam_type": offering.exam_type,
        "study_year": offering.study_year,
        "max_students": offering.max_students,
        "max_groups": offering.max_groups,
        "group_size_min": offering.group_size_min,
        "group_size_max": offering.group_size_max,
        "terms": [
            {
                "year": term.year,
                "term": term.term,
                "credits": term.credits,
                "weekly_hours": term.weekly_hours,
                "lecture_count": term.lecture_count,
                "practice_count": term.practice_count,
                "practice_type": term.practice_type,
                "exam_type": term.exam_type,
            }
            for term in sorted(offering.terms, key=lambda term: (term.year, term.term))
        ],
        "specialities_added": [
            {"name": name, "kind": kind}
            for name, kind in sorted(offering.specialities, key=lambda item: item[0])
        ],
    }


def _link_values(offering: RuOffering) -> dict[str, object]:
    return {
        "links": [
            {"instructor_id": link.instructor_id, "role": link.role}
            for link in sorted(
                offering.instructor_links,
                key=lambda link: (link.instructor_id, link.role),
            )
        ]
    }
