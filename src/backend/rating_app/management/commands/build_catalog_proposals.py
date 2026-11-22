from django.core.management.base import BaseCommand

import structlog
import waffle

from rating_app.exception.ukma_data_exceptions import (
    UkmaDataForbiddenError,
    UkmaDataNotConfiguredError,
    UkmaDataUnavailableError,
)
from rating_app.models.sync import SyncSource
from rating_app.scheduler.lock import advisory_lock
from rating_app.services.ukma_data_service import UkmaDataService
from rating_app.sync.catalog.runner import (
    CatalogDataChangedError,
    ShortReadError,
    record_catalog_run,
)
from rating_app.sync.constants import CATALOG_SYNC_LOCK_KEY, SWITCH_NAME
from rating_app.sync.runs import fail_run, start_run

logger = structlog.get_logger(__name__)

CATALOG_SCOPE = "catalog:read"


class Command(BaseCommand):
    help = "Record the nightly catalog proposals from UKMA Data behind a switch (ADR 0022)."

    def handle(self, *args, **options) -> None:
        if not waffle.switch_is_active(SWITCH_NAME):
            logger.info("catalog_proposals_skipped", reason="switch_off")
            return

        with advisory_lock(CATALOG_SYNC_LOCK_KEY) as held:
            if not held:
                logger.info("catalog_proposals_skipped", reason="already_running")
                return

            service = UkmaDataService()
            try:
                scopes = service.get_key().scopes
            except UkmaDataNotConfiguredError:
                logger.warning("catalog_proposals_skipped", reason="not_configured")
                return
            except UkmaDataForbiddenError:
                # UkmaDataService already logged `ukma_data_forbidden`: one event.
                return
            if CATALOG_SCOPE not in scopes:
                logger.warning("catalog_proposals_skipped", reason="missing_scope")
                return

            self._record(service)

    def _record(self, service: UkmaDataService) -> None:
        # A failed run is logged and retried at its next time; the catalog stays untouched.
        run = start_run(SyncSource.CATALOG)
        try:
            record_catalog_run(run, service)
        except CatalogDataChangedError:
            fail_run(run, "data_changed")
        except ShortReadError as exc:
            logger.warning("catalog_proposals_short_read", years=exc.years)
            fail_run(run, "short_read")
        except UkmaDataForbiddenError:
            fail_run(run, "ukma_data_forbidden")
        except UkmaDataNotConfiguredError:
            fail_run(run, "not_configured")
        except UkmaDataUnavailableError:
            fail_run(run, "ukma_data_unavailable")
        except Exception:
            logger.exception("catalog_proposals_build_failed", run_id=run.pk)
            fail_run(run, "build_failed")
        else:
            logger.info("catalog_proposals_recorded", run_id=run.pk, counts=run.counts)
