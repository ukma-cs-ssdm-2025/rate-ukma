from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

import pytest

from rating_app.models import (
    CatalogMappingDecision,
    SyncApproval,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncChangeState,
    SyncPolicyChange,
    UkmaDataDecision,
)
from rating_app.sync import journal


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_merge_every_source_newest_first(
    user,
    sync_run_factory,
    sync_approval_factory,
    sync_policy_change_factory,
    catalog_mapping_decision_factory,
):
    run = sync_run_factory(source="catalog", status="succeeded")
    now = timezone.now()
    approval = sync_approval_factory(
        run=run,
        user=user,
        action=SyncApprovalAction.APPLY,
        outcome=SyncApprovalOutcome.APPLIED,
        counts={"applied": 2},
    )
    policy = sync_policy_change_factory(kind="link_course", user=user)
    answer = catalog_mapping_decision_factory(answer="keep_apart", decided_by=user)
    SyncApproval.objects.filter(pk=approval.pk).update(created_at=now - timedelta(hours=3))
    SyncPolicyChange.objects.filter(pk=policy.pk).update(changed_at=now - timedelta(hours=2))
    CatalogMappingDecision.objects.filter(pk=answer.pk).update(decided_at=now - timedelta(hours=1))

    entries = journal.entries(limit=10)

    assert [entry.kind for entry in entries] == ["answer", "policy", "apply"]
    assert entries[0].who == user.username
    assert entries[1].counts == {
        "kind": "link_course",
        "old_mode": "needs_approval",
        "new_mode": "auto",
    }
    assert entries[2].counts == {"applied": 2}
    assert entries[2].outcome == SyncApprovalOutcome.APPLIED


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_page_with_before_and_limit(user, sync_run_factory, sync_approval_factory):
    run = sync_run_factory(source="catalog", status="succeeded")
    now = timezone.now()
    approvals = [
        sync_approval_factory(run=run, user=user, action=SyncApprovalAction.REJECT)
        for _ in range(3)
    ]
    for index, approval in enumerate(approvals):
        SyncApproval.objects.filter(pk=approval.pk).update(
            created_at=now - timedelta(hours=3 - index)
        )

    first = journal.entries(limit=2)
    before = journal.parse_cursor(journal.cursor_of(first[-1]))
    assert before is not None
    second = journal.entries(limit=2, before=before)

    assert [entry.id for entry in first] == [approvals[2].pk, approvals[1].pk]
    assert [entry.id for entry in second] == [approvals[0].pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_page_past_the_same_timestamp(user, sync_run_factory, sync_approval_factory):
    run = sync_run_factory(source="catalog", status="succeeded")
    now = timezone.now()
    approvals = [
        sync_approval_factory(run=run, user=user, action=SyncApprovalAction.REJECT)
        for _ in range(3)
    ]
    SyncApproval.objects.filter(pk__in=[item.pk for item in approvals]).update(created_at=now)

    first = journal.entries(limit=2)
    before = journal.parse_cursor(journal.cursor_of(first[-1]))
    assert before is not None
    second = journal.entries(limit=2, before=before)

    seen = [entry.id for entry in [*first, *second]]
    assert len(seen) == 3
    assert len(set(seen)) == 3


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_page_one_by_one_past_an_apply_and_a_revert_at_the_same_time(
    user, sync_run_factory, sync_approval_factory
):
    run = sync_run_factory(source="catalog", status="succeeded")
    now = timezone.now()
    revert = sync_approval_factory(run=run, user=user, action=SyncApprovalAction.REVERT)
    apply = sync_approval_factory(run=run, user=user, action=SyncApprovalAction.APPLY)
    SyncApproval.objects.filter(pk__in=[apply.pk, revert.pk]).update(created_at=now)

    first = journal.entries(limit=1)
    before = journal.parse_cursor(journal.cursor_of(first[-1]))
    assert before is not None
    second = journal.entries(limit=1, before=before)

    assert {entry.id for entry in [*first, *second]} == {apply.pk, revert.pk}


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_page_past_a_shared_timestamp_across_kinds(
    user,
    sync_run_factory,
    sync_approval_factory,
    sync_policy_change_factory,
    catalog_mapping_decision_factory,
):
    run = sync_run_factory(source="catalog", status="succeeded")
    now = timezone.now()
    approval = sync_approval_factory(run=run, user=user, action=SyncApprovalAction.APPLY)
    policy = sync_policy_change_factory(kind="link_course", user=user)
    answer = catalog_mapping_decision_factory(answer="keep_apart", decided_by=user)
    SyncApproval.objects.filter(pk=approval.pk).update(created_at=now)
    SyncPolicyChange.objects.filter(pk=policy.pk).update(changed_at=now)
    CatalogMappingDecision.objects.filter(pk=answer.pk).update(decided_at=now)

    first = journal.entries(limit=2)
    before = journal.parse_cursor(journal.cursor_of(first[-1]))
    assert before is not None
    second = journal.entries(limit=2, before=before)

    seen = [entry.kind for entry in [*first, *second]]
    assert sorted(seen) == ["answer", "apply", "policy"]


@pytest.mark.django_db
@pytest.mark.integration
def test_a_revertible_apply_says_so_and_a_reverted_one_is_marked(
    user, sync_run_factory, sync_approval_factory, sync_change_factory, course_factory
):
    run = sync_run_factory(source="catalog", status="succeeded")
    course = course_factory(title="Тестова дисципліна А")
    approval = sync_approval_factory(
        run=run,
        user=user,
        action=SyncApprovalAction.APPLY,
        outcome=SyncApprovalOutcome.APPLIED,
    )
    sync_change_factory(
        run=run,
        kind="link_course",
        key=str(course.pk),
        target_id=str(course.pk),
        before={"ukma_data_id": None},
        after={"ukma_data_id": "ud-course"},
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
    )

    entry = next(item for item in journal.entries() if item.approval_id == approval.pk)

    assert entry.revertible is True
    assert entry.revert_reason == ""

    sync_approval_factory(
        run=run,
        user=user,
        action=SyncApprovalAction.REVERT,
        outcome=SyncApprovalOutcome.APPLIED,
        reverts=approval,
    )
    entry = next(item for item in journal.entries() if item.approval_id == approval.pk)

    assert entry.revertible is False
    assert entry.reverted is True
    assert entry.revert_reason == "Це рішення вже відкочено."


@pytest.mark.django_db
@pytest.mark.integration
def test_an_apply_of_new_records_is_not_revertible(
    user, sync_run_factory, sync_approval_factory, sync_change_factory
):
    run = sync_run_factory(source="catalog", status="succeeded")
    approval = sync_approval_factory(
        run=run,
        user=user,
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

    entry = next(item for item in journal.entries() if item.approval_id == approval.pk)

    assert entry.revertible is False
    assert "нові записи" in entry.revert_reason


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_merge_a_ukma_data_decision_with_its_error(
    user, sync_approval_factory, ukma_data_decision_factory
):
    approval = sync_approval_factory(user=user, action=SyncApprovalAction.REJECT)
    refused = ukma_data_decision_factory(
        user=user,
        action="merge_course",
        target_id="c-101",
        related_id="c-102",
        outcome="refused",
        error="level_mismatch",
    )
    now = timezone.now()
    SyncApproval.objects.filter(pk=approval.pk).update(created_at=now - timedelta(hours=2))
    UkmaDataDecision.objects.filter(pk=refused.pk).update(created_at=now - timedelta(hours=1))

    entries = journal.entries(limit=10)

    assert [entry.kind for entry in entries] == ["decision", "reject"]
    decision = entries[0]
    assert decision.who == user.username
    assert decision.outcome == "refused"
    assert decision.error == "level_mismatch"
    assert decision.counts == {
        "action": "merge_course",
        "target_id": "c-101",
        "related_id": "c-102",
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_entries_page_past_a_ukma_data_decision(user, ukma_data_decision_factory):
    now = timezone.now()
    decisions = [ukma_data_decision_factory(user=user) for _ in range(2)]
    UkmaDataDecision.objects.filter(pk=decisions[0].pk).update(created_at=now - timedelta(hours=1))
    UkmaDataDecision.objects.filter(pk=decisions[1].pk).update(created_at=now)

    first = journal.entries(limit=1)
    before = journal.parse_cursor(journal.cursor_of(first[-1]))
    assert before is not None
    second = journal.entries(limit=1, before=before)

    assert [entry.id for entry in first] == [decisions[1].pk]
    assert [entry.id for entry in second] == [decisions[0].pk]
