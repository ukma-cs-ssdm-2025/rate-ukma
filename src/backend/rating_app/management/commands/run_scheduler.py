import datetime
import signal
import threading

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import close_old_connections

import structlog

from rating_app.scheduler.jobs import JOBS, Job, next_run

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Run the periodic jobs in rating_app/scheduler/jobs.py until SIGTERM (ADR 0020)."

    def handle(self, *args, **options) -> None:
        stop = threading.Event()
        for signum in (signal.SIGTERM, signal.SIGINT):
            signal.signal(signum, lambda *_: stop.set())

        now = datetime.datetime.now(datetime.UTC)
        due = {job: next_run(job, now) for job in JOBS}
        logger.info(
            "scheduler_started",
            jobs={job.command: at.isoformat() for job, at in due.items()},
        )

        while not stop.is_set():
            job, at = min(due.items(), key=lambda item: item[1])
            wait = (at - datetime.datetime.now(datetime.UTC)).total_seconds()
            if wait > 0 and stop.wait(wait):
                break
            self._run(job)
            due[job] = next_run(job, datetime.datetime.now(datetime.UTC))
            logger.info("scheduler_next_run", job=job.command, at=due[job].isoformat())

        logger.info("scheduler_stopped")

    def _run(self, job: Job) -> None:
        # A failed job is logged and retried at its next time; the loop lives on.
        close_old_connections()
        try:
            call_command(job.command)
        except Exception:
            logger.exception("scheduler_job_failed", job=job.command)
        finally:
            close_old_connections()
