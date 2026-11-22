import datetime

from rating_app.scheduler.jobs import JOBS, Job, job_named, next_run

JOB = Job("example", datetime.time(2, 0), lock_key=1)
UTC = datetime.UTC


def test_runs_today_before_the_time_and_tomorrow_after_it():
    assert next_run(JOB, datetime.datetime(2026, 11, 21, 1, 0, tzinfo=UTC)) == datetime.datetime(
        2026, 11, 21, 2, 0, tzinfo=UTC
    )
    assert next_run(JOB, datetime.datetime(2026, 11, 21, 2, 0, tzinfo=UTC)) == datetime.datetime(
        2026, 11, 22, 2, 0, tzinfo=UTC
    )


def test_reads_an_aware_time_in_another_zone_as_utc():
    kyiv_winter = datetime.timezone(datetime.timedelta(hours=2))
    assert next_run(
        JOB, datetime.datetime(2026, 11, 21, 3, 30, tzinfo=kyiv_winter)
    ) == datetime.datetime(2026, 11, 21, 2, 0, tzinfo=UTC)


def test_every_job_has_its_own_lock_key_and_a_command():
    from django.core.management import get_commands

    assert len({job.lock_key for job in JOBS}) == len(JOBS)
    assert all(job.command in get_commands() for job in JOBS)
    assert job_named("sync_offering_instructors").at == datetime.time(2, 0)


def test_the_catalog_proposals_job_runs_at_half_past_two_under_its_lock():
    job = job_named("build_catalog_proposals")

    assert job.at == datetime.time(2, 30)
    assert job.lock_key == 768_001
