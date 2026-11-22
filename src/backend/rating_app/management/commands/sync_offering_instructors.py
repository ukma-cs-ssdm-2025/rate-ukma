from django.core.management.base import BaseCommand

import structlog

from rating_app.exception.ukma_data_exceptions import (
    UkmaDataForbiddenError,
    UkmaDataNotConfiguredError,
    UkmaDataUnavailableError,
)
from rating_app.models.sync import SyncSource
from rating_app.scheduler.jobs import job_named
from rating_app.scheduler.lock import advisory_lock
from rating_app.services.ukma_data_service import UkmaDataService
from rating_app.sync.apply import apply_by_policy
from rating_app.sync.errors import ShortReadError, StalledReadError
from rating_app.sync.runs import fail_run, start_run
from rating_app.sync.teachers import INSTRUCTORS_SCOPE, record_teacher_run

logger = structlog.get_logger(__name__)

JOB = job_named("sync_offering_instructors")


class Command(BaseCommand):
    help = "Record UKMA Data's planned teacher changes as a sync run (ADR 0020, ADR 0022)."

    def handle(self, *args, **options) -> None:
        with advisory_lock(JOB.lock_key) as held:
            if not held:
                logger.info("offering_instructors_sync_skipped", reason="already_running")
                return

            service = UkmaDataService()
            try:
                scopes = service.get_key().scopes
            except UkmaDataNotConfiguredError:
                logger.warning("offering_instructors_sync_skipped", reason="not_configured")
                return
            except UkmaDataForbiddenError:
                # UkmaDataService already logged `ukma_data_forbidden`: one event.
                return
            if INSTRUCTORS_SCOPE not in scopes:
                logger.warning("offering_instructors_sync_skipped", reason="missing_scope")
                return

            self._record(service)

    def _record(self, service: UkmaDataService) -> None:
        # A failed run is logged and retried at its next time; links stay untouched.
        run = start_run(SyncSource.TEACHERS)
        try:
            record_teacher_run(run, service)
        except ShortReadError as exc:
            logger.warning("offering_instructors_short_read", years=exc.years)
            fail_run(run, "short_read")
        except UkmaDataForbiddenError:
            fail_run(run, "ukma_data_forbidden")
        except UkmaDataNotConfiguredError:
            fail_run(run, "not_configured")
        except UkmaDataUnavailableError:
            fail_run(run, "ukma_data_unavailable")
        except StalledReadError:
            fail_run(run, "stalled_read")
        except Exception as exc:
            # The type only: a payload error would quote a teacher's name.
            logger.error(
                "offering_instructors_build_failed", run_id=run.pk, error=type(exc).__name__
            )
            fail_run(run, "build_failed")
        else:
            logger.info("offering_instructors_synced", run_id=run.pk, **run.counts)
            try:
                apply_by_policy(run, lock_held=True)
            except Exception as exc:
                logger.error(
                    "offering_instructors_auto_apply_failed",
                    run_id=run.pk,
                    error=type(exc).__name__,
                )
