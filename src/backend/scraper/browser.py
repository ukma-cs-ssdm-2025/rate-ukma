import json
from pathlib import Path

import structlog
from filelock import FileLock
from playwright.async_api import Browser, async_playwright

logger = structlog.get_logger(__name__)


class JSONLWriter:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = FileLock(str(self.path) + ".lock")

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_val, _exc_tb):
        return None

    def write(self, record: dict) -> None:
        with self.lock:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_existing_ids(path: Path, id_key: str = "id") -> set[str]:
    ids: set[str] = set()
    if not path.exists():
        return ids
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if id_key in obj:
                    ids.add(str(obj[id_key]))
            except Exception:
                continue
    return ids


def read_ids(path: Path, id_key: str = "id") -> list[str]:
    out: list[str] = []
    if not path.exists():
        return out
    if path.suffix.lower() == ".txt":
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if s:
                    out.append(s)
        return out
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if id_key in obj:
                    out.append(str(obj[id_key]))
            except Exception:
                continue
    return out


class BrowserManager:
    def __init__(self, email: str, password: str, base_url: str, state_path: Path):
        self.email = email
        self.password = password
        self.base_url = base_url
        self.state_path = state_path
        self.browser: Browser | None = None
        self.playwright = None

    async def create_browser(
        self, headless: bool = True, devtools: bool = False, slowmo: int | None = None
    ) -> Browser:
        if self.playwright is None:
            self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless, devtools=devtools, slow_mo=slowmo
        )
        return self.browser

    async def close(self):
        if self.browser:
            await self.browser.close()
            self.browser = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
