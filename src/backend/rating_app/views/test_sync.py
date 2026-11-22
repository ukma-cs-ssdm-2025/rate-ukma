from django.urls import reverse
from django.utils import timezone

import pytest
from freezegun import freeze_time
from structlog.testing import capture_logs

from rating_app.models.sync import (
    SyncChangeGroup,
    SyncChangeState,
    SyncPolicy,
    SyncPolicyChange,
    SyncPolicyMode,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync.kinds import KINDS, NEVER_AUTO_KINDS

ENDPOINTS = [
    ("get", "ukma-data-sync-runs", {}),
    ("get", "ukma-data-sync-run-changes", {"run_id": 1}),
    ("get", "ukma-data-sync-pending", {}),
    ("get", "ukma-data-sync-policies", {}),
    ("get", "ukma-data-sync-policy-changes", {}),
    ("put", "ukma-data-sync-policy", {"kind": "new_offering"}),
    ("post", "ukma-data-sync-approve", {}),
    ("post", "ukma-data-sync-reject", {}),
    ("post", "ukma-data-sync-change-answer", {"change_id": 1}),
    ("post", "ukma-data-sync-keep-apart-unrated", {}),
]


@pytest.fixture
def superuser_client(token_client):
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


@pytest.fixture
def make_succeeded_run(sync_run_factory):
    def build(source=SyncSource.CATALOG):
        return sync_run_factory(
            source=source,
            status=SyncRunStatus.SUCCEEDED,
            finished_at=timezone.now(),
        )

    return build


def _run_changes_url(run):
    return reverse("ukma-data-sync-run-changes", kwargs={"run_id": run.pk})


def _policy_url(kind):
    return reverse("ukma-data-sync-policy", kwargs={"kind": kind})


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(("method", "route", "kwargs"), ENDPOINTS)
def test_sync_endpoints_return_403_when_not_superuser(token_client, method, route, kwargs):
    response = getattr(token_client, method)(
        reverse(route, kwargs=kwargs), {"mode": "auto"}, format="json"
    )

    assert response.status_code == 403


@pytest.mark.parametrize(("method", "route", "kwargs"), ENDPOINTS)
def test_sync_endpoints_return_403_when_anonymous(api_client, method, route, kwargs):
    response = getattr(api_client, method)(
        reverse(route, kwargs=kwargs), {"mode": "auto"}, format="json"
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_runs_returns_newest_first_with_status_and_counts(superuser_client, sync_run_factory):
    with freeze_time("2026-11-20T10:00:00Z"):
        older = sync_run_factory(
            source=SyncSource.CATALOG,
            status=SyncRunStatus.SUCCEEDED,
            counts={"new": {"proposed": 2}},
        )
    with freeze_time("2026-11-21T10:00:00Z"):
        newer = sync_run_factory(
            source=SyncSource.TEACHERS,
            status=SyncRunStatus.FAILED,
            error="short_read",
        )

    response = superuser_client.get(reverse("ukma-data-sync-runs"))

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == [newer.pk, older.pk]
    assert body["items"][0]["status"] == "failed"
    assert body["items"][0]["source"] == "teachers"
    assert body["items"][0]["error"] == "short_read"
    assert body["items"][1]["counts"] == {"new": {"proposed": 2}}
    assert body["total"] == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_runs_filters_by_source(superuser_client, sync_run_factory):
    sync_run_factory(source=SyncSource.CATALOG)
    teachers = sync_run_factory(source=SyncSource.TEACHERS)

    body = superuser_client.get(reverse("ukma-data-sync-runs"), {"source": "teachers"}).json()

    assert [item["id"] for item in body["items"]] == [teachers.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_runs_returns_400_for_an_unknown_source(superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-runs"), {"source": "enrollments"})

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["source"]


@pytest.mark.django_db
@pytest.mark.integration
def test_runs_paginate(superuser_client, sync_run_factory):
    sync_run_factory.create_batch(3, source=SyncSource.CATALOG)

    first = superuser_client.get(reverse("ukma-data-sync-runs"), {"page": 1, "page_size": 2}).json()
    second = superuser_client.get(
        reverse("ukma-data-sync-runs"), {"page": 2, "page_size": 2}
    ).json()

    assert first["total"] == 3
    assert first["total_pages"] == 2
    assert first["next_page"] == 2
    assert first["previous_page"] is None
    assert len(first["items"]) == 2
    assert second["previous_page"] == 1
    assert len(second["items"]) == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_run_changes_returns_its_changes_rated_first_with_payloads(
    superuser_client, make_succeeded_run, sync_change_factory
):
    run = make_succeeded_run()
    quiet = sync_change_factory(run=run, kind="link_course", ratings=0)
    rated = sync_change_factory(
        run=run,
        group=SyncChangeGroup.MAPPING,
        kind="merge_courses",
        ratings=4,
        before={"display": {"name": "Стара назва"}},
        after={"merge_source": "decision", "courses": [], "display": {"name": "Об'єднання"}},
    )
    sync_change_factory(run=make_succeeded_run(), kind="link_course")

    response = superuser_client.get(_run_changes_url(run))

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == [rated.pk, quiet.pk]
    assert body["items"][0]["never_auto"] is True
    assert body["items"][0]["after"]["display"]["name"] == "Об'єднання"
    assert body["items"][0]["ratings"] == 4
    assert body["items"][1]["never_auto"] is False
    assert body["total"] == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_run_changes_filters_by_group_kind_and_state(
    superuser_client, make_succeeded_run, sync_change_factory
):
    run = make_succeeded_run()
    link = sync_change_factory(run=run, kind="link_course")
    merge = sync_change_factory(
        run=run,
        group=SyncChangeGroup.MAPPING,
        kind="merge_courses",
        state=SyncChangeState.APPLIED,
    )

    def ids(query):
        body = superuser_client.get(_run_changes_url(run), query).json()
        return [item["id"] for item in body["items"]]

    assert ids({"group": "mapping"}) == [merge.pk]
    assert ids({"kind": "link_course"}) == [link.pk]
    assert ids({"state": "applied"}) == [merge.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_run_changes_paginate(superuser_client, make_succeeded_run, sync_change_factory):
    run = make_succeeded_run()
    sync_change_factory.create_batch(2, run=run, kind="link_course")

    body = superuser_client.get(_run_changes_url(run), {"page_size": 1}).json()

    assert body["total"] == 2
    assert body["next_page"] == 2
    assert len(body["items"]) == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_run_changes_returns_400_for_an_unknown_kind(superuser_client, make_succeeded_run):
    run = make_succeeded_run()

    response = superuser_client.get(_run_changes_url(run), {"kind": "catalog_refactored"})

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["kind"]


@pytest.mark.django_db
@pytest.mark.integration
def test_run_changes_returns_404_when_run_missing(superuser_client):
    response = superuser_client.get(
        reverse("ukma-data-sync-run-changes", kwargs={"run_id": 999_999})
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.integration
def test_run_changes_returns_400_when_run_id_is_not_a_number(superuser_client):
    response = superuser_client.get(
        reverse("ukma-data-sync-run-changes", kwargs={"run_id": "latest"})
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_returns_proposed_changes_of_each_source_current_run(
    superuser_client, make_succeeded_run, sync_run_factory, sync_change_factory
):
    with freeze_time("2026-11-19T10:00:00Z"):
        old_run = make_succeeded_run(source=SyncSource.CATALOG)
    sync_change_factory(run=old_run, kind="link_course")
    with freeze_time("2026-11-20T10:00:00Z"):
        catalog_run = make_succeeded_run(source=SyncSource.CATALOG)
    current = sync_change_factory(run=catalog_run, kind="link_course")
    teachers_run = make_succeeded_run(source=SyncSource.TEACHERS)
    teacher = sync_change_factory(
        run=teachers_run,
        source=SyncSource.TEACHERS,
        group=SyncChangeGroup.CHANGE,
        kind="teacher_link_added",
    )
    failed_run = sync_run_factory(source=SyncSource.CATALOG, status=SyncRunStatus.FAILED)
    sync_change_factory(run=failed_run, kind="link_course")

    response = superuser_client.get(reverse("ukma-data-sync-pending"))

    assert response.status_code == 200
    body = response.json()
    assert {item["id"] for item in body["items"]} == {current.pk, teacher.pk}
    assert body["total"] == 2
    assert {run["id"] for run in body["runs"]} == {catalog_run.pk, teachers_run.pk}
    assert body["groups"] == {"link": 1, "change": 1}
    assert body["kinds"] == {"link_course": 1, "teacher_link_added": 1}


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_filters_by_source_group_and_kind_but_counts_everything(
    superuser_client, make_succeeded_run, sync_change_factory
):
    catalog_run = make_succeeded_run(source=SyncSource.CATALOG)
    link = sync_change_factory(run=catalog_run, kind="link_course")
    mapped = sync_change_factory(
        run=catalog_run, group=SyncChangeGroup.MAPPING, kind="merge_courses"
    )
    teachers_run = make_succeeded_run(source=SyncSource.TEACHERS)
    teacher = sync_change_factory(
        run=teachers_run,
        source=SyncSource.TEACHERS,
        group=SyncChangeGroup.CHANGE,
        kind="teacher_link_added",
    )

    def ids(query):
        body = superuser_client.get(reverse("ukma-data-sync-pending"), query).json()
        return [item["id"] for item in body["items"]]

    assert ids({"source": "teachers"}) == [teacher.pk]
    assert ids({"group": "mapping"}) == [mapped.pk]
    assert ids({"kind": "link_course"}) == [link.pk]

    body = superuser_client.get(reverse("ukma-data-sync-pending"), {"group": "mapping"}).json()
    assert body["groups"] == {"link": 1, "mapping": 1, "change": 1}


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_returns_nothing_when_no_source_succeeded(superuser_client, sync_run_factory):
    sync_run_factory(source=SyncSource.CATALOG, status=SyncRunStatus.RUNNING)

    body = superuser_client.get(reverse("ukma-data-sync-pending")).json()

    assert body["items"] == []
    assert body["runs"] == []
    assert body["total"] == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_policies_lists_every_kind_at_needs_approval_by_default(superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-policies"))

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["kind"] for item in items] == [kind.name for kind in KINDS]
    assert {item["mode"] for item in items} == {"needs_approval"}
    assert {item["kind"] for item in items if item["never_auto"]} == set(NEVER_AUTO_KINDS)
    assert all(item["updated_by"] is None for item in items)
    assert all(item["updated_at"] is None for item in items)

    merge = next(item for item in items if item["kind"] == "merge_courses")
    assert merge["source"] == "catalog"
    assert merge["group"] == "mapping"


@pytest.mark.django_db
@pytest.mark.integration
def test_policies_shows_a_stored_mode_and_its_editor(superuser_client, sync_policy_factory, user):
    sync_policy_factory(kind="new_offering", mode=SyncPolicyMode.AUTO, updated_by=user)

    items = superuser_client.get(reverse("ukma-data-sync-policies")).json()["items"]

    item = next(entry for entry in items if entry["kind"] == "new_offering")
    assert item["mode"] == "auto"
    assert item["never_auto"] is False
    assert item["updated_by"] == user.pk
    assert item["updated_at"] is not None


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_update_writes_the_policy_and_an_audit_row(superuser_client):
    response = superuser_client.put(_policy_url("new_offering"), {"mode": "auto"}, format="json")

    assert response.status_code == 200
    assert response.json()["mode"] == "auto"
    assert response.json()["never_auto"] is False

    policy = SyncPolicy.objects.get(kind="new_offering")
    assert policy.mode == SyncPolicyMode.AUTO
    assert policy.updated_by == superuser_client.user
    audit = SyncPolicyChange.objects.get(kind="new_offering")
    assert audit.old_mode == SyncPolicyMode.NEEDS_APPROVAL
    assert audit.new_mode == SyncPolicyMode.AUTO
    assert audit.user == superuser_client.user


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("kind", NEVER_AUTO_KINDS)
def test_policy_update_refuses_auto_for_every_never_auto_kind(superuser_client, kind):
    response = superuser_client.put(_policy_url(kind), {"mode": "auto"}, format="json")

    assert response.status_code == 400
    assert "завжди потребує підтвердження" in response.json()["fields"]["mode"][0]
    assert not SyncPolicy.objects.filter(kind=kind).exists()
    assert not SyncPolicyChange.objects.filter(kind=kind).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_update_returns_404_for_an_unknown_kind(superuser_client):
    response = superuser_client.put(
        _policy_url("catalog_refactored"), {"mode": "auto"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_update_returns_400_for_an_invalid_mode(superuser_client):
    response = superuser_client.put(
        _policy_url("new_offering"), {"mode": "sometimes"}, format="json"
    )

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["mode"]


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_update_writes_no_audit_row_when_mode_is_unchanged(superuser_client):
    response = superuser_client.put(
        _policy_url("new_offering"), {"mode": "needs_approval"}, format="json"
    )

    assert response.status_code == 200
    assert not SyncPolicy.objects.exists()
    assert not SyncPolicyChange.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_update_logs_the_kind_and_mode_but_no_payload(superuser_client):
    with capture_logs() as logs:
        superuser_client.put(_policy_url("new_offering"), {"mode": "auto"}, format="json")

    events = [log for log in logs if log["event"] == "sync_policy_updated"]
    assert len(events) == 1
    assert events[0]["kind"] == "new_offering"
    assert events[0]["mode"] == "auto"
    assert events[0]["user_id"] == superuser_client.user.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_changes_returns_the_audit_newest_first(
    superuser_client, sync_policy_change_factory, user
):
    with freeze_time("2026-11-20T10:00:00Z"):
        older = sync_policy_change_factory(kind="new_offering", user=user)
    with freeze_time("2026-11-21T10:00:00Z"):
        newer = sync_policy_change_factory(
            kind="change_offering",
            old_mode=SyncPolicyMode.AUTO,
            new_mode=SyncPolicyMode.NEEDS_APPROVAL,
            user=user,
        )

    response = superuser_client.get(reverse("ukma-data-sync-policy-changes"))

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == [newer.pk, older.pk]
    assert body["items"][0]["kind"] == "change_offering"
    assert body["items"][0]["old_mode"] == "auto"
    assert body["items"][0]["new_mode"] == "needs_approval"
    assert body["items"][0]["user"] == user.pk
    assert body["items"][0]["user_email"] == user.email
    assert body["total"] == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_changes_paginate(superuser_client, sync_policy_change_factory, user):
    sync_policy_change_factory.create_batch(2, user=user)

    body = superuser_client.get(reverse("ukma-data-sync-policy-changes"), {"page_size": 1}).json()

    assert body["total"] == 2
    assert body["next_page"] == 2
    assert len(body["items"]) == 1
