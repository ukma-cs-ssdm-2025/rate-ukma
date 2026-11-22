"""The stale check for every sync kind, against the builders' `make_before`."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import replace

import pytest

from rating_app.sync.drafts import is_stale, make_before
from rating_app.sync.kinds import KINDS
from rating_app.sync.snapshot import (
    RateUkmaSnapshot,
    RuCourse,
    RuDepartment,
    RuFaculty,
    RuInstructorLink,
    RuOffering,
    RuTerm,
)

Edit = Callable[[RateUkmaSnapshot], RateUkmaSnapshot]


def _snapshot() -> RateUkmaSnapshot:
    faculty = RuFaculty(id="ru-fac", name="Факультет", ukma_data_id="ud-fac")
    department = RuDepartment(
        id="ru-dept", name="Кафедра", faculty_id="ru-fac", ukma_data_id="ud-dept"
    )
    course = RuCourse(
        id="ru-course",
        title="Курс",
        department_id="ru-dept",
        education_level="BACHELOR",
        status="ACTIVE",
        description="",
        ukma_data_id="ud-course",
        ratings=0,
    )
    offering = RuOffering(
        id="ru-offering",
        code="TST001",
        course_id="ru-course",
        semester_year=2030,
        semester_term="FALL",
        exam_type="EXAM",
        study_year=2,
        max_students=30,
        max_groups=2,
        group_size_min=10,
        group_size_max=15,
        ukma_data_id="ud-offering",
        terms=(
            RuTerm(
                year=2030,
                term="FALL",
                credits="4.0",
                weekly_hours=3,
                lecture_count=28,
                practice_count=14,
                practice_type="SEMINAR",
                exam_type="EXAM",
            ),
        ),
        specialities=(("Спеціальність", "ELECTIVE"),),
        instructor_links=(
            RuInstructorLink(id="l-1", instructor_id="i-1", role="LECTURE_INSTRUCTOR"),
        ),
        ratings=0,
        planned=0,
    )
    return RateUkmaSnapshot(
        faculties={faculty.id: faculty},
        departments={department.id: department},
        courses={course.id: course},
        offerings={offering.id: offering},
        instructors={},
        speciality_names=frozenset({"Спеціальність"}),
    )


def _faculty(**fields: object) -> Edit:
    return lambda ru: replace(ru, faculties={"ru-fac": replace(ru.faculties["ru-fac"], **fields)})


def _department(**fields: object) -> Edit:
    return lambda ru: replace(
        ru, departments={"ru-dept": replace(ru.departments["ru-dept"], **fields)}
    )


def _course(**fields: object) -> Edit:
    return lambda ru: replace(ru, courses={"ru-course": replace(ru.courses["ru-course"], **fields)})


def _offering(**fields: object) -> Edit:
    return lambda ru: replace(
        ru, offerings={"ru-offering": replace(ru.offerings["ru-offering"], **fields)}
    )


_ANOTHER_LINK = (
    RuInstructorLink(id="l-1", instructor_id="i-1", role="LECTURE_INSTRUCTOR"),
    RuInstructorLink(id="l-2", instructor_id="i-2", role="PRACTICE_INSTRUCTOR"),
)

# kind -> (target, after, edit to a key it writes, edit to a key it does not write)
CASES: dict[str, tuple[str, dict[str, object], Edit, Edit]] = {
    "link_faculty": (
        "ru-fac",
        {"ukma_data_id": "ud-new"},
        _faculty(ukma_data_id="ud-other"),
        _faculty(name="Інший факультет"),
    ),
    "change_faculty": (
        "ru-fac",
        {"name": "Новий факультет"},
        _faculty(name="Інший факультет"),
        _faculty(ukma_data_id="ud-other"),
    ),
    "link_department": (
        "ru-dept",
        {"ukma_data_id": "ud-new"},
        _department(ukma_data_id="ud-other"),
        _department(name="Інша кафедра"),
    ),
    "change_department": (
        "ru-dept",
        {"name": "Нова кафедра"},
        _department(name="Інша кафедра"),
        _department(ukma_data_id="ud-other"),
    ),
    "link_course": (
        "ru-course",
        {"ukma_data_id": "ud-new"},
        _course(ukma_data_id="ud-other"),
        _course(title="Інший курс"),
    ),
    "relink_course": (
        "ru-course",
        {"ukma_data_id": "ud-new"},
        _course(ukma_data_id="ud-other"),
        _course(title="Інший курс"),
    ),
    "change_course": (
        "ru-course",
        {"title": "Новий курс"},
        _course(title="Інший курс"),
        _course(description="Новий опис"),
    ),
    "link_offering": (
        "ru-offering",
        {"ukma_data_id": "ud-new"},
        _offering(ukma_data_id="ud-other"),
        _offering(max_students=40),
    ),
    "change_offering": (
        "ru-offering",
        {"max_students": 50},
        _offering(max_students=40),
        _offering(max_groups=3),
    ),
    "move_offering": (
        "ru-offering",
        {"from_course": "ru-course", "to_course_id": "ru-other"},
        _offering(course_id="ru-elsewhere"),
        _offering(max_students=40),
    ),
    "teacher_link_added": (
        "ru-offering",
        {"teacher_email": "teacher@example.test", "role": "PRACTICE_INSTRUCTOR"},
        _offering(instructor_links=_ANOTHER_LINK),
        _offering(max_students=40),
    ),
    "teacher_link_removed": (
        "ru-offering",
        {"instructor_id": "i-1", "role": "LECTURE_INSTRUCTOR"},
        _offering(instructor_links=_ANOTHER_LINK),
        _offering(max_students=40),
    ),
    "removed_course": ("ru-course", {}, lambda ru: ru, _course(title="Інший курс")),
    "removed_offering": ("ru-offering", {}, lambda ru: ru, _offering(max_students=40)),
}
WRITELESS = {
    "new_faculty",
    "new_department",
    "new_course",
    "new_offering",
    "place_offering",
    "merge_courses",
    "teacher_created",
}


def _gone(ru: RateUkmaSnapshot) -> RateUkmaSnapshot:
    return replace(ru, faculties={}, departments={}, courses={}, offerings={})


def _stored_before(kind: str, target: str | None, after: dict[str, object]) -> dict[str, object]:
    # `before` goes through a JSON column, so compare what comes back from it.
    return json.loads(json.dumps(make_before(kind, _snapshot(), target, after)))


def test_every_kind_has_a_stale_case():
    assert set(CASES) | WRITELESS == {kind.name for kind in KINDS}
    assert not set(CASES) & WRITELESS


@pytest.mark.parametrize("kind", sorted(CASES))
def test_a_fresh_change_is_not_stale(kind):
    target, after, _, _ = CASES[kind]

    assert not is_stale(kind, _snapshot(), target, _stored_before(kind, target, after))


@pytest.mark.parametrize("kind", sorted(k for k in CASES if not k.startswith("removed_")))
def test_an_edit_to_a_written_key_makes_it_stale(kind):
    target, after, edit_written, _ = CASES[kind]

    assert is_stale(kind, edit_written(_snapshot()), target, _stored_before(kind, target, after))


@pytest.mark.parametrize("kind", sorted(CASES))
def test_an_edit_to_a_key_it_does_not_write_keeps_it_fresh(kind):
    target, after, _, edit_unwritten = CASES[kind]

    assert not is_stale(
        kind, edit_unwritten(_snapshot()), target, _stored_before(kind, target, after)
    )


@pytest.mark.parametrize("kind", sorted(CASES))
def test_a_change_whose_target_is_gone_is_stale(kind):
    target, after, _, _ = CASES[kind]

    assert is_stale(kind, _gone(_snapshot()), target, _stored_before(kind, target, after))


@pytest.mark.parametrize("kind", sorted(WRITELESS))
def test_a_kind_that_writes_no_existing_row_records_nothing(kind):
    before = _stored_before(kind, None, {"name": "Нове"})

    assert before == {}
    assert not is_stale(kind, _snapshot(), None, before)


def test_a_change_course_compares_its_department_by_rate_ukma_id():
    after = {"department": {"id": "ru-dept", "ukma_data_id": "ud-dept", "name": "Кафедра"}}
    before = _stored_before("change_course", "ru-course", after)
    linked = _department(ukma_data_id="ud-linked", name="Перейменована кафедра")(_snapshot())

    assert not is_stale("change_course", linked, "ru-course", before)


def test_a_change_course_on_another_department_is_stale():
    after = {"department": {"id": "ru-dept", "ukma_data_id": "ud-dept", "name": "Кафедра"}}
    before = _stored_before("change_course", "ru-course", after)
    other = replace(
        _snapshot(),
        courses={"ru-course": replace(_snapshot().courses["ru-course"], department_id="ru-other")},
        departments={
            "ru-other": RuDepartment(
                id="ru-other", name="Інша кафедра", faculty_id="ru-fac", ukma_data_id=None
            )
        },
    )

    assert is_stale("change_course", other, "ru-course", before)
