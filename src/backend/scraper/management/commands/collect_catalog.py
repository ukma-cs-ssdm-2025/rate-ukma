import asyncio
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

import structlog

from ...auth import with_authenticated_context
from ...services.catalog_service import collect_catalog_ids
from ...services.filter_service import FilterService

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
        parser.add_argument(
            "--url",
            type=str,
            default=None,
            help="Custom catalog URL with filters \
                (default: load from state/filtered_catalog_url.txt)",
        )
        parser.add_argument(
            "--interactive",
            action="store_true",
            help="Show browser window",
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
        interactive = options["interactive"]
        slowmo = options["slowmo"] or settings.SCRAPER_SLOWMO
        custom_url = options.get("url")

        # Determine which URL to use
        catalog_url = None
        if custom_url:
            catalog_url = custom_url
            logger.info("using_custom_catalog_url", url=catalog_url)
        else:
            filtered_url = await FilterService().load_filtered_url()
            if filtered_url:
                catalog_url = filtered_url
                logger.info("using_filtered_catalog_url", url=catalog_url)
            else:
                catalog_url = f"{settings.PARSE_BASE_URL}/course/catalog"
                logger.info("filtered_url_not_found_using_default", url=catalog_url)

        decorated_function = with_authenticated_context(
            email=settings.SAZ_EMAIL,
            password=settings.SAZ_PASSWORD,
            base_url=settings.PARSE_BASE_URL,
            state_path=settings.SCRAPER_STATE_DIR / "storage_state.json",
            headless=not interactive,
            slowmo=slowmo,
        )(self._collect_with_context)

        logger.info(
            "collect_catalog_started",
            start_page=start_page,
            end_page=end_page,
            output_file=str(out_path),
            catalog_url=catalog_url,
            mode="INTERACTIVE" if interactive else "HEADLESS",
            slowmo=slowmo,
        )

        await decorated_function(
            start_page=start_page, end_page=end_page, out_path=out_path, catalog_url=catalog_url
        )

        logger.info("collect_catalog_completed")

    async def _collect_with_context(self, context, start_page, end_page, out_path, catalog_url):
        await collect_catalog_ids(
            context=context,
            catalog_url=catalog_url,
            start_page=start_page,
            end_page=end_page,
            out_path=out_path,
        )
