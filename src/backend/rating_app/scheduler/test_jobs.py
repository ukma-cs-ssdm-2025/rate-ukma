import datetime

from rating_app.scheduler.jobs import JOBS, Job, job_named, next_run

JOB = Job("example", datetime.time(4, 30), lock_key=1)
UTC = datetime.UTC


def test_runs_today_before_the_time_and_tomorrow_after_it():
    # Kyiv is UTC+2 in winter: 04:30 there is 02:30 UTC.
    assert next_run(JOB, datetime.datetime(2026, 11, 21, 1, 0, tzinfo=UTC)) == datetime.datetime(
        2026, 11, 21, 2, 30, tzinfo=UTC
    )
    assert next_run(JOB, datetime.datetime(2026, 11, 21, 2, 30, tzinfo=UTC)) == datetime.datetime(
        2026, 11, 22, 2, 30, tzinfo=UTC
    )


def test_follows_kyiv_summer_time():
    # Kyiv is UTC+3 in summer: 04:30 there is 01:30 UTC.
    assert next_run(JOB, datetime.datetime(2026, 7, 1, 12, 0, tzinfo=UTC)) == datetime.datetime(
        2026, 7, 2, 1, 30, tzinfo=UTC
    )


def test_crosses_both_clock_changes():
    # 2027-03-28 and 2026-10-25 are the last Sundays of March and October.
    assert next_run(JOB, datetime.datetime(2027, 3, 27, 12, 0, tzinfo=UTC)) == datetime.datetime(
        2027, 3, 28, 1, 30, tzinfo=UTC
    )
    assert next_run(JOB, datetime.datetime(2026, 10, 24, 12, 0, tzinfo=UTC)) == datetime.datetime(
        2026, 10, 25, 2, 30, tzinfo=UTC
    )


def test_every_job_has_its_own_lock_key_and_a_command():
    from django.core.management import get_commands

    assert len({job.lock_key for job in JOBS}) == len(JOBS)
    assert all(job.command in get_commands() for job in JOBS)
    assert job_named("sync_offering_instructors").at == datetime.time(4, 30)
