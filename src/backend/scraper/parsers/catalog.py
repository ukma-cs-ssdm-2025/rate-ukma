import logging
import re
from urllib.parse import parse_qs, urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from .base import BaseParser

COURSE_LINK_SELECTOR = "a[href^='/course/']"
COURSE_PATH_PATTERN = re.compile(r"^/course/(\d+)$")
logger = logging.getLogger(__name__)


class CourseLinkParser(BaseParser):
    def parse(self, html: str, base_url: str) -> list[str]:
        if not html or not isinstance(html, str):
            logger.warning("Invalid HTML input provided to parse method")
            return []
        if not base_url or not isinstance(base_url, str):
            logger.warning("Invalid base_url provided to parse method")
            return []

        soup = BeautifulSoup(html, "lxml")
        links = []

        for a in soup.select(COURSE_LINK_SELECTOR):
            href = a.get("href")
            if not href or not isinstance(href, str):
                continue

            try:
                href_str = str(href).strip()
                if not href_str:
                    continue

                parsed_url = urlparse(href_str)
                if not parsed_url.path:
                    continue

                path = parsed_url.path.rstrip("/")
                if not path:
                    continue

                match = COURSE_PATH_PATTERN.match(path)
                if match:
                    full_url = urljoin(base_url, path)
                    links.append(full_url)

            except (ValueError, TypeError) as e:
                logger.debug(f"Failed to parse href '{href}': {e}")
                continue
            except Exception as e:
                logger.warning(f"Unexpected error processing href '{href}': {e}")
                continue

        return links

    def extract_course_ids(self, html: str) -> list[str]:
        soup = BeautifulSoup(html, "lxml")
        ids: list[str] = []

        for a in soup.select(COURSE_LINK_SELECTOR):
            href = a.get("href")
            if not href or not isinstance(href, str):
                continue

            try:
                href_str = str(href).strip()
                if not href_str:
                    continue

                parsed_url = urlparse(href_str)
                if not parsed_url.path:
                    continue

                path = parsed_url.path.rstrip("/")
                if not path:
                    continue

                match = COURSE_PATH_PATTERN.match(path)
                if match and match.group(1):
                    course_id = match.group(1)
                    ids.append(course_id)

            except (ValueError, TypeError) as e:
                logger.debug(f"Failed to parse href '{href}' for ID extraction: {e}")
                continue
            except Exception as e:
                logger.warning(f"Unexpected error extracting course ID from href '{href}': {e}")
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
        try:
            href = element.get("href", "")
            if not href:
                return None
            q = parse_qs(urlparse(str(href)).query)
            if "page" in q:
                return int(q["page"][0])
        except Exception:
            pass
        return None

    def _extract_from_data_attribute(self, element: Tag) -> int | None:
        try:
            dp = element.get("data-page")
            if dp and str(dp).isdigit():
                return int(str(dp)) + 1
        except Exception:
            pass
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
