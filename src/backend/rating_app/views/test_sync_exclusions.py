from __future__ import annotations

from contextlib import contextmanager

from django.urls import reverse
from django.utils import timezone

import pytest

from rating_app.models import SyncChangeState, SyncRunStatus, SyncSource
from rating_app.sync import apply, handlers
from rating_app.sync.handlers import Handler
from rating_app.sync.kinds import KIND_BY_NAME


@contextmanager
def _lock_free(_key: int):
    yield True


@pytest.fixture
def superuser_client(token_client, monkeypatch):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


@pytest.fixture
def quiet_catalog(monkeypatch):
    for kind in ("change_offering", "new_offering", "relink_course"):
        monkeypatch.setitem(handlers.HANDLERS, kind, Handler(apply=lambda change: None))


@pytest.fixture
def teacher_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def make_teacher(sync_change_factory, teacher_run):
    def build(email):
        return sync_change_factory(
            run=teacher_run,
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

    return build


@pytest.fixture
def make_link(sync_change_factory, teacher_run):
    def build(offering, email):
        return sync_change_factory(
            run=teacher_run,
            source=SyncSource.TEACHERS,
            group="change",
            kind="teacher_link_added",
            key=f"offering:{offering.pk}|teacher:{email}",
            target_id=str(offering.pk),
            before={"links": []},
            after={"teacher_email": email, "role": "LECTURE_INSTRUCTOR"},
            requires=[{"kind": "teacher_created", "key": email}],
        )

    return build


@pytest.fixture
def make_catalog_change(sync_change_factory, catalog_run):
    def build(kind, key, *, after=None, before=None):
        registry = KIND_BY_NAME[kind]
        return sync_change_factory(
            run=catalog_run,
            source=registry.source,
            group=registry.group,
            kind=kind,
            key=key,
            ukma_data_id=key,
            after=after or {},
            before=before or {},
            waiting_on=[],
        )

    return build


def _preview(client, source, selection):
    response = client.post(
        reverse("ukma-data-sync-preview"),
        {"source": source, "selection": selection},
        format="json",
    )
    assert response.status_code == 200, response.json()
    return response.json()


def _approve(client, source, selection, token):
    return client.post(
        reverse("ukma-data-sync-approve"),
        {"source": source, "selection": selection, "token": token},
        format="json",
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_holds_an_offering_unit_when_a_sibling_link_is_excluded(
    superuser_client, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    first_teacher = make_teacher("first@example.com")
    second_teacher = make_teacher("second@example.com")
    first = make_link(offering, "first@example.com")
    second = make_link(offering, "second@example.com")
    selection = {"filter": {"group": "change", "exclude_ids": [second.pk]}}
    preview = _preview(superuser_client, "teachers", selection)

    response = _approve(superuser_client, "teachers", selection, preview["token"])

    assert preview["counts"]["teacher_link_added"] == {"apply": 0, "wait": 1, "superseded": 0}
    assert response.status_code == 200
    assert response.json()["counts"]["applied"] == 0
    assert (
        response.json()["counts"]["waiting"]
        == preview["counts"]["teacher_link_added"]["wait"]
        + preview["counts"]["teacher_created"]["wait"]
    )
    for change in (first, second, first_teacher, second_teacher):
        change.refresh_from_db()
        assert change.state == SyncChangeState.PROPOSED
    assert first.waiting_on == [second.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_holds_a_link_whose_required_teacher_is_excluded(
    superuser_client, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    teacher = make_teacher("only@example.com")
    link = make_link(offering, "only@example.com")
    selection = {"filter": {"group": "change", "exclude_ids": [teacher.pk]}}
    preview = _preview(superuser_client, "teachers", selection)

    response = _approve(superuser_client, "teachers", selection, preview["token"])

    assert preview["counts"] == {"teacher_link_added": {"apply": 0, "wait": 1, "superseded": 0}}
    assert response.status_code == 200
    assert response.json()["counts"]["applied"] == 0
    assert response.json()["counts"]["waiting"] == 1
    teacher.refresh_from_db()
    link.refresh_from_db()
    assert teacher.state == SyncChangeState.PROPOSED
    assert link.state == SyncChangeState.PROPOSED
    assert link.waiting_on == [teacher.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_applies_the_whole_unit_when_nothing_in_it_is_excluded(
    superuser_client, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    make_teacher("kept@example.com")
    unrelated = make_teacher("unrelated@example.com")
    link = make_link(offering, "kept@example.com")
    selection = {"filter": {"group": "change", "exclude_ids": [unrelated.pk]}}
    preview = _preview(superuser_client, "teachers", selection)

    response = _approve(superuser_client, "teachers", selection, preview["token"])

    assert response.status_code == 200
    assert response.json()["counts"]["applied"] == 2
    link.refresh_from_db()
    unrelated.refresh_from_db()
    assert link.state == SyncChangeState.APPLIED
    assert unrelated.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_approve_with_other_exclusions_than_previewed_returns_409(
    superuser_client, course_offering_factory, make_teacher, make_link
):
    offering = course_offering_factory()
    teacher = make_teacher("only@example.com")
    make_link(offering, "only@example.com")
    preview = _preview(superuser_client, "teachers", {"filter": {"group": "change"}})

    response = _approve(
        superuser_client,
        "teachers",
        {"filter": {"group": "change", "exclude_ids": [teacher.pk]}},
        preview["token"],
    )

    assert response.status_code == 409
    assert response.json()["code"] == "selection_changed"


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_counts_every_field_the_selected_changes_set(
    superuser_client, quiet_catalog, make_catalog_change
):
    before = {"terms": [_term("PRACTICE", 14)]}
    make_catalog_change(
        "change_offering",
        "off-two-fields",
        before=before,
        after={"terms": [_term("SEMINAR", 12)]},
    )
    make_catalog_change(
        "change_offering",
        "off-one-field",
        before=before,
        after={"terms": [_term("SEMINAR", 14)]},
    )

    body = _preview(
        superuser_client,
        "catalog",
        {"filter": {"group": "change", "changed_field": "practice_type", "blanks": False}},
    )

    assert body["count"] == 2
    assert body["field_counts"] == {"practice_type": 2, "practice_count": 1}


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_and_preview_take_the_other_group(
    superuser_client, quiet_catalog, make_catalog_change
):
    relink = make_catalog_change("relink_course", "course-relink")
    make_catalog_change("place_offering", "off-place")

    listed = superuser_client.get(
        reverse("ukma-data-sync-pending"), {"source": "catalog", "group": "other"}
    )
    preview = _preview(superuser_client, "catalog", {"filter": {"group": "other"}})

    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["items"]] == [relink.pk]
    assert preview["count"] == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_preview_takes_more_than_200_change_ids(
    superuser_client, quiet_catalog, make_catalog_change
):
    changes = [make_catalog_change("new_offering", f"off-{index}") for index in range(201)]

    response = superuser_client.post(
        reverse("ukma-data-sync-preview"),
        {"source": "catalog", "selection": {"change_ids": [change.pk for change in changes]}},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["count"] == 201


def _term(practice_type, practice_count):
    return {
        "year": 2025,
        "term": "FALL",
        "credits": "3.0",
        "weekly_hours": 2,
        "lecture_count": 14,
        "practice_count": practice_count,
        "practice_type": practice_type,
        "exam_type": "EXAM",
    }
