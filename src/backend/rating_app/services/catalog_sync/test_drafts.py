from __future__ import annotations

from collections import Counter

from django.utils import timezone

import pytest

from rating_app.services.catalog_sync.drafts import (
    DecisionView,
    DiffResult,
    ProposalDraft,
    load_decisions,
    make_before,
)
from rating_app.services.catalog_sync.snapshot import (
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
        speciality_names=frozenset(),
    )


@pytest.mark.parametrize(
    ("kind", "group"),
    [
        ("link_course", "link"),
        ("new_course", "new"),
        ("change_course", "change"),
        ("merge_courses", "mapping"),
        ("removed_offering", "removed"),
    ],
)
def test_proposal_draft_group_follows_the_kind(kind, group):
    draft = ProposalDraft(kind=kind, ukma_data_id="ud-1", target_id=None, before={}, after={})

    assert draft.group == group
    assert draft.ratings == 0


def test_diff_result_merge_accumulates_proposals_skipped_counts_and_notes():
    first = ProposalDraft(
        kind="new_course", ukma_data_id="ud-1", target_id=None, before={}, after={}
    )
    second = ProposalDraft(
        kind="removed_offering", ukma_data_id="ud-2", target_id="ru-1", before={}, after={}
    )
    left = DiffResult(
        proposals=[first],
        skipped=Counter({"no_term": 1}),
        notes=[{"kind": "identity_collision", "course_id": "ru-1"}],
    )
    right = DiffResult(
        proposals=[second],
        skipped=Counter({"no_term": 2, "zero_credits": 1}),
        notes=[{"kind": "unknown_programme", "name": "Програма"}],
    )

    left.merge(right)

    assert left.proposals == [first, second]
    assert left.skipped == Counter({"no_term": 3, "zero_credits": 1})
    assert left.notes == [
        {"kind": "identity_collision", "course_id": "ru-1"},
        {"kind": "unknown_programme", "name": "Програма"},
    ]


def test_diff_result_starts_empty():
    result = DiffResult()

    assert result.proposals == []
    assert result.skipped == Counter()
    assert result.notes == []


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
