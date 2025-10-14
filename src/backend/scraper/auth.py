import re
from functools import wraps
from pathlib import Path

import structlog
from playwright.async_api import BrowserContext, Page, async_playwright
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

logger = structlog.get_logger(__name__)

O365_LINK_SELECTOR = "a[href='/auth/o365']"


async def _handle_ms_login(page: Page, email: str, password: str) -> None:
    logger.info("handling_ms_login", email=email)

    try:
        await page.wait_for_selector("div#loginHeader, div#kc-page-title", timeout=2000)
        logger.debug("login_page_detected")
    except PlaywrightTimeoutError:
        logger.debug("login_page_not_detected")
        pass

    tiles = page.locator("div.table[role='listbox'] div[role='button'], div.accountTile")
    tile_count = await tiles.count()
    if tile_count > 0:
        logger.debug("account_tiles_found", count=tile_count)
        matching = page.locator(f"text={email}")
        if await matching.count() > 0:
            logger.info("clicking_matching_account", email=email)
            await matching.first.click()
        else:
            other = page.locator("#otherTile, text=Use another account")
            if await other.count() > 0:
                logger.info("clicking_use_another_account")
                await other.first.click()

    try:
        await page.wait_for_selector(
            "input[type='email']#i0116, input[name='loginfmt']", timeout=5000
        )
        logger.debug("email_input_field_found")
        email_input = page.locator("input[type='email']#i0116, input[name='loginfmt']").first
        await email_input.fill(email)
        logger.info("email_filled", email=email)
        await page.locator("#idSIButton9, input[type='submit']").first.click()
        logger.debug("email_form_submitted")
    except PlaywrightTimeoutError:
        logger.debug("email_input_not_found")
        pass

    try:
        await page.wait_for_selector(
            "input[type='password']#i0118, input[name='passwd']", timeout=8000
        )
        logger.debug("password_input_field_found")
        pwd_input = page.locator("input[type='password']#i0118, input[name='passwd']").first
        await pwd_input.fill(password)
        logger.info("password_filled")
        await page.locator("#idSIButton9, input[type='submit']").first.click()
        logger.debug("password_form_submitted")
    except PlaywrightTimeoutError:
        logger.debug("password_input_not_found")
        pass

    try:
        await page.wait_for_selector("#idSIButton9", timeout=8000)
        logger.debug("stay_signed_in_prompt_found")
        await page.locator("#idSIButton9").click()
        logger.info("clicked_stay_signed_in")
    except PlaywrightTimeoutError:
        logger.debug("stay_signed_in_prompt_not_found")
        pass


async def login_o365(
    email: str, password: str, login_url: str, state_path: Path, headless: bool = True
) -> Path:
    state_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info("starting_o365_login", login_url=login_url, headless=headless)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto(login_url)
        logger.debug("navigated_to_login_page")
        await page.wait_for_selector(O365_LINK_SELECTOR)
        await page.click(O365_LINK_SELECTOR)
        logger.info("clicked_o365_link")

        await _handle_ms_login(page, email, password)

        try:
            await page.wait_for_url(re.compile(r"my\.ukma\.edu\.ua"), timeout=120000)
            logger.info("successfully_redirected_to_caz")
        except PlaywrightTimeoutError:
            logger.warning("redirect_timeout", message="Timeout waiting for CAZ redirect")
            pass

        await context.storage_state(path=str(state_path))
        logger.info("storage_state_saved", path=str(state_path))
        await browser.close()

    return state_path


async def check_auth_status(context: BrowserContext, base_url: str) -> bool:
    page = await context.new_page()
    try:
        await page.goto(f"{base_url}/course/catalog")
        current_url = page.url
        await page.close()
        return not ("/auth/login" in current_url or "login.microsoftonline" in current_url)
    except Exception:
        await page.close()
        return False


def with_authenticated_context(
    email: str,
    password: str,
    base_url: str,
    state_path: Path,
    headless: bool = True,
    devtools: bool = False,
    slowmo: int | None = None,
):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=headless, devtools=devtools, slow_mo=slowmo
                )

                if state_path.exists():
                    logger.info("reusing_existing_storage_state", path=str(state_path))
                    context = await browser.new_context(storage_state=str(state_path))
                else:
                    logger.info("no_storage_state_found", path=str(state_path))
                    login_url = f"{base_url}/auth/login"
                    await login_o365(email, password, login_url, state_path, headless)
                    context = await browser.new_context(storage_state=str(state_path))

                if not await check_auth_status(context, base_url):
                    await browser.close()
                    raise RuntimeError("Authentication failed")

                try:
                    kwargs["context"] = context
                    result = await func(*args, **kwargs)
                    return result
                finally:
                    await browser.close()

        return wrapper

    return decorator
