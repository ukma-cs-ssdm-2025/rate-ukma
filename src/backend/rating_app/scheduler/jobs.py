"""Periodic jobs run by ``manage.py run_scheduler`` (ADR 0017).

Each job is a management command run once a day at a Kyiv wall-clock time.
``lock_key`` is the job's Postgres advisory lock, fixed for good: two
schedulers, or a scheduler and a manual run, never run one job at once.
Adding a job is one line here.
"""

import datetime
from dataclasses import dataclass
from zoneinfo import ZoneInfo

KYIV = ZoneInfo("Europe/Kyiv")


@dataclass(frozen=True)
class Job:
    command: str
    at: datetime.time
    lock_key: int


JOBS: tuple[Job, ...] = (Job("sync_offering_instructors", datetime.time(4, 30), lock_key=864_001),)


def job_named(command: str) -> Job:
    return next(job for job in JOBS if job.command == command)


def next_run(job: Job, now: datetime.datetime) -> datetime.datetime:
    """The first time after ``now`` that the Kyiv clock reads ``job.at``.

    On a day when the clock skips ``job.at`` (spring forward) the job runs
    at the same wall time shifted by the gap; zoneinfo resolves it.
    """
    local = now.astimezone(KYIV)
    candidate = datetime.datetime.combine(local.date(), job.at, tzinfo=KYIV)
    if candidate <= local:
        candidate = datetime.datetime.combine(
            local.date() + datetime.timedelta(days=1), job.at, tzinfo=KYIV
        )
    return candidate.astimezone(datetime.UTC)
