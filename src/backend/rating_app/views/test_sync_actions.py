from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

import pytest

from rating_app.models import (
    CatalogMappingDecision,
    CourseInstructor,
    Instructor,
    MappingAnswer,
    SyncApproval,
    SyncChangeGroup,
    SyncChangeState,
    SyncRunStatus,
    SyncSource,
)
from rating_app.models.choices import InstructorRole
from rating_app.sync import apply, handlers
from rating_app.sync.handlers import Handler

ROLE = InstructorRole.LECTURE_INSTRUCTOR.value
EMAIL = "sync.teacher@example.com"


@contextmanager
def _lock_free(_key: int):
    yield True


@contextmanager
def _lock_taken(_key: int):
    yield False


@pytest.fixture
def superuser_client(token_client):
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


def _run(
    sync_run_factory,
    *,
    source: str = SyncSource.TEACHERS,
    age_hours: int = 0,
):
    return sync_run_factory(
        source=source,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now() - timedelta(hours=age_hours),
    )


def _teacher_unit(sync_change_factory, run, offering):
    created = sync_change_factory(
        run=run,
        source=SyncSource.TEACHERS,
        group=SyncChangeGroup.NEW,
        kind="teacher_created",
        key=EMAIL,
        after={
            "email": EMAIL,
            "last_name": "Тестенко",
            "first_name": "Тест",
            "middle_name": "",
        },
    )
    added = sync_change_factory(
        run=run,
        source=SyncSource.TEACHERS,
        group=SyncChangeGroup.CHANGE,
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{EMAIL}",
        target_id=str(offering.pk),
        before={"links": []},
        after={"teacher_email": EMAIL, "role": ROLE},
        requires=[{"kind": "teacher_created", "key": EMAIL}],
    )
    return created, added


