from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

import structlog

from ...services.deduplication.grouping_service import CourseGroupingService

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Group course offerings from different academic years and output unified course entries"

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
            default=str(settings.SCRAPER_STATE_DIR / "grouped_courses.jsonl"),
            help="Output JSONL file with grouped courses",
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

        if input_path.resolve() == output_path.resolve():
            raise CommandError("Input and output paths must differ.")

        if output_path.exists():
            if not options["force"]:
                raise CommandError(
                    f"Output file already exists: {output_path}. Use --force to overwrite."
                )
            try:
                output_path.unlink()
            except OSError as exc:
                raise CommandError(
                    f"Failed to remove existing output file {output_path}: {exc}"
                ) from exc

        output_path.parent.mkdir(parents=True, exist_ok=True)

        self.stdout.write(
            self.style.SUCCESS(f"Starting course grouping from {input_path} to {output_path}")
        )

        try:
            grouper = CourseGroupingService()
            grouper.group_courses(input_path, output_path)

            self.stdout.write(self.style.SUCCESS(f"Successfully grouped courses to {output_path}"))

        except Exception as e:
            logger.exception("grouping_failed", input=str(input_path), error=str(e))
            raise CommandError(f"Course grouping failed: {e}") from e
