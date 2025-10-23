import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from scraper.browser import (
    BrowserManager,
    JSONLWriter,
    load_existing_ids,
    read_ids,
)


def test_jsonl_writer_appends_records(tmp_path: Path):
    output = tmp_path / "data.jsonl"
    writer = JSONLWriter(output)

    writer.write({"id": 1, "name": "first"})
    writer.write({"id": 2, "name": "second"})

    lines = output.read_text(encoding="utf-8").splitlines()
    assert lines == ['{"id": 1, "name": "first"}', '{"id": 2, "name": "second"}']


def test_load_existing_ids_returns_unique_ids(tmp_path: Path):
    source = tmp_path / "items.jsonl"
    source.write_text(
        "\n".join(
            [
                '{"id": 1, "value": "a"}',
                '{"id": 2, "value": "b"}',
                '{"no_id": 3}',
                "not json",
                '{"id": "2"}',
            ]
        ),
        encoding="utf-8",
    )

    ids = load_existing_ids(source)

    assert ids == {"1", "2"}


def test_read_ids_handles_text_files(tmp_path: Path):
    text_file = tmp_path / "ids.txt"
    text_file.write_text("abc\n\n123\n", encoding="utf-8")

    ids = read_ids(text_file)

    assert ids == ["abc", "123"]


def test_read_ids_handles_jsonl(tmp_path: Path):
    jsonl_file = tmp_path / "ids.jsonl"
    jsonl_file.write_text('{"id": "alpha"}\n{"id": "beta"}\n', encoding="utf-8")

    ids = read_ids(jsonl_file)

    assert ids == ["alpha", "beta"]


def test_browser_manager_create_and_close(tmp_path: Path):
    async def run():
        state_path = tmp_path / "state.json"
        manager = BrowserManager("user@example.com", "secret", "https://example.com", state_path)

        with patch("scraper.browser.async_playwright") as mock_async_playwright:
            mock_browser = MagicMock()
            mock_browser.close = AsyncMock()
            playwright = MagicMock()
            playwright.chromium.launch = AsyncMock(return_value=mock_browser)
            playwright.stop = AsyncMock()

            mock_async_playwright.return_value.start = AsyncMock(return_value=playwright)

            browser = await manager.create_browser(headless=False, devtools=True, slowmo=50)

            assert browser is mock_browser
            mock_async_playwright.return_value.start.assert_awaited_once()
            playwright.chromium.launch.assert_awaited_once_with(
                headless=False, devtools=True, slow_mo=50
            )

            await manager.close()

            mock_browser.close.assert_awaited_once()
            playwright.stop.assert_awaited_once()
            assert manager.browser is None
            assert manager.playwright is None

    asyncio.run(run())


def test_browser_manager_close_without_browser():
    async def run():
        manager = BrowserManager(
            "user@example.com", "secret", "https://example.com", Path("/tmp/nonexistent.json")
        )

        await manager.close()  # Should be a no-op without raising

    asyncio.run(run())
