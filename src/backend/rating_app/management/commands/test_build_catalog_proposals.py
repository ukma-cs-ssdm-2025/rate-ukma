import datetime
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch

from django.core.management import call_command

import pytest
from structlog.testing import capture_logs

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.application_schemas.ukma_data_params import UkmaDataKey, UkmaDataStatus
from rating_app.exception.ukma_data_exceptions import (
    UkmaDataForbiddenError,
    UkmaDataNotConfiguredError,
    UkmaDataUnavailableError,
)
from rating_app.models import (
    Faculty,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.models.choices import SemesterTerm
from rating_app.sync.catalog.runner import short_read_years

COMMAND = "rating_app.management.commands.build_catalog_proposals"
RUNNER = "rating_app.sync.catalog.runner"

DATA_UPDATED_AT = datetime.datetime(2026, 11, 21, 3, 0, tzinfo=datetime.UTC)


@contextmanager
def lock_free(_key: int):
    yield True


@contextmanager
def lock_held_elsewhere(_key: int):
    yield False


def _faculty(
    faculty_id: str = "ud-fac",
    *,
    name: str = "Факультет тестових даних",
    change_no: int = 1,
) -> ud.Faculty:
    return ud.Faculty.model_validate(
        {
            "id": faculty_id,
            "name": name,
            "sazFilterId": None,
            "changeNo": change_no,
            "removedAt": None,
        }
    )


class FakeUkmaData:
    def __init__(
        self,
        *,
        faculties: tuple[ud.Faculty, ...] = (),
        statuses: tuple[datetime.datetime | None, ...] = (DATA_UPDATED_AT, DATA_UPDATED_AT),
        scopes: tuple[str, ...] = ("catalog:read",),
        key_error: Exception | None = None,
        page_size: int = 1000,
    ) -> None:
        self.faculties = faculties
        self.statuses = statuses
        self.scopes = scopes
        self.key_error = key_error
        self.page_size = page_size
        self.status_calls = 0

    def get_key(self) -> UkmaDataKey:
        if self.key_error is not None:
            raise self.key_error
        return UkmaDataKey(id="key-1", scopes=list(self.scopes), expires_at="2030-01-01T00:00:00Z")

    def get_status(self) -> UkmaDataStatus:
        index = min(self.status_calls, len(self.statuses) - 1)
        self.status_calls += 1
        return UkmaDataStatus(
            key_id="key-1",
            scopes=list(self.scopes),
            decide_scopes=[],
            key_expires_at=datetime.datetime(2030, 1, 1, tzinfo=datetime.UTC),
            data_updated_at=self.statuses[index],
        )

    def list_faculties(self, params) -> ud.FacultyPage:
        return self._page(self.faculties, params, ud.FacultyPage)

    def list_departments(self, params) -> ud.DepartmentPage:
        return self._page((), params, ud.DepartmentPage)

    def list_programmes(self, params) -> ud.ProgrammePage:
        return self._page((), params, ud.ProgrammePage)

    def list_terms(self, params) -> ud.TermPage:
        return self._page((), params, ud.TermPage)

    def list_courses(self, params) -> ud.CoursePage:
        return self._page((), params, ud.CoursePage)

    def list_offerings(self, params) -> ud.OfferingPage:
        return self._page((), params, ud.OfferingPage)

    def _page(self, rows, params, page_type):
        after = params.after or 0
        matches = sorted(
            (row for row in rows if row.change_no > after), key=lambda row: row.change_no
        )
        window = matches[: self.page_size]
        cursor = window[-1].change_no if window else after
        return page_type(
            items=window,
            cursor=cursor,
            has_more=len(matches) > len(window),
            data_updated_at=None,
        )


def run_command(fake: FakeUkmaData, *, lock=lock_free, switch: bool = True):
    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=switch),
        patch(f"{COMMAND}.advisory_lock", lock),
        patch(f"{COMMAND}.UkmaDataService", return_value=fake),
        capture_logs() as logs,
    ):
        call_command("build_catalog_proposals")
    return logs


