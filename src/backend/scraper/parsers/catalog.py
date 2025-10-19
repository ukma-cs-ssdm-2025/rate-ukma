import re
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup

from .base import BaseParser


class CourseLinkParser(BaseParser):
    def parse(self, html: str, **kwargs) -> list[str]:
        base_url = kwargs.get("base_url", "")
        if not base_url:
            raise ValueError("base_url is required for CourseLinkParser")

        soup = BeautifulSoup(html, "lxml")
        links = []

        for a in soup.select("a[href^='/course/']"):
            href = a.get("href")
            if not href:
                continue
            try:
                path = urlparse(str(href)).path.rstrip("/")
                m = re.match(r"^/course/(\d+)$", path)
                if m:
                    links.append(urljoin(base_url, path))
            except Exception:
                continue

        return links

    def extract_course_ids(self, html: str) -> list[str]:
        soup = BeautifulSoup(html, "lxml")
        ids: list[str] = []

        for a in soup.select("a[href^='/course/']"):
            href = a.get("href")
            if not href:
                continue
            try:
                path = urlparse(str(href)).path.rstrip("/")
                m = re.match(r"^/course/(\d+)$", path)
                if m:
                    ids.append(m.group(1))
            except Exception:
                continue

        seen = set()
        out: list[str] = []
        for cid in ids:
            if cid not in seen:
                seen.add(cid)
                out.append(cid)
        return out


class CatalogParser(BaseParser):
    def __init__(self):
        self.course_link_parser = CourseLinkParser()

    def parse(self, html: str, **kwargs) -> tuple[list[str], int | None]:
        base_url = kwargs.get("base_url", "")
        if not base_url:
            raise ValueError("base_url is required for CatalogParser")

        links = self.course_link_parser.parse(html, base_url=base_url)
        last_page = self._extract_last_page(html)
        return links, last_page

    def _extract_last_page(self, html: str) -> int | None:
        soup = BeautifulSoup(html, "lxml")
        last_page = None

        pag = soup.select_one("ul.pagination")
        if pag:
            last_a = pag.select_one("li.last a")
            if last_a:
                try:
                    href = last_a.get("href", "")
                    if href:
                        q = parse_qs(urlparse(str(href)).query)
                        if "page" in q:
                            last_page = int(q["page"][0])
                except Exception:
                    pass
                if last_page is None:
                    try:
                        dp = last_a.get("data-page")
                        if dp and str(dp).isdigit():
                            last_page = int(str(dp)) + 1
                    except Exception:
                        pass
            if last_page is None:
                nums = []
                for a in pag.select("li a"):
                    t = a.text.strip()
                    if t.isdigit():
                        nums.append(int(t))
                    dp = a.get("data-page")
                    if dp and str(dp).isdigit():
                        nums.append(int(str(dp)) + 1)
                if nums:
                    last_page = max(nums)

        return last_page


def parse_catalog_page(base_url: str, html: str) -> tuple[list[str], int | None]:
    soup = BeautifulSoup(html, "lxml")

    links = []
    for a in soup.select("a[href^='/course/']"):
        href = a.get("href")
        if not href:
            continue
        try:
            path = urlparse(str(href)).path.rstrip("/")
            m = re.match(r"^/course/(\d+)$", path)
            if m:
                links.append(urljoin(base_url, path))
        except Exception:
            continue

    last_page = None
    pag = soup.select_one("ul.pagination")
    if pag:
        last_a = pag.select_one("li.last a")
        if last_a:
            try:
                href = last_a.get("href", "")
                if href:
                    q = parse_qs(urlparse(str(href)).query)
                    if "page" in q:
                        last_page = int(q["page"][0])
            except Exception:
                pass
            if last_page is None:
                try:
                    dp = last_a.get("data-page")
                    if dp and str(dp).isdigit():
                        last_page = int(str(dp)) + 1
                except Exception:
                    pass
        if last_page is None:
            nums = []
            for a in pag.select("li a"):
                t = a.text.strip()
                if t.isdigit():
                    nums.append(int(t))
                dp = a.get("data-page")
                if dp and str(dp).isdigit():
                    nums.append(int(str(dp)) + 1)
            if nums:
                last_page = max(nums)

    return links, last_page


def extract_course_ids(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    ids: list[str] = []
    for a in soup.select("a[href^='/course/']"):
        href = a.get("href")
        if not href:
            continue
        try:
            path = urlparse(str(href)).path.rstrip("/")
            m = re.match(r"^/course/(\d+)$", path)
            if m:
                ids.append(m.group(1))
        except Exception:
            continue
    seen = set()
    out: list[str] = []
    for cid in ids:
        if cid not in seen:
            seen.add(cid)
            out.append(cid)
    return out
