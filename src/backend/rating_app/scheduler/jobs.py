"""Periodic jobs run by ``manage.py run_scheduler`` (ADR 0020).

Each job is a management command run once a day at a UTC wall-clock time,
the time zone Django, the logs and Grafana use. ``lock_key`` is the job's
Postgres advisory lock, fixed for good: two schedulers, or a scheduler and a
manual run, never run one job at once. Adding a job is one line here.
"""

import datetime
from dataclasses import dataclass


@dataclass(frozen=True)
class Job:
    command: str
    at: datetime.time
    lock_key: int


JOBS: tuple[Job, ...] = (Job("sync_offering_instructors", datetime.time(2, 0), lock_key=864_001),)


def job_named(command: str) -> Job:
    return next(job for job in JOBS if job.command == command)


def next_run(job: Job, now: datetime.datetime) -> datetime.datetime:
    """The first time after ``now`` that the UTC clock reads ``job.at``."""
    utc_now = now.astimezone(datetime.UTC)
    candidate = datetime.datetime.combine(utc_now.date(), job.at, tzinfo=datetime.UTC)
    if candidate <= utc_now:
        candidate += datetime.timedelta(days=1)
    return candidate
