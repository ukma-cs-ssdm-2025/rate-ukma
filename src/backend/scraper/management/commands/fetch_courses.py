import asyncio
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

import structlog

from scraper.auth import with_authenticated_context
from scraper.services.course_service import fetch_details_by_ids

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Fetch detail pages for course IDs and save JSONL"

    def add_arguments(self, parser):
        parser.add_argument(
            "ids_file",
            type=str,
            nargs="?",
            default=str(settings.SCRAPER_STATE_DIR / "course_ids.jsonl"),
            help="File with course IDs (.jsonl or .txt)",
        )
        parser.add_argument(
            "--out",
            type=str,
            default=str(settings.SCRAPER_STATE_DIR / "courses.jsonl"),
            help="Output JSONL with course details",
        )
        parser.add_argument("--concurrency", type=int, default=None, help="Parallel pages to parse")
        parser.add_argument(
            "--no-resume", action="store_true", help="Disable resume mode (process all IDs)"
        )
        parser.add_argument("--devtools", action="store_true", help="Open DevTools")
        parser.add_argument(
            "--slowmo", type=int, default=None, help="Slow down actions in ms (e.g. 250)"
        )

    def handle(self, *args, **options):
        asyncio.run(self._async_handle(options))

    async def _async_handle(self, options):
        ids_file = Path(options["ids_file"])
        out_path = Path(options["out"])
        concurrency = options["concurrency"] or settings.SCRAPER_CONCURRENCY
        resume = not options["no_resume"]
        slowmo = options["slowmo"] or settings.SCRAPER_SLOWMO

        decorated_function = with_authenticated_context(
            email=settings.CAZ_EMAIL,
            password=settings.CAZ_PASSWORD,
            base_url=settings.PARSE_BASE_URL,
            state_path=settings.SCRAPER_STATE_DIR / "storage_state.json",
            headless=settings.SCRAPER_HEADLESS,
            slowmo=settings.SCRAPER_SLOWMO,
        )(self._fetch_with_context)

        logger.info(
            "fetch_courses_started",
            ids_file=str(ids_file),
            output_file=str(out_path),
            concurrency=concurrency,
            resume=resume,
            slowmo=slowmo,
        )

        if not ids_file.exists():
            logger.error("ids_file_not_found", ids_file=str(ids_file))
            raise CommandError(f"IDs file does not exist: {ids_file}")

        await decorated_function(
            ids_file=ids_file, out_path=out_path, concurrency=concurrency, resume=resume
        )

        logger.info("fetch_courses_completed")

    async def _fetch_with_context(self, context, ids_file, out_path, concurrency, resume):
        await fetch_details_by_ids(
            context=context,
            base_url=settings.PARSE_BASE_URL,
            ids_file=ids_file,
            out_path=out_path,
            concurrency=concurrency,
            resume=resume,
        )
