from __future__ import annotations

import json

from django.core.management.base import CommandError

import pytest
from structlog.testing import capture_logs

from rating_app.models import SyncPolicy, SyncPolicyChange, SyncPolicyMode


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_lists_every_kind_with_its_mode(run_catalog_sync):
    out = run_catalog_sync("policy")

    assert "Зміни дисциплін" in out
    assert "change_course" in out
    merge = next(line for line in out.splitlines() if "merge_courses" in line)
    assert "лише вручну" in merge
    assert all(len(line) <= 100 for line in out.splitlines())


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_json_marks_never_auto_kinds(run_catalog_sync):
    items = {item["kind"]: item for item in json.loads(run_catalog_sync("policy", "--json"))}

    assert items["merge_courses"]["never_auto"] is True
    assert items["change_course"] == {
        "kind": "change_course",
        "group": "change",
        "mode": "needs_approval",
        "never_auto": False,
        "updated_by": None,
        "updated_at": None,
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_dry_run_writes_nothing(run_catalog_sync, admin):
    out = run_catalog_sync("policy", "change_course", "auto", "--by", admin.username)

    assert "Змінило б: «Зміни дисциплін» потребує рішення → авто." in out
    assert not SyncPolicy.objects.exists()
    assert not SyncPolicyChange.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_yes_writes_the_policy_and_its_audit(run_catalog_sync, admin):
    run_catalog_sync("policy", "change_course", "auto", "--by", admin.username, "--yes")

    assert SyncPolicy.objects.get(kind="change_course").mode == SyncPolicyMode.AUTO
    audit = SyncPolicyChange.objects.get()
    assert audit.user == admin
    assert audit.new_mode == SyncPolicyMode.AUTO


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_refuses_auto_for_a_never_auto_kind(run_catalog_sync, admin):
    with pytest.raises(CommandError, match="«Об'єднання дисциплін» не може бути авто"):
        run_catalog_sync("policy", "merge_courses", "auto", "--by", admin.username, "--yes")

    assert not SyncPolicy.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_yes_requires_by(run_catalog_sync):
    with pytest.raises(CommandError, match="Вкажіть --by"):
        run_catalog_sync("policy", "change_course", "auto", "--yes")


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_rejects_an_unknown_kind(run_catalog_sync, admin):
    with pytest.raises(CommandError, match="Невідомий тип змін: nope"):
        run_catalog_sync("policy", "nope", "auto", "--by", admin.username)


@pytest.mark.django_db
@pytest.mark.integration
def test_policy_yes_logs_the_update(run_catalog_sync, admin):
    with capture_logs() as logs:
        run_catalog_sync("policy", "change_course", "auto", "--by", admin.username, "--yes")

    [entry] = [entry for entry in logs if entry["event"] == "sync_policy_updated"]
    assert entry == {
        "event": "sync_policy_updated",
        "kind": "change_course",
        "mode": "auto",
        "user_id": admin.pk,
        "log_level": "info",
    }