@pytest.mark.django_db
@pytest.mark.integration
def test_skips_and_creates_no_run_when_the_switch_is_off():
    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=False),
        patch(f"{COMMAND}.UkmaDataService") as service,
        capture_logs() as logs,
    ):
        call_command("build_catalog_proposals")

    service.assert_not_called()
    assert SyncRun.objects.count() == 0
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("catalog_proposals_skipped", "switch_off")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_skips_and_creates_no_run_when_ukma_data_is_not_configured():
    logs = run_command(FakeUkmaData(key_error=UkmaDataNotConfiguredError()))

    assert SyncRun.objects.count() == 0
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("catalog_proposals_skipped", "not_configured")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_skips_and_creates_no_run_without_the_catalog_scope():
    logs = run_command(FakeUkmaData(scopes=("review:decide",)))

    assert SyncRun.objects.count() == 0
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("catalog_proposals_skipped", "missing_scope")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_skips_and_creates_no_run_when_another_run_holds_the_lock():
    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=True),
        patch(f"{COMMAND}.advisory_lock", lock_held_elsewhere),
        patch(f"{COMMAND}.UkmaDataService") as service,
        capture_logs() as logs,
    ):
        call_command("build_catalog_proposals")

    service.assert_not_called()
    assert SyncRun.objects.count() == 0
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("catalog_proposals_skipped", "already_running")
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_records_the_run_and_its_changes_with_groups_and_counts():
    fake = FakeUkmaData(
        faculties=(
            _faculty(name="Факультет тестових даних"),
            _faculty("ud-fac-long", name="Ф" * 256),
        )
    )

    logs = run_command(fake)

    run = SyncRun.objects.get()
    assert run.source == SyncSource.CATALOG
    assert run.status == SyncRunStatus.SUCCEEDED
    assert run.data_updated_at == DATA_UPDATED_AT
    assert run.cursor_from == {"after": 0}
    assert run.counts == {"new_faculty": 1, "skipped": {"title_too_long": 1}}

    change = SyncChange.objects.get()
    assert (change.kind, change.group) == ("new_faculty", SyncChangeGroup.NEW)
    assert change.source == SyncSource.CATALOG
    assert change.key == "ud-fac"
    assert change.ukma_data_id == "ud-fac"
    assert change.after["name"] == "Факультет тестових даних"
    assert change.after["display"]["name"] == "Факультет тестових даних"
    assert Faculty.objects.count() == 0
    assert "catalog_proposals_recorded" in [log["event"] for log in logs]
    assert change.state == SyncChangeState.PROPOSED


@pytest.mark.django_db
@pytest.mark.integration
def test_runs_the_auto_path_on_the_lock_it_already_holds():
    fake = FakeUkmaData(faculties=(_faculty(name="Факультет тестових даних"),))

    with patch(f"{COMMAND}.apply_by_policy") as auto:
        run_command(fake)

    auto.assert_called_once_with(SyncRun.objects.get(), lock_held=True)


@pytest.mark.django_db
@pytest.mark.integration
def test_keeps_the_newest_copy_of_a_row_read_on_two_pages():
    fake = FakeUkmaData(
        faculties=(
            _faculty(name="Факультет Альфа", change_no=1),
            _faculty(name="Факультет Бета", change_no=7),
        ),
        page_size=1,
    )

    run_command(fake)

    change = SyncChange.objects.get()
    assert change.after["name"] == "Факультет Бета"


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_when_the_data_changes_twice_under_the_read():
    first = datetime.datetime(2026, 11, 21, 3, 0, tzinfo=datetime.UTC)
    second = first + datetime.timedelta(minutes=1)
    third = second + datetime.timedelta(minutes=1)

    run_command(FakeUkmaData(statuses=(first, second, third)))

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "data_changed")
    assert SyncChange.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_naming_the_year_of_a_short_read(
    course_factory, semester_factory, course_offering_factory
):
    course = course_factory()
    semester = semester_factory(year=2025, term=SemesterTerm.FALL)
    course_offering_factory.create_batch(2, course=course, semester=semester)

    logs = run_command(FakeUkmaData())

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "short_read")
    short = [log for log in logs if log["event"] == "catalog_proposals_short_read"]
    assert short[0]["years"] == [2025]


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_when_ukma_data_stops_answering():
    fake = FakeUkmaData()
    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=True),
        patch(f"{COMMAND}.advisory_lock", lock_free),
        patch(f"{COMMAND}.UkmaDataService", return_value=fake),
        patch.object(fake, "list_faculties", side_effect=UkmaDataUnavailableError()),
    ):
        call_command("build_catalog_proposals")

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "ukma_data_unavailable")
    assert SyncChange.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_when_ukma_data_refuses_the_key():
    fake = FakeUkmaData()
    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=True),
        patch(f"{COMMAND}.advisory_lock", lock_free),
        patch(f"{COMMAND}.UkmaDataService", return_value=fake),
        patch.object(fake, "list_faculties", side_effect=UkmaDataForbiddenError()),
    ):
        call_command("build_catalog_proposals")

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "ukma_data_forbidden")
    assert SyncChange.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_a_builder_failure_fails_the_run_and_writes_no_changes():
    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=True),
        patch(f"{COMMAND}.advisory_lock", lock_free),
        patch(f"{COMMAND}.UkmaDataService", return_value=FakeUkmaData()),
        patch(f"{RUNNER}.propose_links_and_new", side_effect=RuntimeError("boom")),
        capture_logs() as logs,
    ):
        call_command("build_catalog_proposals")

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "build_failed")
    assert SyncChange.objects.count() == 0
    failed = [log for log in logs if log["event"] == "sync_run_failed"]
    assert failed[0]["log_level"] == "error"


