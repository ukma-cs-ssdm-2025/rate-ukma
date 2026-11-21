import datetime
import os
import signal
from unittest.mock import patch

from django.core.management import call_command

from structlog.testing import capture_logs

from rating_app.scheduler.jobs import Job

COMMAND = "rating_app.management.commands.run_scheduler"
JOBS = (Job("first", datetime.time(2, 0), 1), Job("second", datetime.time(3, 0), 2))


def test_runs_due_jobs_survives_a_failure_and_stops_on_sigterm():
    ran: list[str] = []

    def run(command: str) -> None:
        ran.append(command)
        if command == "first":
            raise RuntimeError("boom")
        os.kill(os.getpid(), signal.SIGTERM)

    due_now = datetime.datetime(2000, 1, 1, tzinfo=datetime.UTC)
    later = datetime.datetime(2999, 1, 1, tzinfo=datetime.UTC)
    with (
        patch(f"{COMMAND}.JOBS", JOBS),
        patch(f"{COMMAND}.next_run", side_effect=[due_now, due_now, later, later]),
        patch(f"{COMMAND}.call_command", side_effect=run),
        patch(f"{COMMAND}.close_old_connections"),
        capture_logs() as logs,
    ):
        call_command("run_scheduler")

    assert ran == ["first", "second"]
    events = [log["event"] for log in logs]
    assert events[0] == "scheduler_started"
    assert "scheduler_job_failed" in events
    assert events[-1] == "scheduler_stopped"
