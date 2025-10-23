import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scraper.auth import (
    O365_LINK_SELECTOR,
    PlaywrightTimeoutError,
    check_auth_status,
    login_o365,
    with_authenticated_context,
)


def _setup_async_playwright_mocks(page: MagicMock | None = None):
    page = page or MagicMock()
    page.goto = getattr(page, "goto", AsyncMock())
    page.wait_for_selector = getattr(page, "wait_for_selector", AsyncMock())
    page.click = getattr(page, "click", AsyncMock())
    page.wait_for_url = getattr(page, "wait_for_url", AsyncMock())
    page.close = getattr(page, "close", AsyncMock())

    context = MagicMock()
    context.new_page = AsyncMock(return_value=page)
    context.storage_state = AsyncMock()
    context.close = AsyncMock()

    browser = MagicMock()
    browser.new_context = AsyncMock(return_value=context)
    browser.close = AsyncMock()

    playwright_instance = SimpleNamespace(
        chromium=SimpleNamespace(launch=AsyncMock(return_value=browser))
    )

    manager = MagicMock()
    manager.__aenter__ = AsyncMock(return_value=playwright_instance)
    manager.__aexit__ = AsyncMock(return_value=None)

    return manager, playwright_instance, browser, context, page


def _build_login_page_success(email: str, password: str):
    page = MagicMock()
    page.goto = AsyncMock()
    page.click = AsyncMock()
    page.wait_for_url = AsyncMock()
    page.close = AsyncMock()

    async def wait_for_selector(selector, *args, **kwargs):
        if selector == "div#loginHeader, div#kc-page-title":
            return None
        if selector == "input[type='email']#i0116, input[name='loginfmt']":
            return None
        if selector == "input[type='password']#i0118, input[name='passwd']":
            return None
        if selector == "#idSIButton9":
            return None
        if selector == O365_LINK_SELECTOR:
            return None
        return None

    page.wait_for_selector = AsyncMock(side_effect=wait_for_selector)

    tile_locator = MagicMock()
    tile_locator.count = AsyncMock(return_value=1)

    matching_click = MagicMock()
    matching_click.click = AsyncMock()
    matching_locator = MagicMock()
    matching_locator.count = AsyncMock(return_value=1)
    matching_locator.first = matching_click

    other_locator = MagicMock()
    other_locator.count = AsyncMock(return_value=0)

    email_input = MagicMock()
    email_input.fill = AsyncMock()
    email_locator = MagicMock()
    email_locator.first = email_input

    submit_click = MagicMock()
    submit_click.click = AsyncMock()
    submit_locator = MagicMock()
    submit_locator.first = submit_click

    password_input = MagicMock()
    password_input.fill = AsyncMock()
    password_locator = MagicMock()
    password_locator.first = password_input

    stay_locator = MagicMock()
    stay_locator.click = AsyncMock()

    def locator_side_effect(selector):
        if selector.startswith("div.table"):
            return tile_locator
        if selector == f"text={email}":
            return matching_locator
        if selector == "#otherTile, text=Use another account":
            return other_locator
        if selector == "input[type='email']#i0116, input[name='loginfmt']":
            return email_locator
        if selector == "#idSIButton9, input[type='submit']":
            return submit_locator
        if selector == "input[type='password']#i0118, input[name='passwd']":
            return password_locator
        if selector == "#idSIButton9":
            return stay_locator
        return MagicMock()

    page.locator = MagicMock(side_effect=locator_side_effect)

    watchers = {
        "tiles_count": tile_locator.count,
        "matching_count": matching_locator.count,
        "matching_click": matching_click.click,
        "email_fill": email_input.fill,
        "submit_click": submit_click.click,
        "password_fill": password_input.fill,
        "stay_click": stay_locator.click,
    }

    return page, watchers