@pytest.mark.django_db
@pytest.mark.integration
def test_fails_the_run_when_a_page_says_more_but_its_cursor_stands_still():
    fake = FakeUkmaData()
    stalled = ud.FacultyPage(items=[], cursor=0, has_more=True, data_updated_at=None)

    with patch.object(fake, "list_faculties", return_value=stalled):
        run_command(fake)

    run = SyncRun.objects.get()
    assert (run.status, run.error) == (SyncRunStatus.FAILED, "stalled_read")


def test_years_before_ukma_data_coverage_are_not_short():
    ud_snapshot = SimpleNamespace(
        offerings={f"ud-{n}": SimpleNamespace(academic_year=2024) for n in range(10)}
    )
    ru_snapshot = SimpleNamespace(
        offerings={
            **{
                f"old-{n}": SimpleNamespace(
                    semester_year=2019, semester_term="FALL", ukma_data_id=None
                )
                for n in range(5)
            },
            **{
                f"new-{n}": SimpleNamespace(
                    semester_year=2024, semester_term="FALL", ukma_data_id=None
                )
                for n in range(10)
            },
        }
    )

    assert short_read_years(ud_snapshot, ru_snapshot) == []  # pyright: ignore[reportArgumentType] - duck-typed snapshot


def test_a_year_at_ninety_percent_is_not_short_and_below_it_is():
    ru_snapshot = SimpleNamespace(
        offerings={
            f"ru-{n}": SimpleNamespace(semester_year=2024, semester_term="FALL", ukma_data_id=None)
            for n in range(10)
        }
    )

    def ud_with(count: int) -> SimpleNamespace:
        return SimpleNamespace(
            offerings={f"ud-{n}": SimpleNamespace(academic_year=2024) for n in range(count)}
        )

    assert short_read_years(ud_with(9), ru_snapshot) == []  # pyright: ignore[reportArgumentType] - duck-typed snapshot
    assert short_read_years(ud_with(8), ru_snapshot) == [2024]  # pyright: ignore[reportArgumentType] - duck-typed snapshot


def test_a_dropped_year_that_held_linked_offerings_is_still_short():
    ud_snapshot = SimpleNamespace(
        offerings={f"ud-{n}": SimpleNamespace(academic_year=2025) for n in range(10)}
    )
    ru_snapshot = SimpleNamespace(
        offerings={
            **{
                f"linked-{n}": SimpleNamespace(
                    semester_year=2024, semester_term="FALL", ukma_data_id=f"ud-old-{n}"
                )
                for n in range(5)
            },
            **{
                f"new-{n}": SimpleNamespace(
                    semester_year=2025, semester_term="FALL", ukma_data_id=None
                )
                for n in range(10)
            },
        }
    )

    assert short_read_years(ud_snapshot, ru_snapshot) == [2024]  # pyright: ignore[reportArgumentType] - duck-typed snapshot


@pytest.mark.django_db
@pytest.mark.integration
def test_a_failed_auto_apply_is_logged_by_type_and_the_run_still_succeeds():
    fake = FakeUkmaData(faculties=(_faculty(name="Факультет тестових даних"),))
    secret = "teacher.person@example.test"

    with (
        patch(f"{COMMAND}.waffle.switch_is_active", return_value=True),
        patch(f"{COMMAND}.advisory_lock", lock_free),
        patch(f"{COMMAND}.UkmaDataService", return_value=fake),
        patch(f"{COMMAND}.apply_by_policy", side_effect=RuntimeError(secret)),
        capture_logs() as logs,
    ):
        call_command("build_catalog_proposals")

    run = SyncRun.objects.get()
    assert run.status == SyncRunStatus.SUCCEEDED
    assert SyncChange.objects.count() == 1
    failed = [log for log in logs if log["event"] == "catalog_proposals_auto_apply_failed"]
    assert len(failed) == 1
    assert failed[0]["error"] == "RuntimeError"
    assert secret not in repr(logs)
