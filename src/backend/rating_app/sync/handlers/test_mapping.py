"""Mapping handlers apply only a live answer whose premise still holds.

The merge is the one apply that deletes a course, so its test covers the locks'
outcome: every offering moved, one planned course per student, decisions naming
the source superseded before the delete, and the target's aggregates recomputed.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta
from typing import Any

from django.utils import timezone

import pytest

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    CourseOfferingSpeciality,
    CourseOfferingTerm,
    MappingAnswer,
    PlannedCourse,
    Rating,
    SyncApprovalOutcome,
    SyncChangeState,
    SyncChangeStateReason,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import apply
from rating_app.sync.apply import approve
from rating_app.sync.kinds import KIND_BY_NAME


@contextmanager
def _lock_free(_key: int):
    yield True


@pytest.fixture(autouse=True)
def lock_free(monkeypatch):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)


@pytest.fixture
def make_run(sync_run_factory):
    def make(*, source: str = SyncSource.CATALOG, **kwargs: Any):
        kwargs.setdefault("finished_at", timezone.now())
        return sync_run_factory(source=source, status=SyncRunStatus.SUCCEEDED, **kwargs)

    return make


@pytest.fixture
def make_change(sync_change_factory):
    def make(
        run,
        *,
        kind: str,
        key: str,
        target_id: str | None = None,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ):
        registry_kind = KIND_BY_NAME[kind]
        return sync_change_factory(
            run=run,
            source=registry_kind.source,
            group=registry_kind.group,
            kind=kind,
            key=key,
            target_id=target_id,
            before=before or {},
            after=after or {},
        )

    return make


def _term() -> dict[str, Any]:
    return {
        "year": 2025,
        "term": "FALL",
        "credits": "3.0",
        "weekly_hours": 4,
        "lecture_count": 16,
        "practice_count": 16,
        "practice_type": "SEMINAR",
        "exam_type": "EXAM",
    }


def _offering_after(*, candidates: list[Any] | None = None) -> dict[str, Any]:
    after: dict[str, Any] = {
        "saz_code": "315421",
        "semester": {"year": 2025, "term": "FALL"},
        "exam_type": "EXAM",
        "study_year": 1,
        "max_students": 60,
        "max_groups": 3,
        "group_size_min": 10,
        "group_size_max": 30,
        "terms": [_term()],
        "specialities": [{"name": "Спеціальність", "kind": "ELECTIVE"}],
    }
    if candidates is not None:
        after["candidates"] = [str(course.pk) for course in candidates]
    return after


def _merge_after(courses: list[Any]) -> dict[str, Any]:
    return {
        "merge_source": None,
        "courses": [
            {
                "id": str(course.pk),
                "title": course.title,
                "department": {
                    "id": str(course.department_id),
                    "ukma_data_id": course.department.ukma_data_id,
                    "name": course.department.name,
                },
                "years": [2025],
                "ratings": 0,
            }
            for course in courses
        ],
    }


def _ratings(*courses: Any) -> int:
    return Rating.objects.filter(
        course_offering__course_id__in=[course.pk for course in courses]
    ).count()


def _merge_premise(courses: list[Any], *, ukma_course_id: str = "ud-course") -> dict[str, Any]:
    return {
        "course_ids": sorted(str(course.pk) for course in courses),
        "ukma_course_id": ukma_course_id,
        "merge_source": None,
        "ratings": _ratings(*courses),
    }


def _relink_premise(course: Any, *, ukma_course_id: str = "ud-new") -> dict[str, Any]:
    return {
        "course_ids": [str(course.pk)],
        "ukma_course_id": ukma_course_id,
        "merge_source": None,
        "ratings": _ratings(course),
    }


def _move_premise(offering: Any, source: Any, target: Any) -> dict[str, Any]:
    return {
        "course_ids": sorted([str(source.pk), str(target.pk)]),
        "ukma_course_id": target.ukma_data_id,
        "merge_source": None,
        "saz_code": offering.code,
        "ratings": Rating.objects.filter(course_offering=offering).count(),
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_a_relink_with_a_holding_answer_sets_the_link(
    user, make_run, make_change, course_factory, catalog_mapping_decision_factory
):
    course = course_factory(ukma_data_id="ud-old")
    run = make_run()
    change = make_change(
        run,
        kind="relink_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": "ud-old"},
        after={"ukma_data_id": "ud-new"},
    )
    decision = catalog_mapping_decision_factory(
        kind="relink_course",
        question_key=str(course.pk),
        ukma_course_id="ud-new",
        course=course,
        answer=MappingAnswer.RELINK,
        premise=_relink_premise(course),
    )

    approval = approve([change.pk], user)

    course.refresh_from_db()
    decision.refresh_from_db()
    change.refresh_from_db()
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 1, "superseded": 0, "waiting": 0}
    assert change.state == SyncChangeState.APPLIED
    assert course.ukma_data_id == "ud-new"
    assert decision.applied_at is not None


@pytest.mark.django_db
@pytest.mark.integration
def test_a_relink_without_a_live_answer_stays_proposed(user, make_run, make_change, course_factory):
    course = course_factory(ukma_data_id="ud-old")
    run = make_run()
    change = make_change(
        run,
        kind="relink_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": "ud-old"},
        after={"ukma_data_id": "ud-new"},
    )

    approval = approve([change.pk], user)

    course.refresh_from_db()
    change.refresh_from_db()
    assert approval.outcome == SyncApprovalOutcome.APPLIED
    assert approval.counts == {"applied": 0, "superseded": 0, "waiting": 1}
    assert change.state == SyncChangeState.PROPOSED
    assert course.ukma_data_id == "ud-old"


@pytest.mark.django_db
@pytest.mark.integration
def test_a_relink_whose_ratings_changed_is_superseded(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    rating_factory,
    catalog_mapping_decision_factory,
):
    course = course_factory(ukma_data_id="ud-old")
    run = make_run()
    change = make_change(
        run,
        kind="relink_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": "ud-old"},
        after={"ukma_data_id": "ud-new"},
    )
    catalog_mapping_decision_factory(
        kind="relink_course",
        question_key=str(course.pk),
        ukma_course_id="ud-new",
        course=course,
        answer=MappingAnswer.RELINK,
        premise=_relink_premise(course),
    )
    rating_factory(course_offering=course_offering_factory(course=course))

    approve([change.pk], user)

    course.refresh_from_db()
    change.refresh_from_db()
    assert change.state == SyncChangeState.SUPERSEDED
    assert change.state_reason == SyncChangeStateReason.STALE
    assert course.ukma_data_id == "ud-old"


@pytest.mark.django_db
@pytest.mark.integration
def test_a_keep_answer_settles_a_relink_without_writing(
    user, make_run, make_change, course_factory, catalog_mapping_decision_factory
):
    course = course_factory(ukma_data_id="ud-old")
    run = make_run()
    change = make_change(
        run,
        kind="relink_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": "ud-old"},
        after={"ukma_data_id": "ud-new"},
    )
    catalog_mapping_decision_factory(
        kind="relink_course",
        question_key=str(course.pk),
        ukma_course_id="ud-new",
        course=course,
        answer=MappingAnswer.KEEP,
        premise=_relink_premise(course),
    )

    approval = approve([change.pk], user)

    course.refresh_from_db()
    change.refresh_from_db()
    assert approval.counts == {"applied": 1, "superseded": 0, "waiting": 0}
    assert change.state == SyncChangeState.APPLIED
    assert course.ukma_data_id == "ud-old"


@pytest.mark.django_db
@pytest.mark.integration
def test_a_move_with_a_holding_answer_moves_the_offering(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    catalog_mapping_decision_factory,
):
    source = course_factory(ukma_data_id="ud-source")
    target = course_factory(ukma_data_id="ud-target")
    offering = course_offering_factory(course=source)
    run = make_run()
    change = make_change(
        run,
        kind="move_offering",
        key=str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={
            "from_course": str(source.pk),
            "ukma_course_id": "ud-target",
            "to_course_id": str(target.pk),
        },
    )
    catalog_mapping_decision_factory(
        kind="move_offering",
        question_key=str(offering.pk),
        ukma_course_id="ud-target",
        course=source,
        offering=offering,
        into=target,
        answer=MappingAnswer.MOVE,
        premise=_move_premise(offering, source, target),
    )

    approve([change.pk], user)

    offering.refresh_from_db()
    change.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED
    assert offering.course_id == target.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_a_move_whose_target_lost_its_id_is_superseded(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    catalog_mapping_decision_factory,
):
    source = course_factory(ukma_data_id="ud-source")
    target = course_factory(ukma_data_id=None)
    offering = course_offering_factory(course=source)
    run = make_run()
    change = make_change(
        run,
        kind="move_offering",
        key=str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={
            "from_course": str(source.pk),
            "ukma_course_id": "ud-target",
            "to_course_id": str(target.pk),
        },
    )
    catalog_mapping_decision_factory(
        kind="move_offering",
        question_key=str(offering.pk),
        ukma_course_id="ud-target",
        course=source,
        offering=offering,
        into=target,
        answer=MappingAnswer.MOVE,
        premise={
            "course_ids": sorted([str(source.pk), str(target.pk)]),
            "ukma_course_id": "ud-target",
            "merge_source": None,
            "saz_code": offering.code,
            "ratings": 0,
        },
    )

    approve([change.pk], user)

    offering.refresh_from_db()
    change.refresh_from_db()
    assert change.state == SyncChangeState.SUPERSEDED
    assert change.state_reason == SyncChangeStateReason.STALE
    assert offering.course_id == source.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_a_move_whose_ratings_changed_applies_nothing(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    rating_factory,
    catalog_mapping_decision_factory,
):
    source = course_factory(ukma_data_id="ud-source")
    target = course_factory(ukma_data_id="ud-target")
    offering = course_offering_factory(course=source)
    run = make_run()
    change = make_change(
        run,
        kind="move_offering",
        key=str(offering.pk),
        target_id=str(offering.pk),
        before={"from_course": str(source.pk)},
        after={
            "from_course": str(source.pk),
            "ukma_course_id": "ud-target",
            "to_course_id": str(target.pk),
        },
    )
    catalog_mapping_decision_factory(
        kind="move_offering",
        question_key=str(offering.pk),
        ukma_course_id="ud-target",
        course=source,
        offering=offering,
        into=target,
        answer=MappingAnswer.MOVE,
        premise=_move_premise(offering, source, target),
    )
    rating_factory(course_offering=offering)

    approve([change.pk], user)

    offering.refresh_from_db()
    change.refresh_from_db()
    assert change.state == SyncChangeState.SUPERSEDED
    assert offering.course_id == source.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_a_place_with_a_holding_answer_creates_the_offering(
    user,
    make_run,
    make_change,
    course_factory,
    speciality_factory,
    catalog_mapping_decision_factory,
):
    chosen = course_factory()
    other = course_factory()
    speciality_factory(name="Спеціальність")
    run = make_run()
    change = make_change(
        run,
        kind="place_offering",
        key="ud-offering",
        after=_offering_after(candidates=[chosen, other]),
        before={},
    )
    change.ukma_data_id = "ud-course"
    change.save(update_fields=["ukma_data_id"])
    catalog_mapping_decision_factory(
        kind="place_offering",
        question_key="ud-offering",
        ukma_course_id="ud-course",
        course=None,
        into=chosen,
        answer=MappingAnswer.PLACE,
        premise={
            "course_ids": sorted([str(chosen.pk), str(other.pk)]),
            "ukma_course_id": "ud-course",
            "merge_source": None,
            "ratings": 0,
            "saz_code": "315421",
        },
    )

    approve([change.pk], user)

    change.refresh_from_db()
    offering = CourseOffering.objects.get(ukma_data_id="ud-offering")
    assert change.state == SyncChangeState.APPLIED
    assert offering.course_id == chosen.pk
    assert offering.code == "315421"
    assert CourseOfferingTerm.objects.filter(offering=offering).count() == 1
    assert CourseOfferingSpeciality.objects.filter(offering=offering).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_a_place_without_an_answer_stays_proposed(user, make_run, make_change, course_factory):
    chosen = course_factory()
    other = course_factory()
    run = make_run()
    change = make_change(
        run,
        kind="place_offering",
        key="ud-offering",
        after=_offering_after(candidates=[chosen, other]),
        before={},
    )

    approve([change.pk], user)

    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED
    assert not CourseOffering.objects.filter(ukma_data_id="ud-offering").exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_a_merge_moves_every_offering_and_deletes_each_source(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    rating_factory,
    student_factory,
    planned_course_factory,
    catalog_mapping_decision_factory,
):
    target = course_factory(ukma_data_id="ud-course")
    sources = [course_factory(ukma_data_id="ud-course"), course_factory(ukma_data_id="ud-course")]
    target_offering = course_offering_factory(course=target)
    source_offerings = [
        course_offering_factory(course=sources[0]),
        course_offering_factory(course=sources[1]),
    ]
    rating_factory(course_offering=source_offerings[0], difficulty=2, usefulness=5)
    rating_factory(course_offering=target_offering, difficulty=4, usefulness=3)
    student = student_factory()
    older = planned_course_factory(student=student, offering=source_offerings[1])
    PlannedCourse.objects.filter(pk=older.pk).update(updated_at=timezone.now() - timedelta(days=1))
    newer = planned_course_factory(student=student, offering=target_offering)
    run = make_run()
    change = make_change(
        run,
        kind="merge_courses",
        key="ud-course",
        after=_merge_after([target, *sources]),
        before={},
    )
    change.ukma_data_id = "ud-course"
    change.save(update_fields=["ukma_data_id"])
    merge_decision = catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-course",
        ukma_course_id="ud-course",
        course=None,
        into=target,
        answer=MappingAnswer.MERGE,
        premise=_merge_premise([target, *sources]),
    )
    naming_source = catalog_mapping_decision_factory(
        kind="relink_course",
        question_key=str(sources[0].pk),
        ukma_course_id="ud-course",
        course=sources[0],
        answer=MappingAnswer.RELINK,
        premise=_relink_premise(sources[0], ukma_course_id="ud-course"),
    )

    approval = approve([change.pk], user)

    change.refresh_from_db()
    merge_decision.refresh_from_db()
    naming_source.refresh_from_db()
    target.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED
    assert approval.counts["merges"] == [
        {"from": str(source.pk), "to": str(target.pk)} for source in sources
    ]
    assert approval.counts["plans_deduplicated"] == 1
    assert not Course.objects.filter(pk__in=[source.pk for source in sources]).exists()
    assert CourseOffering.objects.filter(pk__in=[row.pk for row in source_offerings]).count() == 2
    assert (
        CourseOffering.objects.filter(pk__in=[row.pk for row in source_offerings])
        .filter(course=target)
        .count()
        == 2
    )
    assert PlannedCourse.objects.filter(student=student, offering__course=target).count() == 1
    assert PlannedCourse.objects.filter(pk=newer.pk).exists()
    assert not PlannedCourse.objects.filter(pk=older.pk).exists()
    assert merge_decision.applied_at is not None
    assert merge_decision.superseded_at is not None
    assert naming_source.superseded_at is not None
    assert target.avg_difficulty == 3
    assert target.avg_usefulness == 4
    assert target.ratings_count == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_a_keep_apart_answer_settles_a_merge_without_moving_anything(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    catalog_mapping_decision_factory,
):
    courses = [course_factory(ukma_data_id="ud-course") for _ in range(2)]
    offerings = [course_offering_factory(course=course) for course in courses]
    run = make_run()
    change = make_change(
        run,
        kind="merge_courses",
        key="ud-course",
        after=_merge_after(courses),
        before={},
    )
    change.ukma_data_id = "ud-course"
    change.save(update_fields=["ukma_data_id"])
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-course",
        ukma_course_id="ud-course",
        course=None,
        answer=MappingAnswer.KEEP_APART,
        premise=_merge_premise(courses),
    )

    approve([change.pk], user)

    change.refresh_from_db()
    for offering in offerings:
        offering.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED
    assert Course.objects.filter(pk__in=[course.pk for course in courses]).count() == 2
    assert [offering.course_id for offering in offerings] == [course.pk for course in courses]


@pytest.mark.django_db
@pytest.mark.integration
def test_a_merge_whose_course_set_changed_is_superseded(
    user,
    make_run,
    make_change,
    course_factory,
    course_offering_factory,
    catalog_mapping_decision_factory,
):
    target = course_factory(ukma_data_id="ud-course")
    source = course_factory(ukma_data_id="ud-course")
    course_offering_factory(course=source)
    run = make_run()
    change = make_change(
        run,
        kind="merge_courses",
        key="ud-course",
        after=_merge_after([target, source]),
        before={},
    )
    change.ukma_data_id = "ud-course"
    change.save(update_fields=["ukma_data_id"])
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-course",
        ukma_course_id="ud-course",
        course=None,
        into=target,
        answer=MappingAnswer.MERGE,
        premise={
            **_merge_premise([target, source]),
            "course_ids": sorted([str(target.pk), str(source.pk), str(course_factory().pk)]),
        },
    )

    approve([change.pk], user)

    change.refresh_from_db()
    assert change.state == SyncChangeState.SUPERSEDED
    assert change.state_reason == SyncChangeStateReason.STALE
    assert Course.objects.filter(pk__in=[target.pk, source.pk]).count() == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_a_merge_without_an_answer_stays_proposed(user, make_run, make_change, course_factory):
    courses = [course_factory(ukma_data_id="ud-course") for _ in range(2)]
    run = make_run()
    change = make_change(
        run,
        kind="merge_courses",
        key="ud-course",
        after=_merge_after(courses),
        before={},
    )

    approve([change.pk], user)

    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED
    assert Course.objects.filter(pk__in=[course.pk for course in courses]).count() == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_a_settled_decision_is_marked_applied(
    user, make_run, make_change, course_factory, catalog_mapping_decision_factory
):
    courses = [course_factory(ukma_data_id="ud-course") for _ in range(2)]
    run = make_run()
    change = make_change(
        run,
        kind="merge_courses",
        key="ud-course",
        after=_merge_after(courses),
        before={},
    )
    change.ukma_data_id = "ud-course"
    change.save(update_fields=["ukma_data_id"])
    decision = catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-course",
        ukma_course_id="ud-course",
        course=None,
        answer=MappingAnswer.KEEP_APART,
        premise=_merge_premise(courses),
    )

    approve([change.pk], user)

    decision.refresh_from_db()
    assert decision.applied_at is not None
    assert CatalogMappingDecision.objects.filter(superseded_at__isnull=True).count() == 1
