from __future__ import annotations

from django.utils import timezone

import pytest

from rating_app.sync.drafts import ChangeDraft, DecisionView, load_decisions, make_before
from rating_app.sync.snapshot import (
    RateUkmaSnapshot,
    RuCourse,
    RuDepartment,
    RuFaculty,
)


def _ru_course(course_id: str, *, title: str) -> RuCourse:
    return RuCourse(
        id=course_id,
        title=title,
        department_id="ru-dept",
        education_level="BACHELOR",
        status="ACTIVE",
        description="",
        ukma_data_id=None,
        ratings=0,
    )


def _ru_department(
    department_id: str,
    *,
    name: str,
    ukma_data_id: str | None = None,
) -> RuDepartment:
    return RuDepartment(
        id=department_id,
        name=name,
        faculty_id="ru-fac",
        ukma_data_id=ukma_data_id,
    )


def _ru_faculty(
    faculty_id: str,
    *,
    name: str,
    ukma_data_id: str | None = None,
) -> RuFaculty:
    return RuFaculty(id=faculty_id, name=name, ukma_data_id=ukma_data_id)


def _ru_snapshot(
    *,
    faculties: list[RuFaculty] | None = None,
    departments: list[RuDepartment] | None = None,
    courses: list[RuCourse] | None = None,
) -> RateUkmaSnapshot:
    return RateUkmaSnapshot(
        faculties={row.id: row for row in faculties or []},
        departments={row.id: row for row in departments or []},
        courses={row.id: row for row in courses or []},
        offerings={},
        instructors={},
        speciality_names=frozenset(),
    )


@pytest.mark.parametrize(
    ("kind", "group", "source"),
    [
        ("link_course", "link", "catalog"),
        ("new_course", "new", "catalog"),
        ("change_course", "change", "catalog"),
        ("merge_courses", "mapping", "catalog"),
        ("removed_offering", "removed", "catalog"),
        ("teacher_created", "new", "teachers"),
        ("teacher_link_added", "change", "teachers"),
    ],
)
def test_to_model_sets_group_and_source_from_the_registry(kind, group, source):
    draft = ChangeDraft(kind=kind, key=f"{kind}:1")

    model = draft.to_model()

    assert model.kind == kind
    assert model.group == group
    assert model.source == source
    assert model.pk is None


def test_to_model_copies_the_draft_and_puts_display_in_after():
    draft = ChangeDraft(
        kind="move_offering",
        key="offering:1|teacher:teacher@example.test|role:move",
        ukma_data_id="ud-1",
        target_id="ru-offering",
        before={"from_course": "ru-a"},
        after={"from_course": "ru-a", "to_course_id": "ru-b"},
        requires=[{"kind": "link_course", "key": "course:ru-b"}],
        ratings=2,
        display={"course": {"title": "Аналіз даних"}},
    )

    model = draft.to_model()

    assert model.after == {
        "from_course": "ru-a",
        "to_course_id": "ru-b",
        "display": {"course": {"title": "Аналіз даних"}},
    }
    assert model.before == {"from_course": "ru-a"}
    assert model.requires == [{"kind": "link_course", "key": "course:ru-b"}]
    assert model.ratings == 2
    assert model.ukma_data_id == "ud-1"
    assert model.target_id == "ru-offering"


def test_to_model_leaves_after_alone_without_a_display():
    draft = ChangeDraft(kind="link_course", key="course:1", after={"ukma_data_id": "ud-1"})

    assert draft.to_model().after == {"ukma_data_id": "ud-1"}


def test_make_before_keeps_only_the_keys_after_writes():
    ru = _ru_snapshot(
        departments=[_ru_department("ru-dept", name="Кафедра даних", ukma_data_id="ud-dept")],
        courses=[_ru_course("ru-course", title="Стара назва")],
    )

    before = make_before("change_course", ru, "ru-course", {"title": "Нова назва"})

    assert before == {"title": "Стара назва"}


def test_make_before_reads_the_current_link():
    ru = _ru_snapshot(faculties=[_ru_faculty("ru-fac", name="Факультет", ukma_data_id="ud-old")])

    before = make_before("link_faculty", ru, "ru-fac", {"ukma_data_id": "ud-new"})

    assert before == {"ukma_data_id": "ud-old"}


def test_make_before_is_empty_for_a_new_row():
    assert make_before("new_course", _ru_snapshot(), None, {"title": "Новий курс"}) == {}


@pytest.mark.django_db
@pytest.mark.integration
def test_load_decisions_returns_unsuperseded_rows_with_string_ids(
    catalog_mapping_decision_factory,
    course_factory,
    course_offering_factory,
):
    course = course_factory()
    into = course_factory()
    offering = course_offering_factory(course=course)
    catalog_mapping_decision_factory(
        kind="move_offering",
        ukma_course_id="ud-1",
        course=course,
        offering=offering,
        answer="move",
        into=into,
        premise={"course_ids": [str(course.id)]},
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        ukma_course_id="ud-superseded",
        course=None,
        answer="keep_apart",
        superseded_at=timezone.now(),
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        ukma_course_id="ud-2",
        course=None,
        answer="keep_apart",
    )

    decisions = load_decisions()

    assert decisions == [
        DecisionView(
            kind="move_offering",
            ukma_course_id="ud-1",
            course_id=str(course.id),
            offering_id=str(offering.id),
            answer="move",
            into_id=str(into.id),
            premise={"course_ids": [str(course.id)]},
        ),
        DecisionView(
            kind="merge_courses",
            ukma_course_id="ud-2",
            course_id=None,
            offering_id=None,
            answer="keep_apart",
            into_id=None,
            premise={},
        ),
    ]
