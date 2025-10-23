from pathlib import Path

from django.core.management.base import BaseCommand

import structlog

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

    def handle(self, *args, **options):
        ingestion_operation = courses_ingestion()
        logger.info("insert_scraped_started")
        file_path = options["file"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]

        ingestion_operation.execute(file_path=file_path, batch_size=batch_size, dry_run=dry_run)
        logger.info("insert_scraped_completed")
