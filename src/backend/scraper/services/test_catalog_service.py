import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, call, patch

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from scraper.services import catalog_service


def test_fetch_catalog_page_success_scenario():
    async def run():
        context_mock = MagicMock()
        page_mock = AsyncMock()
        page_mock.content.return_value = "<html>test content</html>"

        context_mock.new_page = AsyncMock(return_value=page_mock)

        with patch(
            "scraper.services.catalog_service._add_page_param",
            return_value="https://example.com/catalog?page=1",
        ):
            result = await catalog_service.fetch_catalog_page(
                context_mock, "https://example.com/catalog", 1
            )

        context_mock.new_page.assert_called_once()
        page_mock.goto.assert_called_once_with("https://example.com/catalog?page=1")

        assert page_mock.wait_for_load_state.call_count == 2
        page_mock.wait_for_selector.assert_called()

        assert result == "<html>test content</html>"
        page_mock.close.assert_called_once()

    asyncio.run(run())


def test_fetch_catalog_page_partial_wait_failures():
    async def run():
        context_mock = MagicMock()
        page_mock = AsyncMock()
        page_mock.content.return_value = "<html>test content</html>"

        page_mock.wait_for_load_state.side_effect = [
            PlaywrightTimeoutError("timeout"),
            None,
        ]
        page_mock.wait_for_selector.side_effect = [
            PlaywrightTimeoutError("timeout"),
            None,
        ]

        context_mock.new_page = AsyncMock(return_value=page_mock)

        with patch(
            "scraper.services.catalog_service._add_page_param",
            return_value="https://example.com/catalog?page=1",
        ):
            result = await catalog_service.fetch_catalog_page(
                context_mock, "https://example.com/catalog", 1
            )

        assert result == "<html>test content</html>"
        page_mock.close.assert_called_once()

    asyncio.run(run())


def test_fetch_catalog_page_all_wait_failures():
    async def run():
        context_mock = MagicMock()
        page_mock = AsyncMock()
        page_mock.content.return_value = "<html>test content</html>"

        page_mock.wait_for_load_state.side_effect = PlaywrightTimeoutError("timeout")
        page_mock.wait_for_selector.side_effect = PlaywrightTimeoutError("timeout")

        context_mock.new_page = AsyncMock(return_value=page_mock)

        with patch(
            "scraper.services.catalog_service._add_page_param",
            return_value="https://example.com/catalog?page=1",
        ):
            result = await catalog_service.fetch_catalog_page(
                context_mock, "https://example.com/catalog", 1
            )

        assert result == "<html>test content</html>"
        page_mock.close.assert_called_once()

    asyncio.run(run())


def test_fetch_catalog_page_navigation_failure():
    async def run():
        context_mock = MagicMock()
        page_mock = AsyncMock()
        page_mock.goto.side_effect = Exception("Navigation failed")

        context_mock.new_page = AsyncMock(return_value=page_mock)

        with patch(
            "scraper.services.catalog_service._add_page_param",
            return_value="https://example.com/catalog?page=1",
        ):
            try:
                await catalog_service.fetch_catalog_page(
                    context_mock, "https://example.com/catalog", 1
                )
                raise AssertionError("Expected exception was not raised")
            except Exception as e:
                assert str(e) == "Navigation failed"

        page_mock.close.assert_called_once()

    asyncio.run(run())


def test_fetch_catalog_page_page_creation_failure():
    async def run():
        context_mock = MagicMock()
        context_mock.new_page = AsyncMock(side_effect=Exception("Failed to create page"))

        with patch(
            "scraper.services.catalog_service._add_page_param",
            return_value="https://example.com/catalog?page=1",
        ):
            try:
                await catalog_service.fetch_catalog_page(
                    context_mock, "https://example.com/catalog", 1
                )
                raise AssertionError("Expected exception was not raised")
            except Exception as e:
                assert str(e) == "Failed to create page"

    asyncio.run(run())


def test_fetch_catalog_page_cleanup_on_exception():
    async def run():
        context_mock = MagicMock()
        page_mock = AsyncMock()
        page_mock.content.side_effect = Exception("Content extraction failed")

        context_mock.new_page = AsyncMock(return_value=page_mock)

        with patch(
            "scraper.services.catalog_service._add_page_param",
            return_value="https://example.com/catalog?page=1",
        ):
            try:
                await catalog_service.fetch_catalog_page(
                    context_mock, "https://example.com/catalog", 1
                )
                raise AssertionError("Expected exception was not raised")
            except Exception:
                pass

        page_mock.close.assert_called_once()

    asyncio.run(run())


def test_fetch_catalog_page_url_parameter_integration():
    async def run():
        context_mock = MagicMock()
        page_mock = AsyncMock()
        page_mock.content.return_value = "<html>test content</html>"

        context_mock.new_page = AsyncMock(return_value=page_mock)

        with patch("scraper.services.catalog_service._add_page_param") as mock_add_param:
            mock_add_param.return_value = "https://example.com/catalog?page=3"

            await catalog_service.fetch_catalog_page(context_mock, "https://example.com/catalog", 3)

        mock_add_param.assert_called_once_with("https://example.com/catalog", 3)
        page_mock.goto.assert_called_once_with("https://example.com/catalog?page=3")
        page_mock.close.assert_called_once()

    asyncio.run(run())


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
                catalog_url="https://example.com/course/catalog",
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
                catalog_url="https://example.com/course/catalog",
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
