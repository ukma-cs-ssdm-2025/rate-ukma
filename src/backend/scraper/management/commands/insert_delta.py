from pathlib import Path

from django.core.management.base import BaseCommand

import structlog

from ...ioc_container.common import courses_delta_ingestion

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Insert all updated courses data from file into the database"

    def add_arguments(self, parser):
        parser.add_argument("--file", type=Path, default=None, help="File to insert data from")
        parser.add_argument("--batch-size", type=int, default=100, help="Batch size for ingestion")

    def handle(self, *args, **options):
        logger.info("insert_delta_started")
        processor = courses_delta_ingestion()
        file_path = options["file"]
        batch_size = options["batch_size"]

        processor.provide(file_path=file_path, batch_size=batch_size)
        logger.info("insert_delta_completed")
