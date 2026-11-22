from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

import structlog

from rating_app.scheduler.lock import advisory_lock
from rating_app.sync.constants import CATALOG_SYNC_LOCK_KEY
from scraper.services.db_ingestion.injector import CatalogWritesRefusedError

from ...ioc_container.common import courses_ingestion

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Insert all scraped courses data from file into the database"

    def add_arguments(self, parser):
        parser.add_argument("--file", type=Path, required=True, help="File to insert data from")
        parser.add_argument("--batch-size", type=int, default=100, help="Batch size for ingestion")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Run in dry-run mode (no database changes)",
        )
        parser.add_argument(
            "--enrollments-only",
            action="store_true",
            default=False,
            help="Write only enrollments, by САЗ code, for offerings that exist",
        )

    def handle(self, *args, **options):
        ingestion_operation = courses_ingestion()
        logger.info("insert_scraped_started")
        file_path = options["file"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]
        enrollments_only = options["enrollments_only"]

        with advisory_lock(CATALOG_SYNC_LOCK_KEY) as held:
            if not held:
                raise CommandError("another catalog sync is running")

            injection = getattr(ingestion_operation, "db_injector", None)
            if injection is not None:
                injection.enrollments_only = enrollments_only

            try:
                ingestion_operation.execute(
                    file_path=file_path, batch_size=batch_size, dry_run=dry_run
                )
            except CatalogWritesRefusedError as exc:
                raise CommandError(
                    "catalog rows are linked to UKMA Data; use --enrollments-only"
                ) from exc
        logger.info("insert_scraped_completed")
