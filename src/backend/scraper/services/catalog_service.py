from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import structlog
from playwright.async_api import BrowserContext
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from ..browser import JSONLWriter, load_existing_ids
from ..parsers.catalog import CatalogParser, CourseLinkParser

logger = structlog.get_logger(__name__)

catalog_parser = CatalogParser()
course_link_parser = CourseLinkParser()


def _add_page_param(url: str, page_num: int) -> str:
    parsed_url = urlparse(url)
    query_params = parse_qs(parsed_url.query)
    query_params["page"] = [str(page_num)]

    new_query = urlencode(query_params, doseq=True)
    return f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}?{new_query}"


async def fetch_catalog_page(context: BrowserContext, catalog_url: str, page_num: int) -> str:
    page = None
    try:
        page = await context.new_page()
        url = _add_page_param(catalog_url, page_num)

        await page.goto(url)
        try:
            await page.wait_for_load_state("domcontentloaded")
        except PlaywrightTimeoutError as exc:
            logger.debug(
                "catalog_page_load_state_timeout", state="domcontentloaded", err=str(exc), url=url
            )
        except PlaywrightError as exc:
            logger.debug(
                "catalog_page_wait_state_error",
                state="domcontentloaded",
                err=str(exc),
                url=url,
            )
        try:
            await page.wait_for_load_state("networkidle")
        except PlaywrightTimeoutError as exc:
            logger.debug(
                "catalog_page_load_state_timeout", state="networkidle", err=str(exc), url=url
            )
        except PlaywrightError as exc:
            logger.debug(
                "catalog_page_wait_state_error",
                state="networkidle",
                err=str(exc),
                url=url,
            )
        try:
            await page.wait_for_selector("#course-catalog-pjax", state="attached", timeout=10000)
        except PlaywrightTimeoutError as exc:
            logger.debug(
                "catalog_page_selector_timeout",
                selector="#course-catalog-pjax",
                err=str(exc),
                url=url,
            )
        except PlaywrightError as exc:
            logger.debug(
                "catalog_page_selector_error",
                selector="#course-catalog-pjax",
                err=str(exc),
                url=url,
            )
        for sel in [
            "ul.pagination",
            "div.panel-heading",
            "div.panel-footer a[href^='/course/']",
        ]:
            try:
                await page.wait_for_selector(sel, state="attached", timeout=5000)
                break
            except PlaywrightTimeoutError as exc:
                logger.debug("catalog_selector_wait_timeout", selector=sel, err=str(exc), url=url)
                continue
            except PlaywrightError as exc:
                logger.debug("catalog_selector_wait_error", selector=sel, err=str(exc), url=url)
                continue
        html = await page.content()
        return html
    finally:
        if page:
            await page.close()


async def collect_catalog_ids(
    context: BrowserContext,
    catalog_url: str,
    start_page: int = 1,
    end_page: int | None = None,
    out_path: Path = Path("state") / "course_ids.jsonl",
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    writer = JSONLWriter(out_path)
    existing = load_existing_ids(out_path)

    parsed_url = urlparse(catalog_url)
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

    if end_page is None:
        html = await fetch_catalog_page(context, catalog_url, start_page)
        _, detected_last = catalog_parser.parse(html, base_url=base_url)
        end_page = detected_last or start_page

    total_ids = 0
    for pnum in range(start_page, end_page + 1):
        html = await fetch_catalog_page(context, catalog_url, pnum)
        ids = course_link_parser.extract_course_ids(html)
        new = 0
        for cid in ids:
            if cid not in existing:
                writer.write({"id": cid})
                existing.add(cid)
                new += 1
        total_ids += new
        logger.info(
            "page_ids_processed",
            page=pnum,
            page_found=len(ids),
            new_added=new,
            total_new=total_ids,
        )

    logger.info(
        "catalog_collection_completed",
        new_ids_collected=total_ids,
        output_file=str(out_path),
        total_unique_ids=len(existing),
        catalog_url=catalog_url,
    )