def _build_login_page_timeouts():
    page = MagicMock()
    page.goto = AsyncMock()
    page.click = AsyncMock()
    page.wait_for_url = AsyncMock(side_effect=PlaywrightTimeoutError("timeout"))
    page.close = AsyncMock()

    async def wait_for_selector(selector, *args, **kwargs):
        if selector == O365_LINK_SELECTOR:
            return None
        raise PlaywrightTimeoutError(f"not found: {selector}")

    page.wait_for_selector = AsyncMock(side_effect=wait_for_selector)

    tile_locator = MagicMock()
    tile_locator.count = AsyncMock(return_value=0)

    def locator_side_effect(selector):
        if selector.startswith("div.table"):
            return tile_locator
        return MagicMock()

    page.locator = MagicMock(side_effect=locator_side_effect)

    watchers = {"tiles_count": tile_locator.count}
    return page, watchers


def test_login_o365_saves_storage_state(tmp_path: Path):
    async def run():
        email = "user@example.com"
        password = "secret"
        state_path = tmp_path / "state.json"

        page, watchers = _build_login_page_success(email, password)
        manager, _, browser, context, _ = _setup_async_playwright_mocks(page)

        with patch("scraper.auth.async_playwright", return_value=manager):
            result = await login_o365(
                email,
                password,
                "https://example.com/auth/login",
                state_path,
                headless=False,
            )

        assert result == state_path
        page.goto.assert_awaited_once_with("https://example.com/auth/login")
        page.click.assert_awaited_once_with(O365_LINK_SELECTOR)
        assert watchers["tiles_count"].await_count == 1
        assert watchers["matching_count"].await_count == 1
        assert watchers["matching_click"].await_count == 1
        watchers["email_fill"].assert_awaited_once_with(email)
        assert watchers["submit_click"].await_count == 2
        watchers["password_fill"].assert_awaited_once_with(password)
        assert watchers["stay_click"].await_count == 1
        context.storage_state.assert_awaited_once_with(path=str(state_path))
        browser.close.assert_awaited_once()

    asyncio.run(run())


def test_login_o365_handles_redirect_timeout(tmp_path: Path):
    async def run():
        email = "user@example.com"
        password = "secret"
        state_path = tmp_path / "state.json"

        page, watchers = _build_login_page_timeouts()
        manager, _, browser, context, _ = _setup_async_playwright_mocks(page)

        with patch("scraper.auth.async_playwright", return_value=manager):
            result = await login_o365(
                email,
                password,
                "https://example.com/auth/login",
                state_path,
                headless=True,
            )

        assert result == state_path
        page.click.assert_awaited_once_with(O365_LINK_SELECTOR)
        assert watchers["tiles_count"].await_count == 1
        assert page.wait_for_url.await_count == 1
        context.storage_state.assert_awaited_once_with(path=str(state_path))
        browser.close.assert_awaited_once()

    asyncio.run(run())


def test_check_auth_status_returns_true_for_catalog_page():
    async def run():
        context = MagicMock()
        page = MagicMock()
        context.new_page = AsyncMock(return_value=page)
        page.goto = AsyncMock()
        page.close = AsyncMock()
        page.url = "https://example.com/course/catalog"

        result = await check_auth_status(context, "https://example.com")

        assert result is True
        page.goto.assert_awaited_once_with("https://example.com/course/catalog")
        page.close.assert_awaited_once()

    asyncio.run(run())


def test_check_auth_status_returns_false_for_login_page():
    async def run():
        context = MagicMock()
        page = MagicMock()
        context.new_page = AsyncMock(return_value=page)
        page.goto = AsyncMock()
        page.close = AsyncMock()
        page.url = "https://example.com/auth/login"

        result = await check_auth_status(context, "https://example.com")

        assert result is False
        page.close.assert_awaited_once()

    asyncio.run(run())