def _change(
    sync_change_factory,
    run,
    *,
    kind: str,
    key: str,
    target_id: str | None,
    after: dict,
    ukma_data_id: str | None = None,
):
    return sync_change_factory(
        run=run,
        source=SyncSource.CATALOG,
        group=SyncChangeGroup.MAPPING,
        kind=kind,
        key=key,
        target_id=target_id,
        ukma_data_id=ukma_data_id,
        after=after,
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_applies_a_teacher_unit(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    run = _run(sync_run_factory)
    offering = course_offering_factory()
    created, added = _teacher_unit(sync_change_factory, run, offering)

    response = superuser_client.post(
        reverse_approve(),
        {"source": "teachers", "group": "change", "change_ids": [added.pk]},
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "applied"
    assert body["counts"]["applied"] == 2
    assert body["counts"]["waiting"] == 0
    assert body["counts"]["skipped"] == 0
    teacher = Instructor.objects.get(email=EMAIL)
    assert CourseInstructor.objects.filter(
        course_offering=offering, instructor=teacher, role=ROLE
    ).exists()
    for change in (created, added):
        change.refresh_from_db()
        assert change.state == SyncChangeState.APPLIED
        assert change.approval_id == body["id"]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_dry_run_previews_and_changes_nothing(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    run = _run(sync_run_factory)
    offering = course_offering_factory()
    created, added = _teacher_unit(sync_change_factory, run, offering)

    response = superuser_client.post(
        reverse_approve(),
        {"source": "teachers", "group": "change", "change_ids": [added.pk], "dry_run": True},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["counts"]["applied"] == 2
    assert response.json()["id"] is None
    assert not Instructor.objects.filter(email=EMAIL).exists()
    assert SyncApproval.objects.count() == 0
    for change in (created, added):
        change.refresh_from_db()
        assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_returns_500_and_keeps_changes_proposed_when_a_handler_fails(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)

    def fail(_change):
        raise RuntimeError("handler broke")

    monkeypatch.setitem(handlers.HANDLERS, "teacher_created", Handler(apply=fail))
    run = _run(sync_run_factory)
    offering = course_offering_factory()
    created, added = _teacher_unit(sync_change_factory, run, offering)

    response = superuser_client.post(
        reverse_approve(),
        {"source": "teachers", "group": "change", "change_ids": [added.pk]},
        format="json",
    )

    assert response.status_code == 500
    body = response.json()
    assert body["status"] == 500
    assert body["detail"] == "Не вдалося застосувати зміни"
    for change in (created, added):
        change.refresh_from_db()
        assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_rejects_a_selection_from_several_runs_in_ukrainian(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    _, first = _teacher_unit(sync_change_factory, _run(sync_run_factory), course_offering_factory())
    _, second = _teacher_unit(
        sync_change_factory, _run(sync_run_factory), course_offering_factory()
    )

    response = superuser_client.post(
        reverse_approve(),
        {"source": "teachers", "group": "change", "change_ids": [first.pk, second.pk]},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["fields"]["change_ids"] == ["Вибрані зміни належать різним запускам"]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_returns_409_when_the_source_lock_is_held(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_taken)
    run = _run(sync_run_factory)
    offering = course_offering_factory()
    _, added = _teacher_unit(sync_change_factory, run, offering)

    response = superuser_client.post(
        reverse_approve(),
        {"source": "teachers", "group": "change", "change_ids": [added.pk]},
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Синхронізація саме триває"
    added.refresh_from_db()
    assert added.state == SyncChangeState.PROPOSED
    assert not Instructor.objects.filter(email=EMAIL).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_asks_to_confirm_a_run_older_than_48_hours(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    run = _run(sync_run_factory, age_hours=50)
    offering = course_offering_factory()
    _, added = _teacher_unit(sync_change_factory, run, offering)

    refused = superuser_client.post(
        reverse_approve(),
        {"source": "teachers", "group": "change", "change_ids": [added.pk]},
        format="json",
    )

    assert refused.status_code == 409
    assert refused.json()["detail"].startswith("Дані старші за 48 год")
    added.refresh_from_db()
    assert added.state == SyncChangeState.PROPOSED

    confirmed = superuser_client.post(
        reverse_approve(),
        {
            "source": "teachers",
            "group": "change",
            "change_ids": [added.pk],
            "confirm_stale": True,
        },
        format="json",
    )

    assert confirmed.status_code == 200
    assert confirmed.json()["counts"]["applied"] == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_marks_the_unit_rejected(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    run = _run(sync_run_factory)
    offering = course_offering_factory()
    created, added = _teacher_unit(sync_change_factory, run, offering)

    response = superuser_client.post(reverse_reject(), {"change_ids": [added.pk]}, format="json")

    assert response.status_code == 200
    assert response.json()["counts"]["rejected"] == 2
    for change in (created, added):
        change.refresh_from_db()
        assert change.state == SyncChangeState.REJECTED


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_writes_a_move_decision_with_its_refs_and_premise(
    superuser_client,
    sync_run_factory,
    sync_change_factory,
    course_factory,
    course_offering_factory,
):
    run = _run(sync_run_factory, source=SyncSource.CATALOG)
    source = course_factory()
    target = course_factory()
    offering = course_offering_factory(course=source)
    change = _change(
        sync_change_factory,
        run,
        kind="move_offering",
        key=str(offering.pk),
        target_id=str(offering.pk),
        ukma_data_id="ud-course-target",
        after={
            "from_course": str(source.pk),
            "ukma_course_id": "ud-course-target",
            "to_course_id": str(target.pk),
            "display": {"ukma_course": {"merge_source": None}},
        },
    )

    response = superuser_client.post(
        reverse_answer(change.pk), {"answer": MappingAnswer.MOVE}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "move_offering"
    assert body["answer"] == "move"
    assert body["ratings"] == 0
    decision = CatalogMappingDecision.objects.get(pk=body["decision_id"])
    assert decision.question_key == str(offering.pk)
    assert decision.ukma_course_id == "ud-course-target"
    assert decision.course_ref == str(source.pk)
    assert decision.offering_ref == str(offering.pk)
    assert decision.into_ref == str(target.pk)
    assert decision.premise == {
        "course_ids": sorted([str(source.pk), str(target.pk)]),
        "ukma_course_id": "ud-course-target",
        "merge_source": None,
        "ratings": 0,
        "saz_code": offering.code,
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_answer_returns_400_for_a_change_that_is_not_a_mapping_question(
    superuser_client, sync_run_factory, sync_change_factory
):
    run = _run(sync_run_factory, source=SyncSource.CATALOG)
    change = sync_change_factory(
        run=run,
        source=SyncSource.CATALOG,
        group=SyncChangeGroup.LINK,
        kind="link_course",
        key="course-key",
        after={"ukma_data_id": "ud-course"},
    )

    response = superuser_client.post(
        reverse_answer(change.pk), {"answer": MappingAnswer.KEEP}, format="json"
    )

    assert response.status_code == 400
    assert "Відповісти можна лише на питання зіставлення" in response.json()["fields"]["answer"][0]
    assert not CatalogMappingDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_keep_apart_unrated_answers_only_the_unrated_questions(
    superuser_client,
    sync_run_factory,
    sync_change_factory,
    course_factory,
    course_offering_factory,
    rating_factory,
):
    run = _run(sync_run_factory, source=SyncSource.CATALOG)
    quiet = [course_factory(), course_factory()]
    rated = [course_factory(), course_factory()]
    rating_factory(course_offering=course_offering_factory(course=rated[0]))
    quiet_change = _change(
        sync_change_factory,
        run,
        kind="merge_courses",
        key="ud-quiet",
        target_id=None,
        ukma_data_id="ud-quiet",
        after={
            "merge_source": None,
            "courses": [{"id": str(course.pk), "ratings": 0} for course in quiet],
        },
    )
    rated_change = _change(
        sync_change_factory,
        run,
        kind="merge_courses",
        key="ud-rated",
        target_id=None,
        ukma_data_id="ud-rated",
        after={
            "merge_source": None,
            "courses": [{"id": str(course.pk), "ratings": 1} for course in rated],
        },
    )

    response = superuser_client.post(reverse_bulk_answer(), format="json")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    decision = CatalogMappingDecision.objects.get(kind="merge_courses", question_key="ud-quiet")
    assert decision.answer == MappingAnswer.KEEP_APART
    assert decision.premise["course_ids"] == sorted(str(course.pk) for course in quiet)
    assert not CatalogMappingDecision.objects.filter(question_key="ud-rated").exists()
    quiet_change.refresh_from_db()
    rated_change.refresh_from_db()
    assert quiet_change.state == SyncChangeState.PROPOSED


def reverse_approve():
    return reverse("ukma-data-sync-approve")


def reverse_reject():
    return reverse("ukma-data-sync-reject")


def reverse_answer(change_id):
    return reverse("ukma-data-sync-change-answer", kwargs={"change_id": change_id})


def reverse_bulk_answer():
    return reverse("ukma-data-sync-keep-apart-unrated")
