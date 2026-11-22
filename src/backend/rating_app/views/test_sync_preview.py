from __future__ import annotations

import uuid
from contextlib import contextmanager

from django.urls import reverse
from django.utils import timezone

import pytest

from rating_app.models import (
    MappingAnswer,
    SyncApproval,
    SyncApprovalOutcome,
    SyncChangeState,
    SyncPreview,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import apply, handlers, selection
from rating_app.sync.handlers import Handler


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


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def teacher_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


def _teacher_unit(sync_change_factory, run, offering, email="sync.teacher@example.com"):
    created = sync_change_factory(
        run=run,
        source=SyncSource.TEACHERS,
        group="new",
        kind="teacher_created",
        key=email,
        after={
            "email": email,
            "last_name": "Тестенко",
            "first_name": "Тест",
            "middle_name": "",
        },
    )
    added = sync_change_factory(
        run=run,
        source=SyncSource.TEACHERS,
        group="change",
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after={"teacher_email": email, "role": "LECTURE_INSTRUCTOR"},
        requires=[{"kind": "teacher_created", "key": email}],
    )
    return created, added


def _merge_fixture(
    catalog_run,
    course_factory,
    course_offering_factory,
    rating_factory,
    planned_course_factory,
    student_factory,
    sync_change_factory,
    catalog_mapping_decision_factory,
):
    source = course_factory(title="Алгоритми")
    target = course_factory(title="Алгоритми і структури даних")
    target.ukma_data_id = "ud-merge"
    target.save(update_fields=["ukma_data_id"])
    target_offering = course_offering_factory(course=target)
    source_offering = course_offering_factory(course=source)
    for _ in range(2):
        rating_factory(course_offering=target_offering)
    for _ in range(4):
        rating_factory(course_offering=source_offering)
    planned_course_factory(offering=source_offering, student=student_factory())
    change = sync_change_factory(
        run=catalog_run,
        source=SyncSource.CATALOG,
        group="mapping",
        kind="merge_courses",
        key="ud-merge",
        ukma_data_id="ud-merge",
        ratings=6,
        after={
            "merge_source": None,
            "courses": [
                {
                    "id": str(source.pk),
                    "title": source.title,
                    "department": {
                        "id": str(source.department_id),
                        "ukma_data_id": None,
                        "name": source.department.name,
                    },
                    "years": [2025],
                    "ratings": 4,
                },
                {
                    "id": str(target.pk),
                    "title": target.title,
                    "department": {
                        "id": str(target.department_id),
                        "ukma_data_id": None,
                        "name": target.department.name,
                    },
                    "years": [2025],
                    "ratings": 2,
                },
            ],
            "display": {
                "courses": [{"title": source.title}, {"title": target.title}],
                "ukma_course": {"title": target.title, "id": "ud-merge"},
            },
        },
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-merge",
        answer=MappingAnswer.MERGE,
        into=target,
        into_ref=str(target.pk),
    )
    return change, source, target, source_offering


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_a_token_counts_and_moved_rows(
    superuser_client,
    monkeypatch,
    catalog_run,
    course_factory,
    course_offering_factory,
    rating_factory,
    planned_course_factory,
    student_factory,
    sync_change_factory,
    catalog_mapping_decision_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    monkeypatch.setitem(handlers.HANDLERS, "merge_courses", Handler(apply=lambda change: None))
    change, _, target, _ = _merge_fixture(
        catalog_run,
        course_factory,
        course_offering_factory,
        rating_factory,
        planned_course_factory,
        student_factory,
        sync_change_factory,
        catalog_mapping_decision_factory,
    )

    response = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {"source": "catalog", "selection": {"filter": {"group": "mapping"}}},
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token"] == selection.token_for(catalog_run.pk, [change.pk])
    assert body["count"] == 1
    assert body["counts"] == {"merge_courses": {"apply": 1, "wait": 0, "superseded": 0}}
    assert body["ratings_moved"] == 4
    assert body["plans_moved"] == 1
    assert body["run_age_hours"] == 0
    assert SyncPreview.objects.filter(token=body["token"]).exists()
    assert SyncApproval.objects.count() == 0
    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_rejects_a_change_from_another_run(
    superuser_client, catalog_run, sync_run_factory, sync_change_factory
):
    other_run = sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )
    foreign = sync_change_factory(run=other_run, kind="link_course", key="foreign")

    response = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {
            "source": "catalog",
            "run": catalog_run.pk,
            "selection": {"change_ids": [foreign.pk]},
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["fields"]["selection"] == ["Деяких вибраних змін не існує"]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_with_a_stale_token_returns_409(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    offering = course_offering_factory()
    _teacher_unit(sync_change_factory, teacher_run, offering, "first@example.com")
    first = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {"source": "teachers", "selection": {"filter": {"group": "change"}}},
        format="json",
    ).json()
    _teacher_unit(sync_change_factory, teacher_run, offering, "second@example.com")

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "token": first["token"],
            "selection": {"filter": {"group": "change"}},
        },
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["detail"] == ("Список змінився: було 1, стало 2. Перегляньте ще раз")
    assert response.json()["code"] == "selection_changed"
    assert response.json()["status"] == 409
    assert response.json()["holder"] == "other_user"
    assert response.json()["run_age_hours"] == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_with_a_matching_token_applies_the_previewed_set(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    offering = course_offering_factory()
    created, added = _teacher_unit(sync_change_factory, teacher_run, offering)
    preview = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {"source": "teachers", "selection": {"filter": {"group": "change"}}},
        format="json",
    ).json()

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "token": preview["token"],
            "selection": {"filter": {"group": "change"}},
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["outcome"] == "applied"
    assert response.json()["counts"]["applied"] == 2
    for change in (created, added):
        change.refresh_from_db()
        assert change.state == SyncChangeState.APPLIED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_requires_a_token_for_a_filter_selection(
    superuser_client, monkeypatch, teacher_run, sync_change_factory, course_offering_factory
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {"source": "teachers", "selection": {"filter": {"group": "change"}}},
        format="json",
    )

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["token"]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_returns_the_first_approval_when_a_client_key_races(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    sync_approval_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    _created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    key = uuid.UUID("5d1e7c2a-3b4f-4a6e-8c9d-0e1f2a3b4c5d")
    winner = sync_approval_factory(
        run=teacher_run, user=superuser_client.user, client_key=key, change_ids=[added.pk]
    )

    approval = apply.approve([added.pk], superuser_client.user, client_key=key)

    assert approval.pk == winner.pk
    added.refresh_from_db()
    assert added.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_is_idempotent_by_client_key(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    key = "0a2c9f0e-4f5a-4b9e-9a67-1c2d3e4f5a6b"

    first = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "group": "change",
            "change_ids": [added.pk],
            "client_key": key,
        },
        format="json",
    )
    second = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "group": "change",
            "change_ids": [added.pk],
            "client_key": key,
        },
        format="json",
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert SyncApproval.objects.filter(client_key=key).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("holder", "user_null"),
    [("nightly", True), ("self", False)],
)
def test_approve_409_names_the_holder(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
    sync_approval_factory,
    user_factory,
    holder,
    user_null,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_taken)
    if holder == "self":
        sync_approval_factory(
            run=teacher_run,
            user=superuser_client.user,
            outcome=SyncApprovalOutcome.STARTED,
        )
    else:
        sync_approval_factory(
            run=teacher_run,
            user=None if user_null else user_factory(),
            outcome=SyncApprovalOutcome.STARTED,
        )
    created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {"source": "teachers", "group": "change", "change_ids": [added.pk]},
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["holder"] == holder
    assert response.json()["run_age_hours"] == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_409_names_another_user(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
    sync_approval_factory,
    user_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_taken)
    sync_approval_factory(
        run=teacher_run,
        user=user_factory(),
        outcome=SyncApprovalOutcome.STARTED,
    )
    _, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {"source": "teachers", "group": "change", "change_ids": [added.pk]},
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["holder"] == "other_user"


