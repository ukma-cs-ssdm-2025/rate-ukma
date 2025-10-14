import asyncio
from pathlib import Path

import structlog
from playwright.async_api import BrowserContext

from ..browser import JSONLWriter, load_existing_ids, read_ids
from ..models import ParsedCourseDetails
from ..parsers.course import parse_course_details

logger = structlog.get_logger(__name__)


async def _parse_one(context: BrowserContext, url: str) -> ParsedCourseDetails:
    page = await context.new_page()
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
        await page.wait_for_selector(
            "table.table.table-condensed.table-bordered, .v-data-table, div.container",
            state="attached",
            timeout=15000,
        )
    except Exception:
        pass
    html = await page.content()
    await page.close()
    data = parse_course_details(html, url)
    return data


async def fetch_details_by_ids(
    context: BrowserContext,
    base_url: str,
    ids_file: Path,
    out_path: Path = Path("state") / "courses.jsonl",
    concurrency: int = 4,
    resume: bool = True,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    writer = JSONLWriter(out_path)
    done_ids: set[str] = load_existing_ids(out_path) if resume else set()
    wanted = read_ids(ids_file)
    if not wanted:
        logger.info("no_ids_found", input_file=str(ids_file))
        return

    sem = asyncio.Semaphore(concurrency)
    total = len(wanted)
    done = 0

    async def worker(cid: str):
        nonlocal done
        if resume and cid in done_ids:
            done += 1
            if done % 10 == 0 or done == total:
                logger.info("progress_skipped", completed=done, total=total)
            return
        url = f"{base_url}/course/{cid}"
        try:
            async with sem:
                data = await _parse_one(context, url)
                rid = str(data.id) if data.id else cid
                data.id = rid
                writer.write(data.model_dump_json_compat())
                done_ids.add(rid)
        except Exception as e:
            logger.exception("failed_to_parse", course_id=cid, url=url, error=str(e))
        finally:
            done += 1
            if done % 10 == 0 or done == total:
                logger.info("progress_updated", completed=done, total=total)

    await asyncio.gather(*(worker(cid) for cid in wanted))
    logger.info(
        "details_fetch_completed", records_processed=len(done_ids), output_path=str(out_path)
    )
