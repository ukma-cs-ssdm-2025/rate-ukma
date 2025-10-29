import asyncio
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

import structlog

from ...auth import with_authenticated_context
from ...services.filter_service import FilterService

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Select all filter options and generate filtered catalog URL"

    def add_arguments(self, parser):
        parser.add_argument(
            "--out",
            type=str,
            default=str(settings.SCRAPER_STATE_DIR / "filtered_catalog_url.txt"),
            help="Output file for filtered URL",
        )
        parser.add_argument(
            "--interactive",
            action="store_true",
            help="Show browser window",
        )

    def handle(self, *args, **options):
        asyncio.run(self._async_handle(options))

    async def _async_handle(self, options):
        out_path = Path(options["out"])
        interactive = options["interactive"]

        logger.info(
            "prepare_filtered_url_start",
            mode="INTERACTIVE" if interactive else "HEADLESS",
            output_path=str(out_path),
        )

        async def run(context):
            return await FilterService().prepare_filtered_url(
                context=context, base_url=settings.PARSE_BASE_URL, save_path=out_path
            )

        decorated = with_authenticated_context(
            email=settings.SAZ_EMAIL,
            password=settings.SAZ_PASSWORD,
            base_url=settings.PARSE_BASE_URL,
            state_path=settings.SCRAPER_STATE_DIR / "storage_state.json",
            headless=not interactive,
            slowmo=500 if interactive else 0,
        )(run)

        try:
            filtered_url = await decorated()
            logger.info(
                "prepare_filtered_url_success",
                url=filtered_url,
                saved_to=str(out_path),
            )
        except Exception as e:
            logger.error("prepare_filtered_url_failed", error=str(e))
            raise
