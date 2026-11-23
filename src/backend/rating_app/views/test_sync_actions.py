from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

import pytest

from rating_app.models import (
    SyncApproval,
    SyncChange,
    SyncChangeState,
    SyncPolicyChange,
    SyncRunStatus,
    SyncSource,
)

PREVIEW = "ukma-data-sync-preview"
APPLY = "ukma-data-sync-apply"
REJECT = "ukma-data-sync-reject"
REVERT = "ukma-data-sync-revert"
JOURNAL = "ukma-data-sync-journal"

NEW_TITLE = "Тестова дисципліна Б"


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
def staff_client(token_client):
    token_client.user.is_staff = True
    token_client.user.save()
    return token_client


@pytest.fixture
def free_sync_locks(monkeypatch):
    """The tests run on SQLite, which has no advisory locks."""
    monkeypatch.setattr("rating_app.sync.apply.advisory_lock", _lock_free)
    monkeypatch.setattr("rating_app.sync.revert.advisory_lock", _lock_free)


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def make_change(sync_change_factory, catalog_run):
    def build(course, *, new_title=NEW_TITLE, run=None, **kwargs):
        return sync_change_factory(
            run=run or catalog_run,
            source=SyncSource.CATALOG,
            group="change",
            kind="change_course",
            key=str(course.pk),
            target_id=str(course.pk),
            before={"title": course.title},
            after={"title": new_title},
            **kwargs,
        )

    return build


def _call(client, method, route, body):
    url = reverse(route)
    if method == "get":
        return client.get(url)
    return client.post(url, body, format="json")


def _preview(client, run, *, group="change", change_ids=None, **extra):
    body: dict[str, object] = {"run": run.pk, **extra}
    if change_ids is None:
        body["group"] = group
    else:
        body["change_ids"] = change_ids
    return client.post(reverse(PREVIEW), body, format="json")


def _token(client, run, *, group="change", change_ids=None):
    response = _preview(client, run, group=group, change_ids=change_ids)
    assert response.status_code == 200, response.json()
    return str(response.json()["token"])


def _apply(client, run, token, key, *, group="change", change_ids=None):
    body: dict[str, object] = {"run": run.pk, "token": token, "client_key": str(key)}
    if change_ids is None:
        body["group"] = group
    else:
        body["change_ids"] = change_ids
    return client.post(reverse(APPLY), body, format="json")


def _reject(client, run, key, *, group="change", change_ids=None):
    body: dict[str, object] = {"run": run.pk, "client_key": str(key)}
    if change_ids is None:
        body["group"] = group
    else:
        body["change_ids"] = change_ids
    return client.post(reverse(REJECT), body, format="json")


def _revert(client, approval_id, *, dry_run=True):
    return client.post(
        reverse(REVERT),
        {"approval_id": approval_id, "dry_run": dry_run},
        format="json",
    )


def _applied_decision(client, run, *, group="change"):
    token = _token(client, run, group=group)
    response = _apply(client, run, token, uuid.uuid4(), group=group)
    assert response.status_code == 200, response.json()
    return response.json()["decision_id"]


