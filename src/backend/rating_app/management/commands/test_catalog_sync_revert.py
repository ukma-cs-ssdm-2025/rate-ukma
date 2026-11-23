from __future__ import annotations

import json

from django.core.management.base import CommandError
from django.utils import timezone

import pytest

from rating_app.models import (
    Course,
    SyncApproval,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncChangeState,
)

OLD_TITLE = "Тестова дисципліна А"
NEW_TITLE = "Тестова дисципліна Б"


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_revert_dry_run_lists_the_change_and_writes_nothing(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    course, change = make_title_change(run)
    run_catalog_sync("apply", "--ids", str(change.pk), "--by", admin.username, "--yes")
    approval = SyncApproval.objects.get(action=SyncApprovalAction.APPLY)

    out = run_catalog_sync("revert", str(approval.pk), "--by", admin.username)

    assert "Пробний запуск, нічого не записано." in out
    assert "Відкотило б 1 зміну" in out
    assert "Щоб записати: додайте --yes." in out
    course.refresh_from_db()
    assert course.title == NEW_TITLE
    change.refresh_from_db()
    assert change.state == SyncChangeState.APPLIED
    assert not SyncApproval.objects.filter(action=SyncApprovalAction.REVERT).exists()


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_revert_yes_writes_the_previous_values_back(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    course, change = make_title_change(run)
    run_catalog_sync("apply", "--ids", str(change.pk), "--by", admin.username, "--yes")
    approval = SyncApproval.objects.get(action=SyncApprovalAction.APPLY)

    out = run_catalog_sync("revert", str(approval.pk), "--by", admin.username, "--yes")

    revert = SyncApproval.objects.get(action=SyncApprovalAction.REVERT)
    assert f"Відкочено. Рішення #{revert.pk}." in out
    assert "повернуться в «Чекають рішення»" in out
    assert revert.reverts_id == approval.pk
    course.refresh_from_db()
    assert course.title == OLD_TITLE
    change.refresh_from_db()
    assert change.state == SyncChangeState.REVERTED
    assert change.approval_id == approval.pk


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_revert_lists_every_blocker(
    run_catalog_sync, admin, make_catalog_run, sync_approval_factory, sync_change_factory
):
    run = make_catalog_run()
    approval = sync_approval_factory(
        run=run,
        user=admin,
        action=SyncApprovalAction.APPLY,
        outcome=SyncApprovalOutcome.APPLIED,
    )
    sync_change_factory(
        run=run,
        group="new",
        kind="new_course",
        key="ud-course",
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
    )

    out = run_catalog_sync("revert", str(approval.pk), "--by", admin.username)

    assert f"Не можна відкотити рішення #{approval.pk}" in out
    assert "1 зміна заважає" in out
    assert "Лише вручну: нові записи вже можуть мати оцінки." in out


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_revert_yes_with_a_blocker_writes_nothing(
    run_catalog_sync, admin, make_catalog_run, sync_approval_factory, sync_change_factory
):
    run = make_catalog_run()
    approval = sync_approval_factory(
        run=run,
        user=admin,
        action=SyncApprovalAction.APPLY,
        outcome=SyncApprovalOutcome.APPLIED,
    )
    sync_change_factory(
        run=run,
        group="new",
        kind="new_course",
        key="ud-course",
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
    )

    with pytest.raises(CommandError, match="спершу приберіть перешкоди"):
        run_catalog_sync("revert", str(approval.pk), "--by", admin.username, "--yes")

    assert not SyncApproval.objects.filter(
        action=SyncApprovalAction.REVERT, outcome=SyncApprovalOutcome.APPLIED
    ).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_revert_reports_an_unknown_decision(run_catalog_sync, admin):
    with pytest.raises(CommandError, match="Рішення не знайдено."):
        run_catalog_sync("revert", "999999", "--by", admin.username)


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_log_prints_the_decisions_and_their_counts(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    _, change = make_title_change(run)
    run_catalog_sync("apply", "--ids", str(change.pk), "--by", admin.username, "--yes")

    out = run_catalog_sync("log")

    assert "Журнал" in out
    assert "Застосовано 1 (Зміни)" in out
    assert admin.username in out


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_log_json_is_machine_readable(run_catalog_sync, admin, make_catalog_run, make_title_change):
    run = make_catalog_run()
    _, change = make_title_change(run)
    run_catalog_sync("apply", "--ids", str(change.pk), "--by", admin.username, "--yes")

    payload = json.loads(run_catalog_sync("log", "--json"))

    assert payload[0]["entry"] == "apply"
    assert payload[0]["who"] == admin.username
    assert payload[0]["counts"]["applied"] == 1
    assert payload[0]["revertible"] is True


@pytest.mark.django_db
@pytest.mark.integration
def test_log_says_when_nothing_was_decided(run_catalog_sync):
    out = run_catalog_sync("log")

    assert "Ще не було жодного рішення." in out


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.usefixtures("free_sync_lock")
def test_log_marks_a_reverted_decision(
    run_catalog_sync, admin, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    course, change = make_title_change(run)
    run_catalog_sync("apply", "--ids", str(change.pk), "--by", admin.username, "--yes")
    approval = SyncApproval.objects.get(action=SyncApprovalAction.APPLY)
    run_catalog_sync("revert", str(approval.pk), "--by", admin.username, "--yes")

    out = run_catalog_sync("log")

    assert "Відкочено #" in out
    assert "відкочено" in out
    assert Course.objects.get(pk=course.pk).title == OLD_TITLE
