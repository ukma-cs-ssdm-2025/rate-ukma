from datetime import timedelta

from django.utils import timezone

import pytest

from rating_app.models import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncChangeStateReason,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync.runs import fail_run, finish_run, start_run, sweep_interrupted_approvals


@pytest.mark.django_db
@pytest.mark.integration
def test_start_run_fails_stale_running_runs_of_the_same_source(sync_run_factory):
    stale = sync_run_factory(source=SyncSource.CATALOG, status=SyncRunStatus.RUNNING)
    other_source = sync_run_factory(source=SyncSource.TEACHERS, status=SyncRunStatus.RUNNING)

    run = start_run(SyncSource.CATALOG)

    stale.refresh_from_db()
    other_source.refresh_from_db()
    assert stale.status == SyncRunStatus.FAILED
    assert stale.finished_at is not None
    assert stale.error
    assert other_source.status == SyncRunStatus.RUNNING
    assert run.status == SyncRunStatus.RUNNING
    assert run.pk != stale.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_finish_run_supersedes_only_earlier_proposed_changes_of_the_same_source(
    sync_run_factory, sync_change_factory
):
    earlier = sync_run_factory(source=SyncSource.CATALOG)
    proposed = sync_change_factory(run=earlier, source=SyncSource.CATALOG)
    applied = sync_change_factory(
        run=earlier, source=SyncSource.CATALOG, state=SyncChangeState.APPLIED
    )
    rejected = sync_change_factory(
        run=earlier, source=SyncSource.CATALOG, state=SyncChangeState.REJECTED
    )
    other_source = sync_run_factory(source=SyncSource.TEACHERS)
    foreign = sync_change_factory(run=other_source, source=SyncSource.TEACHERS)

    run = start_run(SyncSource.CATALOG)
    change = SyncChange(
        group=SyncChangeGroup.NEW,
        kind="new_offering",
        key="offering:1",
    )
    finish_run(run, [change], {"proposed": 1})

    proposed.refresh_from_db()
    applied.refresh_from_db()
    rejected.refresh_from_db()
    foreign.refresh_from_db()
    run.refresh_from_db()
    assert run.status == SyncRunStatus.SUCCEEDED
    assert run.finished_at is not None
    assert run.counts == {"proposed": 1}
    assert change.pk is not None
    assert change.run_id == run.pk
    assert change.source == SyncSource.CATALOG
    assert proposed.state == SyncChangeState.SUPERSEDED
    assert proposed.state_reason == SyncChangeStateReason.REPLACED
    assert proposed.decided_at is not None
    assert applied.state == SyncChangeState.APPLIED
    assert rejected.state == SyncChangeState.REJECTED
    assert foreign.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_fail_run_keeps_the_previous_runs_proposals(sync_run_factory, sync_change_factory):
    previous = sync_run_factory(source=SyncSource.CATALOG, status=SyncRunStatus.SUCCEEDED)
    proposed = sync_change_factory(run=previous, source=SyncSource.CATALOG)
    run = start_run(SyncSource.CATALOG)

    fail_run(run, "ukma_data_unavailable")

    run.refresh_from_db()
    proposed.refresh_from_db()
    assert run.status == SyncRunStatus.FAILED
    assert run.finished_at is not None
    assert run.error == "ukma_data_unavailable"
    assert proposed.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_sweep_interrupted_approvals_fails_only_started_approvals_over_an_hour(
    sync_approval_factory,
):
    old_started = sync_approval_factory(outcome=SyncApprovalOutcome.STARTED)
    fresh_started = sync_approval_factory(outcome=SyncApprovalOutcome.STARTED)
    applied = sync_approval_factory(outcome=SyncApprovalOutcome.APPLIED)
    SyncApproval.objects.filter(pk=old_started.pk).update(
        created_at=timezone.now() - timedelta(hours=2)
    )

    swept = sweep_interrupted_approvals()

    old_started.refresh_from_db()
    fresh_started.refresh_from_db()
    applied.refresh_from_db()
    assert swept == 1
    assert old_started.outcome == SyncApprovalOutcome.FAILED
    assert old_started.error == "interrupted"
    assert fresh_started.outcome == SyncApprovalOutcome.STARTED
    assert applied.outcome == SyncApprovalOutcome.APPLIED
