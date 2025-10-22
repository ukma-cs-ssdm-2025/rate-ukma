from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

import structlog

from ...services.deduplication.deduplication_service import CourseDeduplicatorService

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Deduplicate raw course data and output clean course entries"

    def add_arguments(self, parser):
        parser.add_argument(
            "input_file",
            type=str,
            nargs="?",
            default=str(settings.SCRAPER_STATE_DIR / "courses.jsonl"),
            help="Input JSONL file with raw course details",
        )
        parser.add_argument(
            "--out",
            type=str,
            default=str(settings.SCRAPER_STATE_DIR / "deduplicated_courses.jsonl"),
            help="Output JSONL file with deduplicated courses",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite output file if it exists",
        )

    def handle(self, *args, **options):
        input_path = Path(options["input_file"])
        output_path = Path(options["out"])

        if not input_path.exists():
            raise CommandError(f"Input file does not exist: {input_path}")

        if output_path.exists() and not options["force"]:
            raise CommandError(
                f"Output file already exists: {output_path}. Use --force to overwrite."
            )

        output_path.parent.mkdir(parents=True, exist_ok=True)

        self.stdout.write(
            self.style.SUCCESS(f"Starting deduplication from {input_path} to {output_path}")
        )

        try:
            deduplicator = CourseDeduplicatorService()
            deduplicator.deduplicate_courses(input_path, output_path)

            self.stdout.write(
                self.style.SUCCESS(f"Successfully deduplicated courses to {output_path}")
            )

        except Exception as e:
            logger.exception("deduplication_failed", input=str(input_path), error=str(e))
            raise CommandError(f"Deduplication failed: {e}") from e