@pytest.mark.django_db
@pytest.mark.integration
def test_approvals_active_returns_the_newest_started(
    superuser_client, catalog_run, sync_approval_factory, user_factory
):
    empty = superuser_client.get(reverse("ukma-data-sync-approvals-active"))
    assert empty.json() == {"item": None}

    started = sync_approval_factory(
        run=catalog_run,
        user=superuser_client.user,
        outcome=SyncApprovalOutcome.STARTED,
        group="link",
        change_ids=[1, 2, 3],
    )
    sync_approval_factory(
        run=catalog_run,
        user=user_factory(),
        outcome=SyncApprovalOutcome.APPLIED,
    )

    body = superuser_client.get(reverse("ukma-data-sync-approvals-active")).json()

    assert body["item"]["id"] == started.pk
    assert body["item"]["selection"] == "Зв'язки, 3 зміни"
    assert body["item"]["user_email"] == superuser_client.user.email


@pytest.mark.django_db
@pytest.mark.integration
def test_run_approvals_list_selection_and_moved_rows(
    superuser_client,
    catalog_run,
    sync_change_factory,
    sync_approval_factory,
    catalog_mapping_decision_factory,
    course_factory,
    course_offering_factory,
    planned_course_factory,
    student_factory,
):
    from_course = course_factory(title="Старий курс")
    into_course = course_factory(title="Новий курс")
    source_offering = course_offering_factory(course=from_course)
    planned_course_factory(offering=source_offering, student=student_factory())
    approval = sync_approval_factory(
        run=catalog_run,
        user=superuser_client.user,
        outcome=SyncApprovalOutcome.APPLIED,
        group="mapping",
        change_ids=[1],
        counts={"applied": 1},
    )
    sync_change_factory(
        run=catalog_run,
        group="mapping",
        kind="merge_courses",
        key="ud-merge",
        ukma_data_id="ud-merge",
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
        ratings=5,
        after={
            "merge_source": None,
            "courses": [
                {"id": str(from_course.pk), "title": from_course.title, "ratings": 5},
                {"id": str(into_course.pk), "title": into_course.title, "ratings": 0},
            ],
        },
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-merge",
        answer=MappingAnswer.MERGE,
        into=into_course,
        into_ref=str(into_course.pk),
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-approvals", kwargs={"run_id": catalog_run.pk})
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["selection"] == "Питання, 1 зміна"
    assert item["user_email"] == superuser_client.user.email
    assert item["ratings_moved"] == 5
    assert item["plans_moved"] == 1
    assert item["merged"] == [
        {
            "from_id": str(from_course.pk),
            "into_id": str(into_course.pk),
            "title": from_course.title,
        }
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_run_export_has_a_bom_and_the_header(
    superuser_client,
    catalog_run,
    sync_change_factory,
    sync_approval_factory,
):
    approval = sync_approval_factory(
        run=catalog_run,
        user=superuser_client.user,
        outcome=SyncApprovalOutcome.APPLIED,
        group="link",
        change_ids=[1],
    )
    sync_change_factory(
        run=catalog_run,
        kind="link_course",
        key="course-key",
        target_id="target-1",
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-export", kwargs={"run_id": catalog_run.pk})
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv; charset=utf-8"
    assert response.content.startswith(b"\xef\xbb\xbf")
    text = response.content.decode("utf-8-sig")
    lines = text.splitlines()
    assert lines[0] == "type,kind,key,target_id,approval_id,user_email,time"
    assert any(line.startswith(f"approval,link,,,{approval.pk},") for line in lines)
    assert any(
        line.startswith(f"change,link_course,course-key,target-1,{approval.pk},") for line in lines
    )
    assert superuser_client.user.email in text


@pytest.mark.django_db
@pytest.mark.integration
def test_run_export_opens_a_formula_like_key_as_text(
    superuser_client, catalog_run, sync_change_factory
):
    sync_change_factory(
        run=catalog_run,
        kind="link_course",
        key="=HYPERLINK(1)",
        state=SyncChangeState.APPLIED,
        decided_at=timezone.now(),
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-export", kwargs={"run_id": catalog_run.pk})
    )

    assert "change,link_course,'=HYPERLINK(1)," in response.content.decode("utf-8-sig")


@pytest.mark.django_db
@pytest.mark.integration
def test_run_approvals_and_export_return_404_for_an_unknown_run(superuser_client):
    assert (
        superuser_client.get(
            reverse("ukma-data-sync-run-approvals", kwargs={"run_id": 999_999})
        ).status_code
        == 404
    )
    assert (
        superuser_client.get(
            reverse("ukma-data-sync-run-export", kwargs={"run_id": 999_999})
        ).status_code
        == 404
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_with_a_token_and_ids_needs_no_group(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    _, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    preview = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {"source": "teachers", "selection": {"change_ids": [added.pk]}},
        format="json",
    ).json()

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "token": preview["token"],
            "selection": {"change_ids": [added.pk]},
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["outcome"] == "applied"


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_refuses_a_whole_group_without_a_preview(
    superuser_client, teacher_run, sync_change_factory, course_offering_factory
):
    created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {"source": "teachers", "group": "change"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["fields"]["token"] == ["Спочатку перегляньте вибірку"]
    for change in (created, added):
        change.refresh_from_db()
        assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_refuses_a_token_nobody_previewed(
    superuser_client, teacher_run, sync_change_factory, course_offering_factory
):
    created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    forged = selection.token_for(teacher_run.pk, [created.pk, added.pk])

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "token": forged,
            "selection": {"filter": {"group": "change"}},
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["fields"]["token"] == ["Спочатку перегляньте вибірку"]
    added.refresh_from_db()
    assert added.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_refuses_a_token_another_user_previewed(
    superuser_client,
    user_factory,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
):
    created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    token = selection.token_for(teacher_run.pk, [created.pk, added.pk])
    selection.record_preview(token, teacher_run, user_factory(is_superuser=True), 2)

    response = superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "token": token,
            "selection": {"filter": {"group": "change"}},
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["fields"]["token"] == ["Спочатку перегляньте вибірку"]


@pytest.mark.django_db
@pytest.mark.integration
def test_history_names_a_real_approval_by_the_group_it_applied(
    superuser_client,
    monkeypatch,
    teacher_run,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    preview = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {"source": "teachers", "selection": {"filter": {"group": "new"}}},
        format="json",
    ).json()
    superuser_client.post(
        reverse("ukma-data-sync-approve"),
        {
            "source": "teachers",
            "token": preview["token"],
            "selection": {"filter": {"group": "new"}},
        },
        format="json",
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-approvals", kwargs={"run_id": teacher_run.pk})
    )

    assert response.json()["items"][0]["selection"] == "Нові записи, 2 зміни"