def test_check_auth_status_handles_errors():
    async def run():
        context = MagicMock()
        page = MagicMock()
        context.new_page = AsyncMock(return_value=page)
        page.goto = AsyncMock(side_effect=RuntimeError("boom"))
        page.close = AsyncMock()

        result = await check_auth_status(context, "https://example.com")

        assert result is False
        page.close.assert_awaited_once()

    asyncio.run(run())


def test_with_authenticated_context_reuses_existing_state(tmp_path: Path):
    async def run():
        state_path = tmp_path / "state.json"
        state_path.write_text("{}")

        manager, _, browser, context, _ = _setup_async_playwright_mocks()

        with (
            patch("scraper.auth.async_playwright", return_value=manager),
            patch("scraper.auth.login_o365", new_callable=AsyncMock) as mock_login,
            patch("scraper.auth.check_auth_status", new_callable=AsyncMock) as mock_check_status,
        ):
            mock_check_status.return_value = True

            decorated = with_authenticated_context(
                "user@example.com", "secret", "https://example.com", state_path, headless=False
            )
            observed = {}

            @decorated
            async def sample(*, context):
                observed["context"] = context

            await sample()

        mock_login.assert_not_called()
        mock_check_status.assert_awaited_once_with(context, "https://example.com")
        assert observed["context"] is context
        browser.close.assert_awaited_once()

    asyncio.run(run())


def test_with_authenticated_context_refreshes_when_check_fails(tmp_path: Path):
    async def run():
        state_path = tmp_path / "state.json"

        manager, _, browser, initial_context, _ = _setup_async_playwright_mocks()
        refreshed_context = MagicMock()
        refreshed_context.close = AsyncMock()
        browser.new_context.side_effect = [initial_context, refreshed_context]

        async def fake_login(*_args, **_kwargs):
            state_path.write_text("{}")
            return state_path

        with (
            patch("scraper.auth.async_playwright", return_value=manager),
            patch("scraper.auth.login_o365", new_callable=AsyncMock) as mock_login,
            patch("scraper.auth.check_auth_status", new_callable=AsyncMock) as mock_check_status,
        ):
            mock_login.side_effect = fake_login
            mock_check_status.side_effect = [False, True]

            decorated = with_authenticated_context(
                "user@example.com", "secret", "https://example.com", state_path, headless=False
            )
            observed = {}

            @decorated
            async def sample(*, context):
                observed["context"] = context

            await sample()

        assert mock_login.await_count == 2
        assert initial_context.close.await_count == 1
        refreshed_context.close.assert_not_called()
        browser.close.assert_awaited_once()
        assert observed["context"] is refreshed_context
        assert state_path.exists()

    asyncio.run(run())


def test_with_authenticated_context_raises_after_double_failure(tmp_path: Path):
    async def run():
        state_path = tmp_path / "state.json"
        state_path.write_text("{}")

        manager, _, browser, initial_context, _ = _setup_async_playwright_mocks()
        refreshed_context = MagicMock()
        refreshed_context.close = AsyncMock()
        browser.new_context.side_effect = [initial_context, refreshed_context]

        async def fake_login(*_args, **_kwargs):
            state_path.write_text("{}")
            return state_path

        with (
            patch("scraper.auth.async_playwright", return_value=manager),
            patch("scraper.auth.login_o365", new_callable=AsyncMock) as mock_login,
            patch("scraper.auth.check_auth_status", new_callable=AsyncMock) as mock_check_status,
        ):
            mock_login.side_effect = fake_login
            mock_check_status.side_effect = [False, False]

            decorated = with_authenticated_context(
                "user@example.com", "secret", "https://example.com", state_path, headless=False
            )

            @decorated
            async def failing_sample(*, context):
                assert context is refreshed_context

            with pytest.raises(RuntimeError, match="Authentication failed"):
                await failing_sample()

        assert mock_login.await_count == 1
        assert initial_context.close.await_count == 1
        refreshed_context.close.assert_not_called()
        assert browser.close.await_count >= 1

    asyncio.run(run())
