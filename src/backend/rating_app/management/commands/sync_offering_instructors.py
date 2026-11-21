from dataclasses import asdict

from django.core.management.base import BaseCommand

import structlog

from rating_app.exception.ukma_data_exceptions import (
    UkmaDataForbiddenError,
    UkmaDataNotConfiguredError,
)
from rating_app.scheduler.jobs import job_named
from rating_app.scheduler.lock import advisory_lock
from rating_app.services.offering_instructor_sync import OfferingInstructorSync
from rating_app.services.ukma_data_service import UkmaDataService

logger = structlog.get_logger(__name__)

JOB = job_named("sync_offering_instructors")


class Command(BaseCommand):
    help = "Mirror UKMA Data's planned teachers into CourseInstructor (ADR 0020)."

    def handle(self, *args, **options) -> None:
        with advisory_lock(JOB.lock_key) as held:
            if not held:
                logger.info("offering_instructors_sync_skipped", reason="already_running")
                return
            sync = OfferingInstructorSync(UkmaDataService())
            try:
                if not sync.has_scope():
                    logger.warning("offering_instructors_sync_skipped", reason="missing_scope")
                    return
                report = sync.run()
            except UkmaDataForbiddenError:
                # UkmaDataService already logged `ukma_data_forbidden`: one event.
                return
            except UkmaDataNotConfiguredError:
                logger.warning("offering_instructors_sync_skipped", reason="not_configured")
                return
            logger.info("offering_instructors_synced", **asdict(report))
