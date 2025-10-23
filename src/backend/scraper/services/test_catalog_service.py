import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, call, patch

from scraper.services import catalog_service


def test_collect_catalog_ids_writes_new_ids(tmp_path: Path):
    async def run():
        out_path = tmp_path / "course_ids.jsonl"
        writer = MagicMock()

        fetch_html = AsyncMock(side_effect=["detect-html", "page-1", "page-2"])
        extract_ids = MagicMock(side_effect=[["100", "101"], ["101", "102"]])

        with (
            patch("scraper.services.catalog_service.JSONLWriter", return_value=writer),
            patch(
                "scraper.services.catalog_service.load_existing_ids",
                return_value={"100"},
            ),
            patch("scraper.services.catalog_service.fetch_catalog_page", fetch_html),
            patch.object(
                catalog_service.catalog_parser, "parse", return_value=(None, 2)
            ) as mock_parse,
            patch.object(catalog_service.course_link_parser, "extract_course_ids", extract_ids),
        ):
            await catalog_service.collect_catalog_ids(
                context=MagicMock(),
                base_url="https://example.com",
                start_page=1,
                end_page=None,
                out_path=out_path,
            )

        assert writer.write.call_args_list == [
            call({"id": "101"}),
            call({"id": "102"}),
        ]
        assert fetch_html.await_count == 3  # detection + two pages
        mock_parse.assert_called_once_with("detect-html", base_url="https://example.com")

    asyncio.run(run())


def test_collect_catalog_ids_respects_explicit_end_page(tmp_path: Path):
    async def run():
        out_path = tmp_path / "ids.jsonl"
        writer = MagicMock()

        fetch_html = AsyncMock(side_effect=["page-1", "page-2"])
        extract_ids = MagicMock(side_effect=[["1"], ["2"]])
        context = MagicMock()

        with (
            patch("scraper.services.catalog_service.JSONLWriter", return_value=writer),
            patch("scraper.services.catalog_service.load_existing_ids", return_value=set()),
            patch("scraper.services.catalog_service.fetch_catalog_page", fetch_html),
            patch.object(catalog_service.catalog_parser, "parse") as mock_parse,
            patch.object(catalog_service.course_link_parser, "extract_course_ids", extract_ids),
        ):
            await catalog_service.collect_catalog_ids(
                context=context,
                base_url="https://example.com",
                start_page=3,
                end_page=4,
                out_path=out_path,
            )

        mock_parse.assert_not_called()
        assert writer.write.call_args_list == [call({"id": "1"}), call({"id": "2"})]
        fetch_html.assert_has_awaits(
            [
                call(context, "https://example.com/course/catalog", 3),
                call(context, "https://example.com/course/catalog", 4),
            ],
            any_order=False,
        )

    asyncio.run(run())
