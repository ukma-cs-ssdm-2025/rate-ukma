import os
from contextlib import contextmanager
from unittest.mock import patch

from django.core.management import call_command
from django.db.utils import ConnectionHandler

import pytest
from structlog.testing import capture_logs

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import UkmaDataKey
from rating_app.exception.ukma_data_exceptions import (
    UkmaDataForbiddenError,
    UkmaDataNotConfiguredError,
    UkmaDataUnavailableError,
)
from rating_app.models import (
    Instructor,
    SyncChange,
    SyncChangeState,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.repositories.instructor_repository import current_academic_year_start
from rating_app.scheduler.lock import advisory_lock

COMMAND = "rating_app.management.commands.sync_offering_instructors"
YEAR = current_academic_year_start()


@contextmanager
def lock_held_elsewhere(_key: int):
    yield False


@contextmanager
def lock_free(_key: int):
    yield True


def _key(*scopes: str) -> UkmaDataKey:
    return UkmaDataKey.model_validate(
        {"id": "key_1", "scopes": list(scopes), "expiresAt": "2031-01-01T00:00:00Z"}
    )


def _offering(code: str, email: str | None = "new@example.invalid") -> ud.OfferingTeachers:
    return ud.OfferingTeachers.model_validate(
        {
            "id": f"ot_{code}",
            "sazCode": code,
            "academicYear": YEAR,
            "instructors": [
                {
                    "id": f"ins_{code}",
                    "lastName": "Вигадана",
                    "firstName": "Марта",
                    "middleName": None,
                    "email": email,
                    "role": "lecturer",
                }
            ],
            "changeNo": 1,
            "removedAt": None,
        }
    )


class FakeUkmaData:
    def __init__(
        self,
        *,
        current=(),
        previous=(),
        scopes: tuple[str, ...] = ("instructors:read",),
        key_error: Exception | None = None,
    ) -> None:
        self.by_year = {YEAR: list(current), YEAR - 1: list(previous)}
        self.scopes = list(scopes)
        self.key_error = key_error

    def get_key(self) -> UkmaDataKey:
        if self.key_error is not None:
            raise self.key_error
        return _key(*self.scopes)

    def list_offering_instructors(self, params, *, year: int) -> ud.OfferingTeachersPage:
        after = params.after or 0
        rows = [row for row in self.by_year[year] if row.change_no > after]
        return ud.OfferingTeachersPage.model_validate(
            {
                "items": [row.model_dump(by_alias=True) for row in rows],
                "cursor": rows[-1].change_no if rows else after,
                "hasMore": False,
                "dataUpdatedAt": None,
            }
        )


def run_command(fake: FakeUkmaData, *, lock=lock_free):
    with (
        patch(f"{COMMAND}.advisory_lock", lock),
        patch(f"{COMMAND}.UkmaDataService", return_value=fake),
        capture_logs() as logs,
    ):
        call_command("sync_offering_instructors")
    return logs


def test_skips_while_another_run_holds_the_lock():
    with (
        patch(f"{COMMAND}.advisory_lock", lock_held_elsewhere),
        patch(f"{COMMAND}.UkmaDataService") as service,
        capture_logs() as logs,
    ):
        call_command("sync_offering_instructors")

    service.assert_not_called()
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("offering_instructors_sync_skipped", "already_running")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_skips_and_records_no_run_without_the_instructors_scope():
    logs = run_command(FakeUkmaData(scopes=("catalog:read",)))

    assert SyncRun.objects.count() == 0
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("offering_instructors_sync_skipped", "missing_scope")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_skips_and_records_no_run_when_ukma_data_is_not_configured():
    logs = run_command(FakeUkmaData(key_error=UkmaDataNotConfiguredError()))

    assert SyncRun.objects.count() == 0
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("offering_instructors_sync_skipped", "not_configured")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_logs_nothing_more_when_ukma_data_forbids_the_key():
    logs = run_command(FakeUkmaData(key_error=UkmaDataForbiddenError()))

    assert SyncRun.objects.count() == 0
    assert [log["event"] for log in logs] == []


@pytest.mark.django_db
@pytest.mark.integration
def test_records_the_run_and_its_changes_with_the_old_counts(course_offering_factory):
    course_offering_factory(code="990001")

    logs = run_command(FakeUkmaData(current=[_offering("990001")], previous=[]))

    run = SyncRun.objects.get()
    assert (run.source, run.status) == (SyncSource.TEACHERS, SyncRunStatus.SUCCEEDED)
    assert run.counts["matched"] == 1
    assert run.counts["skipped"] == 0
    assert run.counts["created"] == 1
    assert run.cursor_from == {"after": 0}
    assert sorted(SyncChange.objects.values_list("kind", "state")) == [
        ("teacher_created", SyncChangeState.PROPOSED),
        ("teacher_link_added", SyncChangeState.PROPOSED),
    ]
    assert Instructor.objects.count() == 0
    assert "offering_instructors_synced" in [log["event"] for log in logs]


@pytest.mark.django_db
@pytest.mark.integration
def test_runs_the_auto_path_on_the_lock_it_already_holds(course_offering_factory):
    course_offering_factory(code="990001")

    with patch(f"{COMMAND}.apply_by_policy") as auto:
        run_command(FakeUkmaData(current=[_offering("990001")]))

    auto.assert_called_once_with(SyncRun.objects.get(), lock_held=True)


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_when_ukma_data_stops_answering(course_offering_factory):
    course_offering_factory(code="990001")
    fake = FakeUkmaData(current=[_offering("990001")])

    with patch.object(fake, "list_offering_instructors", side_effect=UkmaDataUnavailableError()):
        run_command(fake)

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "ukma_data_unavailable")
    assert SyncChange.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_naming_the_year_of_a_short_read(course_offering_factory, sync_run_factory):
    sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        counts={"matched": 2, "years": {str(YEAR): {"matched": 2, "links": 0}}},
    )
    course_offering_factory(code="990001")

    logs = run_command(FakeUkmaData(current=[_offering("990001")]))

    run = SyncRun.objects.filter(source=SyncSource.TEACHERS).latest("pk")
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "short_read")
    short = [log for log in logs if log["event"] == "offering_instructors_short_read"]
    assert short[0]["years"] == [YEAR]


DSN = os.environ.get("ADVISORY_LOCK_TEST_POSTGRES")


@pytest.mark.skipif(
    not DSN, reason="needs Postgres: set ADVISORY_LOCK_TEST_POSTGRES=host:port:db:user:password"
)
def test_a_second_holder_of_the_advisory_lock_is_refused(django_db_blocker):
    host, port, name, user, password = (DSN or "").split(":")
    postgres = ConnectionHandler(
        {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "HOST": host,
                "PORT": port,
                "NAME": name,
                "USER": user,
                "PASSWORD": password,
            }
        }
    )

    with django_db_blocker.unblock(), patch("rating_app.scheduler.lock.connections", postgres):
        with advisory_lock(864_999) as first, advisory_lock(864_999) as second:
            assert (first, second) == (True, False)

        with advisory_lock(864_999) as again:
            assert again is True
