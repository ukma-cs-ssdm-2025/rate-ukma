import os
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.db.utils import ConnectionHandler

import pytest
from structlog.testing import capture_logs

from rating_app.exception.ukma_data_exceptions import UkmaDataForbiddenError
from rating_app.scheduler.lock import advisory_lock

COMMAND = "rating_app.management.commands.sync_offering_instructors"


@contextmanager
def lock_held_elsewhere(_key: int):
    yield False


@contextmanager
def lock_free(_key: int):
    yield True


def test_skips_while_another_run_holds_the_lock():
    with (
        patch(f"{COMMAND}.advisory_lock", lock_held_elsewhere),
        patch(f"{COMMAND}.OfferingInstructorSync") as sync,
        capture_logs() as logs,
    ):
        call_command("sync_offering_instructors")

    sync.assert_not_called()
    assert [(log["event"], log.get("reason")) for log in logs] == [
        ("offering_instructors_sync_skipped", "already_running")
    ]


@pytest.mark.parametrize("refusal", ["scope", "403"])
def test_logs_one_event_and_exits_without_the_scope(refusal):
    sync = MagicMock()
    sync.has_scope.return_value = refusal != "scope"
    sync.run.side_effect = UkmaDataForbiddenError()
    with (
        patch(f"{COMMAND}.advisory_lock", lock_free),
        patch(f"{COMMAND}.OfferingInstructorSync", return_value=sync),
        capture_logs() as logs,
    ):
        call_command("sync_offering_instructors")

    # A 403 is logged once, by UkmaDataService (`ukma_data_forbidden`).
    expected = (
        [("offering_instructors_sync_skipped", "missing_scope")] if refusal == "scope" else []
    )
    assert [(log["event"], log.get("reason")) for log in logs] == expected


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
