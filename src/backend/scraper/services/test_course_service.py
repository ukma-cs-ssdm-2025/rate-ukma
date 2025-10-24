import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, call, patch

from scraper.models.parsed import ParsedCourseDetails
from scraper.services import course_service


def test_fetch_details_by_ids_respects_resume(tmp_path: Path):
    async def run():
        ids_file = tmp_path / "ids.txt"
        out_path = tmp_path / "out.jsonl"
        writer = MagicMock()
        context = MagicMock()

        with (
            patch("scraper.services.course_service.JSONLWriter", return_value=writer),
            patch("scraper.services.course_service.load_existing_ids", return_value={"10"}),
            patch("scraper.services.course_service.read_ids", return_value=["10", "20"]),
            patch(
                "scraper.services.course_service._parse_one", new_callable=AsyncMock
            ) as mock_parse,
        ):
            mock_parse.return_value = ParsedCourseDetails(id="20", title="Course 20")

            await course_service.fetch_details_by_ids(
                context=context,
                base_url="https://example.com",
                ids_file=ids_file,
                out_path=out_path,
                concurrency=2,
                resume=True,
            )

        mock_parse.assert_awaited_once_with(context, "https://example.com/course/20")
        assert writer.write.call_args_list == [call({"id": "20", "title": "Course 20"})]

    asyncio.run(run())


def test_fetch_details_by_ids_assigns_missing_id(tmp_path: Path):
    async def run():
        ids_file = tmp_path / "ids.txt"
        out_path = tmp_path / "out.jsonl"
        writer = MagicMock()
        context = MagicMock()

        with (
            patch("scraper.services.course_service.JSONLWriter", return_value=writer),
            patch("scraper.services.course_service.load_existing_ids", return_value=set()),
            patch("scraper.services.course_service.read_ids", return_value=["abc"]),
            patch(
                "scraper.services.course_service._parse_one", new_callable=AsyncMock
            ) as mock_parse,
        ):
            mock_parse.return_value = ParsedCourseDetails(id=None, title="No ID")

            await course_service.fetch_details_by_ids(
                context=context,
                base_url="https://example.com",
                ids_file=ids_file,
                out_path=out_path,
                concurrency=1,
                resume=False,
            )

        mock_parse.assert_awaited_once_with(context, "https://example.com/course/abc")
        assert writer.write.call_args_list == [call({"title": "No ID", "id": "abc"})]

    asyncio.run(run())


def test_fetch_details_by_ids_returns_when_no_ids(tmp_path: Path):
    async def run():
        ids_file = tmp_path / "ids.txt"
        out_path = tmp_path / "out.jsonl"
        writer = MagicMock()

        with (
            patch("scraper.services.course_service.JSONLWriter", return_value=writer),
            patch("scraper.services.course_service.load_existing_ids", return_value=set()),
            patch("scraper.services.course_service.read_ids", return_value=[]),
            patch(
                "scraper.services.course_service._parse_one", new_callable=AsyncMock
            ) as mock_parse,
        ):
            await course_service.fetch_details_by_ids(
                context=MagicMock(),
                base_url="https://example.com",
                ids_file=ids_file,
                out_path=out_path,
                concurrency=1,
                resume=True,
            )

        mock_parse.assert_not_called()
        writer.write.assert_not_called()

    asyncio.run(run())
