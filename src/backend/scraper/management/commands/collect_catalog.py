import asyncio
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

import structlog

from scraper.auth import with_authenticated_context
from scraper.services.catalog_service import collect_catalog_ids

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Collect course IDs from catalog pages and save to JSONL"

    def add_arguments(self, parser):
        parser.add_argument(
            "--start-page", type=int, default=1, help="Catalog start page (default: 1)"
        )
        parser.add_argument(
            "--end-page", type=int, default=None, help="Catalog end page (auto-detect if omitted)"
        )
        parser.add_argument(
            "--out",
            type=str,
            default=str(settings.SCRAPER_STATE_DIR / "course_ids.jsonl"),
            help="Output file for IDs (JSONL)",
        )
        parser.add_argument("--devtools", action="store_true", help="Open DevTools")
        parser.add_argument(
            "--slowmo", type=int, default=None, help="Slow down actions in ms (e.g. 250)"
        )

    def handle(self, *args, **options):
        asyncio.run(self._async_handle(options))

    async def _async_handle(self, options):
        start_page = options["start_page"]
        end_page = options["end_page"]
        out_path = Path(options["out"])
        slowmo = options["slowmo"] or settings.SCRAPER_SLOWMO

        decorated_function = with_authenticated_context(
            email=settings.CAZ_EMAIL,
            password=settings.CAZ_PASSWORD,
            base_url=settings.PARSE_BASE_URL,
            state_path=settings.SCRAPER_STATE_DIR / "storage_state.json",
            headless=settings.SCRAPER_HEADLESS,
            slowmo=settings.SCRAPER_SLOWMO,
        )(self._collect_with_context)

        logger.info(
            "collect_catalog_started",
            start_page=start_page,
            end_page=end_page,
            output_file=str(out_path),
            slowmo=slowmo,
        )

        await decorated_function(start_page=start_page, end_page=end_page, out_path=out_path)

        logger.info("collect_catalog_completed")

    async def _collect_with_context(self, context, start_page, end_page, out_path):
        await collect_catalog_ids(
            context=context,
            base_url=settings.PARSE_BASE_URL,
            start_page=start_page,
            end_page=end_page,
            out_path=out_path,
        )
