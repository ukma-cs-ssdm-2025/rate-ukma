from pathlib import Path

import structlog
from playwright.async_api import BrowserContext

from ..browser import JSONLWriter, load_existing_ids
from ..parsers.catalog import extract_course_ids, parse_catalog_page

logger = structlog.get_logger(__name__)


async def fetch_catalog_page(context: BrowserContext, catalog_url: str, page_num: int) -> str:
    page = await context.new_page()
    url = f"{catalog_url}?page={page_num}"
    await page.goto(url)
    try:
        await page.wait_for_load_state("domcontentloaded")
    except Exception:
        pass
    try:
        await page.wait_for_load_state("networkidle")
    except Exception:
        pass
    try:
        await page.wait_for_selector("#course-catalog-pjax", state="attached", timeout=10000)
    except Exception:
        pass
    for sel in [
        "ul.pagination",
        "div.panel-heading",
        "div.panel-footer a[href^='/course/']",
    ]:
        try:
            await page.wait_for_selector(sel, state="attached", timeout=5000)
            break
        except Exception:
            continue
    html = await page.content()
    await page.close()
    return html


async def collect_catalog_ids(
    context: BrowserContext,
    base_url: str,
    start_page: int = 1,
    end_page: int | None = None,
    out_path: Path = Path("state") / "course_ids.jsonl",
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    writer = JSONLWriter(out_path)
    existing = load_existing_ids(out_path)
    catalog_url = f"{base_url}/course/catalog"

    if end_page is None:
        html = await fetch_catalog_page(context, catalog_url, start_page)
        _, detected_last = parse_catalog_page(base_url, html)
        end_page = detected_last or start_page

    total_ids = 0
    for pnum in range(start_page, end_page + 1):
        html = await fetch_catalog_page(context, catalog_url, pnum)
        ids = extract_course_ids(html)
        new = 0
        for cid in ids:
            if cid not in existing:
                writer.write({"id": cid})
                existing.add(cid)
                new += 1
        logger.info("page_ids_processed", page=pnum, total_found=len(ids), new_added=new)
        total_ids += new

    logger.info(
        "catalog_collection_completed",
        new_ids_collected=total_ids,
        output_file=str(out_path),
        total_unique_ids=len(existing),
    )
