from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

import structlog

from rating_app.models.sync import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncChangeStateReason,
    SyncRun,
    SyncRunStatus,
)

logger = structlog.get_logger(__name__)

INTERRUPTED_AFTER = timedelta(hours=1)


def start_run(source: str) -> SyncRun:
    """Fail the source's stale running runs and open a new one."""
    sweep_interrupted_approvals()
    now = timezone.now()
    with transaction.atomic():
        SyncRun.objects.filter(source=source, status=SyncRunStatus.RUNNING).update(
            status=SyncRunStatus.FAILED,
            finished_at=now,
            error="interrupted",
        )
        return SyncRun.objects.create(source=source, status=SyncRunStatus.RUNNING)


def finish_run(
    run: SyncRun,
    changes: Iterable[SyncChange],
    counts: Mapping[str, Any],
) -> SyncRun:
    """Write the run's changes, succeed the run and replace the older proposals."""
    now = timezone.now()
    with transaction.atomic():
        rows = list(changes)
        for change in rows:
            change.run = run
            change.source = run.source
        SyncChange.objects.bulk_create(rows)

        SyncChange.objects.filter(source=run.source, state=SyncChangeState.PROPOSED).exclude(
            run=run
        ).update(
            state=SyncChangeState.SUPERSEDED,
            state_reason=SyncChangeStateReason.REPLACED,
            decided_at=now,
        )

        run.status = SyncRunStatus.SUCCEEDED
        run.finished_at = now
        run.counts = dict(counts)
        run.save(update_fields=["status", "finished_at", "counts"])
        return run


def fail_run(run: SyncRun, error: str) -> SyncRun:
    """Fail the run and report it; the previous run's proposals stay in place."""
    run.status = SyncRunStatus.FAILED
    run.finished_at = timezone.now()
    run.error = error
    run.save(update_fields=["status", "finished_at", "error"])
    logger.error("sync_run_failed", source=run.source, run_id=run.pk, err=error)
    return run


def sweep_interrupted_approvals() -> int:
    """Fail approvals left `started` for over an hour, e.g. by a deploy."""
    cutoff = timezone.now() - INTERRUPTED_AFTER
    return SyncApproval.objects.filter(
        outcome=SyncApprovalOutcome.STARTED,
        created_at__lt=cutoff,
    ).update(outcome=SyncApprovalOutcome.FAILED, error="interrupted")
