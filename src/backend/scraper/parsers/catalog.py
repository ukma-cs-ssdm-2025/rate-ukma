import logging
import re
from collections.abc import Iterator
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from .base import BaseParser

COURSE_LINK_SELECTOR = "a[href^='/course/']"
COURSE_PATH_PATTERN = re.compile(r"^/course/(\d+)$")
logger = logging.getLogger(__name__)


class CourseLinkParser(BaseParser):
    def parse(self, html: str, base_url: str) -> list[str]:
        if not base_url or not isinstance(base_url, str):
            logger.warning("Invalid base_url provided to parse method")
            return []

        links = []
        for match in self._iter_course_matches(html):
            links.append(urljoin(base_url, match.group(0)))
        return links

    def extract_course_ids(self, html: str) -> list[str]:
        ids = set()
        for match in self._iter_course_matches(html):
            if match.group(1):
                ids.add(match.group(1))

        return list(ids)

    def _iter_course_matches(self, html: str) -> Iterator[re.Match]:
        if not html or not isinstance(html, str):
            logger.warning("Invalid HTML input provided to _iter_course_matches")
            return

        soup = BeautifulSoup(html, "lxml")

        for a_tag in soup.select(COURSE_LINK_SELECTOR):
            href = a_tag.get("href")
            if isinstance(href, str):
                match = self._get_match_from_href(href)
                if match:
                    yield match

    def _get_match_from_href(self, href: str) -> re.Match | None:
        try:
            href_str = str(href).strip()
            if not href_str:
                return None

            parsed_url = urlparse(href_str)
            if not parsed_url.path:
                return None

            path = parsed_url.path.rstrip("/")
            if not path:
                return None

            return COURSE_PATH_PATTERN.match(path)

        except (ValueError, TypeError) as e:
            logger.debug(f"Failed to parse href '{href}': {e}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected error processing href '{href}': {e}")
            return None


class CatalogParser(BaseParser):
    def __init__(self):
        self.course_link_parser = CourseLinkParser()

    def parse(self, html: str, base_url: str) -> tuple[list[str], int | None]:
        links = self.course_link_parser.parse(html, base_url)
        last_page = self._extract_last_page(html)
        return links, last_page

    def _extract_last_page(self, html: str) -> int | None:
        soup = BeautifulSoup(html, "lxml")
        pag = soup.select_one("ul.pagination")
        if not pag:
            return None

        last_page = self._try_extract_from_last_link(pag)
        if last_page is not None:
            return last_page

        return self._extract_from_pagination_links(pag)

    def _try_extract_from_last_link(self, pag: Tag) -> int | None:
        last_a = pag.select_one("li.last a")
        if not last_a:
            return None

        last_page = self._extract_from_href(last_a)
        if last_page is not None:
            return last_page

        return self._extract_from_data_attribute(last_a)

    def _extract_from_href(self, element: Tag) -> int | None:
        href = element.get("href", "")
        if not href:
            return None

        try:
            q = parse_qs(urlparse(str(href)).query)
            if "page" in q:
                return int(q["page"][0])
        except (ValueError, TypeError) as exc:
            logger.debug("Failed to extract page number from pagination href", err=exc)
        return None

    def _extract_from_data_attribute(self, element: Tag) -> int | None:
        dp = element.get("data-page")
        if not dp:
            return None

        dp_str = str(dp)
        if not dp_str.isdigit():
            return None

        try:
            return int(dp_str) + 1
        except ValueError as exc:
            logger.debug("Invalid pagination data-page value", data_page=dp_str, err=exc)
            return None

    def _extract_from_pagination_links(self, pag: Tag) -> int | None:
        nums = []
        for a in pag.select("li a"):
            page_num = self._get_page_number_from_link(a)
            if page_num is not None:
                nums.append(page_num)
        return max(nums) if nums else None

    def _get_page_number_from_link(self, link: Tag) -> int | None:
        t = link.text.strip()
        if t.isdigit():
            return int(t)

        dp = link.get("data-page")
        if dp and str(dp).isdigit():
            return int(str(dp)) + 1

        return None


def parse_catalog_page(base_url: str, html: str) -> tuple[list[str], int | None]:
    parser = CatalogParser()
    return parser.parse(html, base_url)


def extract_course_ids(html: str) -> list[str]:
    parser = CourseLinkParser()
    return parser.extract_course_ids(html)