@pytest.mark.parametrize(
    ("method", "route", "body"),
    [
        ("post", PREVIEW, {"group": "change"}),
        ("post", APPLY, {"group": "change", "token": "token", "client_key": str(uuid.uuid4())}),
        ("post", REJECT, {"group": "change", "client_key": str(uuid.uuid4())}),
        ("post", REVERT, {"approval_id": 1}),
        ("get", JOURNAL, {}),
    ],
)
def test_sync_actions_return_403_when_anonymous(api_client, method, route, body):
    response = _call(api_client, method, route, body)

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("method", "route", "body"),
    [
        ("post", PREVIEW, {"group": "change"}),
        ("post", APPLY, {"group": "change", "token": "token", "client_key": str(uuid.uuid4())}),
        ("post", REJECT, {"group": "change", "client_key": str(uuid.uuid4())}),
        ("post", REVERT, {"approval_id": 1}),
        ("get", JOURNAL, {}),
    ],
)
def test_sync_actions_return_403_when_not_a_superuser(token_client, method, route, body):
    response = _call(token_client, method, route, body)

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(
    ("method", "route", "body"),
    [
        ("post", PREVIEW, {"group": "change"}),
        ("post", APPLY, {"group": "change", "token": "token", "client_key": str(uuid.uuid4())}),
        ("post", REJECT, {"group": "change", "client_key": str(uuid.uuid4())}),
        ("post", REVERT, {"approval_id": 1}),
        ("get", JOURNAL, {}),
    ],
)
def test_sync_actions_return_403_when_staff_but_not_a_superuser(staff_client, method, route, body):
    response = _call(staff_client, method, route, body)

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_a_token_counts_and_the_run_age(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)

    response = _preview(superuser_client, catalog_run)

    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert "dry_run" not in body
    assert "outcome" not in body
    assert body["counts"]["applied"] == 1
    assert body["counts"]["by_kind"] == [{"kind": "change_course", "count": 1}]
    assert body["counts"]["remaining"] == 0
    assert body["run"]["id"] == catalog_run.pk
    assert body["run"]["age_hours"] == 0
    assert body["detail"] == "Застосується 1 зміну."
    change.refresh_from_db()
    course.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED
    assert course.title == "Тестова дисципліна А"
    assert not SyncApproval.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_lists_a_change_waiting_on_another(
    superuser_client, free_sync_locks, catalog_run, course_factory, sync_change_factory
):
    course = course_factory(title="Тестова дисципліна А")
    link = sync_change_factory(
        run=catalog_run,
        source=SyncSource.CATALOG,
        group="link",
        kind="link_course",
        key=str(course.pk),
        target_id=str(course.pk),
        after={"ukma_data_id": "ud-course-test"},
    )
    sync_change_factory(
        run=catalog_run,
        source=SyncSource.CATALOG,
        group="new",
        kind="new_offering",
        key="SAZ-TEST-1",
        after={"saz_code": "SAZ-TEST-1"},
        requires=[{"kind": "link_course", "key": str(course.pk)}],
    )

    response = _preview(superuser_client, catalog_run, group="new")

    assert response.status_code == 200
    body = response.json()
    assert body["counts"]["applied"] == 0
    assert body["counts"]["waiting"] == 1
    assert body["waiting_reasons"][0]["code"] == "waiting_on"
    assert body["waiting_reasons"][0]["count"] == 1
    assert body["detail"] == "Нічого не буде застосовано."
    link.refresh_from_db()
    assert link.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_lists_a_superseded_change_with_its_reason(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    first = course_factory(title="Тестова дисципліна А")
    second = course_factory(title="Тестова дисципліна В")
    good = make_change(first)
    stale = make_change(second, state=SyncChangeState.SUPERSEDED, state_reason="replaced")

    response = _preview(superuser_client, catalog_run, change_ids=[good.pk, stale.pk])

    assert response.status_code == 200
    body = response.json()
    assert body["counts"]["applied"] == 1
    assert body["counts"]["skipped"] == 1
    assert body["skipped_reasons"] == [
        {"code": "replaced", "text": "замінена новішою зміною", "count": 1}
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_reports_what_the_cap_leaves(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    monkeypatch.setattr("rating_app.views.sync_actions_viewset.MAX_CHANGES", 1)
    first = course_factory(title="Тестова дисципліна А")
    second = course_factory(title="Тестова дисципліна В")
    make_change(first)
    make_change(second)

    response = _preview(superuser_client, catalog_run)

    assert response.status_code == 200
    body = response.json()
    assert body["counts"]["applied"] == 1
    assert body["counts"]["remaining"] == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_400_for_an_unknown_kind(superuser_client, catalog_run):
    response = _preview(superuser_client, catalog_run, kind="catalog_refactored")

    assert response.status_code == 400
    assert response.json()["fields"]["kind"] == ["Невідомий вид зміни"]


@pytest.mark.django_db
@pytest.mark.integration
def test_the_cap_reports_over_cap_changes_only_as_remaining(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    monkeypatch.setattr("rating_app.views.sync_actions_viewset.MAX_CHANGES", 2)
    for _ in range(3):
        make_change(course_factory(title="Тестова дисципліна А"))
    key = uuid.uuid4()

    preview = _preview(superuser_client, catalog_run)

    assert preview.status_code == 200
    body = preview.json()
    assert body["counts"] == {
        "applied": 2,
        "rejected": 0,
        "skipped": 0,
        "waiting": 0,
        "superseded": 0,
        "remaining": 1,
        "total": 2,
        "by_kind": [{"kind": "change_course", "count": 2}],
    }
    assert body["skipped_reasons"] == []
    assert body["waiting_reasons"] == []

    applied = _apply(superuser_client, catalog_run, body["token"], key)
    replay = _apply(superuser_client, catalog_run, body["token"], key)

    assert applied.status_code == 200, applied.json()
    assert replay.status_code == 200, replay.json()
    assert applied.json()["counts"] == body["counts"]
    assert replay.json()["counts"] == body["counts"]
    assert SyncApproval.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_of_an_empty_group_answers_422(
    superuser_client, catalog_run, course_factory, make_change
):
    make_change(
        course_factory(title="Тестова дисципліна А"),
        state=SyncChangeState.APPLIED,
        decided_at=timezone.now(),
    )

    response = _preview(superuser_client, catalog_run)

    assert response.status_code == 422
    assert response.json()["code"] == "no_proposed_changes"
    assert response.json()["detail"] == "Серед вибраних немає змін, що чекають рішення."


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_409_when_the_lock_is_held(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    make_change(course_factory(title="Тестова дисципліна А"))
    monkeypatch.setattr("rating_app.sync.apply.advisory_lock", _lock_taken)

    response = _preview(superuser_client, catalog_run)

    assert response.status_code == 409
    assert response.json()["code"] == "lock_held"
    assert response.json()["detail"].startswith("Синхронізація саме триває")


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_409_when_the_run_is_not_current(
    superuser_client,
    free_sync_locks,
    sync_run_factory,
    catalog_run,
    course_factory,
    make_change,
):
    make_change(course_factory(title="Тестова дисципліна А"))
    sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )

    response = _preview(superuser_client, catalog_run)

    assert response.status_code == 409
    assert response.json()["code"] == "run_not_current"


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_409_for_a_run_older_than_48_hours(
    superuser_client, free_sync_locks, sync_run_factory, course_factory, make_change
):
    run = sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now() - timedelta(hours=50),
    )
    make_change(course_factory(title="Тестова дисципліна А"), run=run)

    response = _preview(superuser_client, run)

    assert response.status_code == 409
    assert response.json()["code"] == "run_too_old"
    assert response.json()["detail"] == (
        "Дані САЗ старші за 48 год. Дочекайтеся нічного читання або "
        "застосуйте в консолі з --confirm-stale."
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_returns_422_when_nothing_is_proposed(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    change = make_change(
        course_factory(title="Тестова дисципліна А"),
        state=SyncChangeState.APPLIED,
        decided_at=timezone.now(),
    )

    response = _preview(superuser_client, catalog_run, change_ids=[change.pk])

    assert response.status_code == 422
    assert response.json()["code"] == "no_proposed_changes"


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_writes_the_previewed_selection(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)
    token = _token(superuser_client, catalog_run)

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4())

    assert response.status_code == 200
    body = response.json()
    assert body["decision_id"] is not None
    assert body["action"] == "apply"
    assert body["counts"]["applied"] == 1
    assert body["counts"]["by_kind"] == [{"kind": "change_course", "count": 1}]
    assert body["detail"] == f"Застосовано 1 зміну. Рішення #{body['decision_id']}."
    course.refresh_from_db()
    change.refresh_from_db()
    assert course.title == NEW_TITLE
    assert change.state == SyncChangeState.APPLIED
    assert change.approval_id == body["decision_id"]


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_the_first_result_for_a_repeated_client_key(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    make_change(course)
    token = _token(superuser_client, catalog_run)
    key = uuid.uuid4()

    first = _apply(superuser_client, catalog_run, token, key)
    second = _apply(superuser_client, catalog_run, token, key)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["decision_id"] == first.json()["decision_id"]
    assert second.json()["counts"] == first.json()["counts"]
    assert SyncApproval.objects.count() == 1
    course.refresh_from_db()
    assert course.title == NEW_TITLE


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_409_when_the_selection_changed(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    first = make_change(course_factory(title="Тестова дисципліна А"))
    make_change(course_factory(title="Тестова дисципліна В"))
    token = _token(superuser_client, catalog_run)

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4(), change_ids=[first.pk])

    assert response.status_code == 409
    assert response.json()["code"] == "selection_changed"
    assert response.json()["detail"] == "Список змінився. Перегляньте ще раз."
    first.refresh_from_db()
    assert first.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_409_when_the_lock_is_held(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    change = make_change(course_factory(title="Тестова дисципліна А"))
    token = _token(superuser_client, catalog_run)
    monkeypatch.setattr("rating_app.sync.apply.advisory_lock", _lock_taken)

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4())

    assert response.status_code == 409
    assert response.json()["code"] == "lock_held"
    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_409_when_the_run_is_not_current(
    superuser_client,
    free_sync_locks,
    sync_run_factory,
    catalog_run,
    course_factory,
    make_change,
):
    make_change(course_factory(title="Тестова дисципліна А"))
    token = _token(superuser_client, catalog_run)
    sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4())

    assert response.status_code == 409
    assert response.json()["code"] == "run_not_current"


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_422_when_the_deadline_is_exceeded(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)
    token = _token(superuser_client, catalog_run)
    ticks = iter([0.0, 100.0])
    monkeypatch.setattr("rating_app.sync.apply.monotonic", lambda: next(ticks))

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4())

    assert response.status_code == 422
    assert response.json()["code"] == "deadline_exceeded"
    assert response.json()["detail"] == (
        "Не встигли вчасно, нічого не записано. Виберіть менше змін."
    )
    course.refresh_from_db()
    change.refresh_from_db()
    assert course.title == "Тестова дисципліна А"
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_422_when_nothing_is_proposed(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    change = make_change(course_factory(title="Тестова дисципліна А"))
    token = _token(superuser_client, catalog_run)
    SyncChange.objects.filter(pk=change.pk).update(
        state=SyncChangeState.APPLIED, decided_at=timezone.now()
    )

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4(), change_ids=[change.pk])

    assert response.status_code == 422
    assert response.json()["code"] == "no_proposed_changes"


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_returns_400_for_an_unknown_preview_token(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    make_change(course_factory(title="Тестова дисципліна А"))

    response = _apply(superuser_client, catalog_run, "missing-token", uuid.uuid4())

    assert response.status_code == 400
    assert response.json()["fields"]["token"] == ["Перегляд не знайдено. Перегляньте ще раз."]


@pytest.mark.django_db
@pytest.mark.integration
def test_apply_of_an_empty_group_answers_409_selection_changed(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    change = make_change(course_factory(title="Тестова дисципліна А"))
    token = _token(superuser_client, catalog_run)
    SyncChange.objects.filter(pk=change.pk).update(
        state=SyncChangeState.APPLIED, decided_at=timezone.now()
    )

    response = _apply(superuser_client, catalog_run, token, uuid.uuid4())

    assert response.status_code == 409
    assert response.json()["code"] == "selection_changed"
    assert response.json()["detail"] == "Список змінився. Перегляньте ще раз."


@pytest.mark.django_db
@pytest.mark.integration
def test_a_refused_attempt_replays_its_refusal(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    make_change(course_factory(title="Тестова дисципліна А"))
    token = _token(superuser_client, catalog_run)
    key = uuid.uuid4()
    monkeypatch.setattr("rating_app.sync.apply.advisory_lock", _lock_taken)

    first = _apply(superuser_client, catalog_run, token, key)
    second = _apply(superuser_client, catalog_run, token, key)

    assert first.status_code == 409
    assert second.status_code == 409
    assert second.json()["code"] == "lock_held"
    assert second.json()["decision_id"] == first.json()["decision_id"]
    assert SyncApproval.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_a_running_attempt_answers_409_in_progress(
    superuser_client, catalog_run, course_factory, make_change, sync_approval_factory
):
    make_change(course_factory(title="Тестова дисципліна А"))
    key = uuid.uuid4()
    sync_approval_factory(
        run=catalog_run,
        user=superuser_client.user,
        action="apply",
        outcome="started",
        client_key=key,
    )

    response = _apply(superuser_client, catalog_run, "token", key)

    assert response.status_code == 409
    assert response.json()["code"] == "in_progress"
    assert response.json()["detail"] == (
        "Рішення ще виконується. Перевірте Журнал, перш ніж повторювати."
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_a_reject_key_does_not_replay_on_apply(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    first = make_change(course_factory(title="Тестова дисципліна А"))
    second = make_change(course_factory(title="Тестова дисципліна В"))
    key = uuid.uuid4()
    rejected = _reject(superuser_client, catalog_run, key, change_ids=[first.pk])
    assert rejected.status_code == 200, rejected.json()

    token = _token(superuser_client, catalog_run, change_ids=[second.pk])
    response = _apply(superuser_client, catalog_run, token, key, change_ids=[second.pk])

    assert response.status_code == 400
    assert response.json()["fields"]["client_key"] == [
        "Цей ключ уже використано для іншого рішення. Спробуйте ще раз."
    ]
    assert rejected.json()["action"] == "reject"
    assert SyncApproval.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("route", [PREVIEW, APPLY, REJECT])
def test_an_unknown_run_answers_404(superuser_client, route):
    body: dict[str, object] = {"run": 999_999, "group": "change"}
    if route in {APPLY, REJECT}:
        body["client_key"] = str(uuid.uuid4())
    if route == APPLY:
        body["token"] = "token"

    response = _call(superuser_client, "post", route, body)

    assert response.status_code == 404
    assert response.json()["detail"] == "Запуск синхронізації не знайдено"


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_requires_exactly_one_selection(superuser_client, catalog_run):
    neither = superuser_client.post(
        reverse(REJECT), {"run": catalog_run.pk, "client_key": str(uuid.uuid4())}, format="json"
    )
    both = superuser_client.post(
        reverse(REJECT),
        {
            "run": catalog_run.pk,
            "group": "change",
            "change_ids": [1],
            "client_key": str(uuid.uuid4()),
        },
        format="json",
    )

    assert neither.status_code == 400
    assert both.status_code == 400
    assert neither.json()["fields"]["non_field_errors"] == ["Вкажіть або групу, або зміни"]
    assert both.json()["fields"]["non_field_errors"] == ["Вкажіть або групу, або зміни"]


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_requires_a_run(superuser_client):
    response = superuser_client.post(
        reverse(REJECT), {"group": "change", "client_key": str(uuid.uuid4())}, format="json"
    )

    assert response.status_code == 400
    assert "run" in response.json()["fields"]


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_of_an_empty_group_answers_422(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    make_change(
        course_factory(title="Тестова дисципліна А"),
        state=SyncChangeState.APPLIED,
        decided_at=timezone.now(),
    )

    response = _reject(superuser_client, catalog_run, uuid.uuid4())

    assert response.status_code == 422
    assert response.json()["code"] == "no_proposed_changes"


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_marks_changes_rejected_with_a_ukrainian_result(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)

    response = _reject(superuser_client, catalog_run, uuid.uuid4())

    assert response.status_code == 200
    body = response.json()
    assert body["action"] == "reject"
    assert body["counts"]["rejected"] == 1
    assert body["detail"] == f"Відхилено 1 зміну. Рішення #{body['decision_id']}."
    change.refresh_from_db()
    course.refresh_from_db()
    assert change.state == SyncChangeState.REJECTED
    assert course.title == "Тестова дисципліна А"


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_returns_the_first_result_for_a_repeated_client_key(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    make_change(course_factory(title="Тестова дисципліна А"))
    key = uuid.uuid4()

    first = _reject(superuser_client, catalog_run, key)
    second = _reject(superuser_client, catalog_run, key)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["decision_id"] == first.json()["decision_id"]
    assert SyncApproval.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_returns_409_when_the_lock_is_held(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    change = make_change(course_factory(title="Тестова дисципліна А"))
    monkeypatch.setattr("rating_app.sync.apply.advisory_lock", _lock_taken)

    response = _reject(superuser_client, catalog_run, uuid.uuid4())

    assert response.status_code == 409
    assert response.json()["code"] == "lock_held"
    change.refresh_from_db()
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_reject_returns_422_when_nothing_is_proposed(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    change = make_change(
        course_factory(title="Тестова дисципліна А"),
        state=SyncChangeState.APPLIED,
        decided_at=timezone.now(),
    )

    response = _reject(superuser_client, catalog_run, uuid.uuid4(), change_ids=[change.pk])

    assert response.status_code == 422
    assert response.json()["code"] == "no_proposed_changes"


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_dry_run_lists_what_would_be_reverted(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)
    decision_id = _applied_decision(superuser_client, catalog_run)

    response = _revert(superuser_client, decision_id)

    assert response.status_code == 200
    body = response.json()
    assert body["approval_id"] == decision_id
    assert body["decision_id"] is None
    assert body["dry_run"] is True
    assert body["outcome"] == "applied"
    assert body["code"] is None
    assert body["changes"] == [{"id": change.pk, "kind": "change_course"}]
    assert body["blockers"] == []
    assert body["reverted"] == 1
    course.refresh_from_db()
    assert course.title == NEW_TITLE


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_writes_back_and_returns_the_new_decision(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)
    decision_id = _applied_decision(superuser_client, catalog_run)

    response = _revert(superuser_client, decision_id, dry_run=False)

    assert response.status_code == 200
    body = response.json()
    assert body["approval_id"] == decision_id
    assert body["decision_id"] is not None
    assert body["outcome"] == "applied"
    assert body["code"] is None
    assert body["reverted"] == 1
    course.refresh_from_db()
    change.refresh_from_db()
    assert course.title == "Тестова дисципліна А"
    assert change.state == SyncChangeState.REVERTED


@pytest.mark.django_db
@pytest.mark.integration
def test_a_failed_revert_answers_the_stable_code(
    superuser_client, free_sync_locks, monkeypatch, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    make_change(course)
    decision_id = _applied_decision(superuser_client, catalog_run)

    def explode(*_args, **_kwargs):
        raise RuntimeError("test")

    monkeypatch.setattr("rating_app.sync.revert._write_back", explode)

    response = _revert(superuser_client, decision_id, dry_run=False)

    assert response.status_code == 500
    assert response.json()["code"] == "revert_failed"
    assert response.json()["detail"] == "Не вдалося відкотити рішення. Перегляньте Журнал."
    assert "RuntimeError" not in response.text
    course.refresh_from_db()
    assert course.title == NEW_TITLE


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_dry_run_lists_blockers(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    change = make_change(course)
    decision_id = _applied_decision(superuser_client, catalog_run)
    course.title = "Інша тестова дисципліна"
    course.save(update_fields=["title"])

    response = _revert(superuser_client, decision_id)

    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "refused"
    assert body["code"] == "revert_blocked"
    assert body["blockers"] == [
        {
            "change_id": change.pk,
            "kind": "change_course",
            "reason": "changed",
            "text": "запис змінився після застосування (назва)",
        }
    ]
    assert body["detail"] == f"Не можна відкотити рішення #{decision_id}: 1 зміна заважає."


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_returns_409_with_blockers_when_writing(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    course = course_factory(title="Тестова дисципліна А")
    make_change(course)
    decision_id = _applied_decision(superuser_client, catalog_run)
    course.title = "Інша тестова дисципліна"
    course.save(update_fields=["title"])

    response = _revert(superuser_client, decision_id, dry_run=False)

    assert response.status_code == 409
    assert response.json()["code"] == "revert_blocked"
    assert len(response.json()["blockers"]) == 1
    course.refresh_from_db()
    assert course.title == "Інша тестова дисципліна"


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_returns_404_for_an_unknown_decision(superuser_client):
    response = _revert(superuser_client, 999_999)

    assert response.status_code == 404
    assert response.json()["code"] == "unknown_approval"
    assert response.json()["detail"] == "Рішення не знайдено."


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_returns_409_when_the_decision_was_already_reverted(
    superuser_client, free_sync_locks, catalog_run, course_factory, make_change
):
    make_change(course_factory(title="Тестова дисципліна А"))
    decision_id = _applied_decision(superuser_client, catalog_run)
    assert _revert(superuser_client, decision_id, dry_run=False).status_code == 200

    response = _revert(superuser_client, decision_id, dry_run=False)

    assert response.status_code == 409
    assert response.json()["code"] == "already_reverted"
    assert response.json()["detail"] == "Це рішення вже відкочено."


@pytest.mark.django_db
@pytest.mark.integration
def test_journal_lists_entries_with_revertible_flags(
    superuser_client,
    catalog_run,
    user,
    course_factory,
    sync_approval_factory,
    sync_change_factory,
    sync_policy_change_factory,
):
    course = course_factory(title="Тестова дисципліна А")
    applied = sync_approval_factory(
        run=catalog_run, user=user, action="apply", outcome="applied", counts={"applied": 1}
    )
    sync_change_factory(
        run=catalog_run,
        state=SyncChangeState.APPLIED,
        approval=applied,
        kind="change_course",
        key=str(course.pk),
        target_id=str(course.pk),
        decided_at=timezone.now(),
        before={"title": "Тестова дисципліна А"},
        after={"title": NEW_TITLE},
    )
    rejected = sync_approval_factory(
        run=catalog_run, user=user, action="reject", outcome="applied", counts={"rejected": 2}
    )
    policy = sync_policy_change_factory(kind="link_course", user=user)
    SyncApproval.objects.filter(pk=applied.pk).update(
        created_at=timezone.now() - timedelta(hours=3)
    )
    SyncApproval.objects.filter(pk=rejected.pk).update(
        created_at=timezone.now() - timedelta(hours=2)
    )
    SyncPolicyChange.objects.filter(pk=policy.pk).update(
        changed_at=timezone.now() - timedelta(hours=1)
    )

    response = superuser_client.get(reverse(JOURNAL))

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["kind"] for item in items] == ["policy", "reject", "apply"]
    assert items[0]["revertible"] is False
    assert items[1]["revertible"] is False
    assert items[1]["revert_reason"] == ""
    assert items[2]["revertible"] is True
    assert items[2]["revert_reason"] == ""
    assert response.json()["next_before"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_journal_pages_with_before(superuser_client, catalog_run, user, sync_approval_factory):
    now = timezone.now()
    approvals = [
        sync_approval_factory(run=catalog_run, user=user, action="reject", outcome="applied")
        for _ in range(3)
    ]
    for index, approval in enumerate(approvals):
        SyncApproval.objects.filter(pk=approval.pk).update(
            created_at=now - timedelta(hours=3 - index)
        )

    first = superuser_client.get(reverse(JOURNAL), {"limit": 2})

    assert first.status_code == 200
    assert [item["id"] for item in first.json()["items"]] == [approvals[2].pk, approvals[1].pk]
    assert first.json()["next_before"] is not None

    second = superuser_client.get(
        reverse(JOURNAL), {"limit": 2, "before": first.json()["next_before"]}
    )

    assert second.status_code == 200
    assert [item["id"] for item in second.json()["items"]] == [approvals[0].pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_journal_returns_400_for_a_limit_over_100(superuser_client):
    response = superuser_client.get(reverse(JOURNAL), {"limit": 101})

    assert response.status_code == 400
    assert "limit" in response.json()["fields"]


@pytest.mark.django_db
@pytest.mark.integration
def test_a_post_without_the_csrf_token_is_refused(user_factory, catalog_run):
    user = user_factory(is_superuser=True)
    client = APIClient(enforce_csrf_checks=True)
    assert client.login(username=user.username, password="test-password")

    response = client.post(
        reverse(PREVIEW), {"run": catalog_run.pk, "group": "change"}, format="json"
    )

    assert response.status_code == 403
    assert response.json()["detail"].startswith("CSRF Failed")
