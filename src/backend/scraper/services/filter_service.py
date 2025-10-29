from pathlib import Path

from django.conf import settings

import structlog
from playwright.async_api import BrowserContext, Page

logger = structlog.get_logger(__name__)


class FilterService:
    @property
    def default_save_path(self) -> Path:
        return settings.SCRAPER_STATE_DIR / "filtered_catalog_url.txt"

    async def prepare_filtered_url(
        self,
        context: BrowserContext,
        base_url: str,
        save_path: Path | None = None,
    ) -> str:
        save_path = save_path or self.default_save_path
        page = await context.new_page()

        try:
            await self._navigate_to_catalog(page, base_url)
            result = await self._select_all_filters(page)
            filtered_url = await self._submit_and_get_filtered_url(page)
            await self._save_url(filtered_url, save_path)

            logger.info(
                "filter_selection_completed",
                processed=result["processed"],
                selected=result["selected"],
            )
            return filtered_url

        finally:
            await page.close()

    async def load_filtered_url(self, path: Path | None = None) -> str:
        path = path or self.default_save_path
        return path.read_text(encoding="utf-8").strip() if path.exists() else ""

    async def _navigate_to_catalog(self, page: Page, base_url: str) -> None:
        catalog_url = f"{base_url}/course/catalog"
        await page.goto(catalog_url)

    async def _select_all_filters(self, page: Page) -> dict[str, int]:
        result = await page.evaluate("""
            () => {
                const selects = document.querySelectorAll('select[id^="filter-"]');
                let processed = 0;
                let selected = 0;

                selects.forEach(select => {
                    if (select.options.length > 0) {
                        for (let i = 0; i < select.options.length; i++) {
                            select.options[i].selected = true;
                        }
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        processed++;
                        selected += select.options.length;
                    }
                });

                return { processed, selected };
            }
        """)

        await page.wait_for_timeout(1000)
        return result

    async def _submit_and_get_filtered_url(self, page: Page) -> str:
        url_before = page.url

        await page.evaluate("""
    document.querySelector("#course-catalog-filters .panel-footer button[type='submit']").click();
        """)

        await page.wait_for_url(lambda url: url != url_before)
        return page.url

    async def _save_url(self, url: str, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(url, encoding="utf-8")
