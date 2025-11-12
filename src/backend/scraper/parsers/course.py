import re
from typing import Any

from bs4 import BeautifulSoup

from ..models import Enrollment, Limits, ParsedCourseDetails, SpecialtyEntry, StudentRow
from .base import BaseParser


class ParserUtils:
    @staticmethod
    def clean_text(s) -> str:
        if s is None:
            return ""
        text = str(s)
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def parse_int(s: str | None) -> int | None:
        if not s:
            return None
        try:
            digits = re.findall(r"\d+", s)
            return int(digits[0]) if digits else None
        except (ValueError, IndexError):
            return None

    @staticmethod
    def parse_float(s: str | None) -> float | None:
        if not s:
            return None
        try:
            m = re.search(r"\d+[\.,]?\d*", s)
            if not m:
                return None
            val = m.group(0).replace(",", ".")
            n = float(val)
            return n
        except ValueError:
            return None


class SpecialtyParser(BaseParser):
    def parse(self, html: str, **kwargs) -> list[SpecialtyEntry]:
        return self._parse_specialties(BeautifulSoup(html, "lxml"))

    def _parse_specialties(self, root) -> list[SpecialtyEntry]:
        res: list[SpecialtyEntry] = []
        table = root.select_one("div[id*='--spec'] table")
        if not table:
            return res
        for tr in table.select("tbody tr"):
            tds = tr.find_all("td")
            if len(tds) >= 2:
                res.append(
                    SpecialtyEntry(
                        specialty=ParserUtils.clean_text(tds[0].get_text(" ")),
                        type=ParserUtils.clean_text(tds[1].get_text(" ")),
                    )
                )
        return res


class EnrollmentParser(BaseParser):
    def parse(self, html: str, **kwargs) -> Enrollment:
        return self._parse_enrollment(BeautifulSoup(html, "lxml"))

    def parse_limits(self, html: str, **kwargs) -> Limits:
        return self._parse_limits(BeautifulSoup(html, "lxml"))

    def _parse_limits(self, section) -> Limits:
        limits_data = {}
        for tr in section.select("tr"):
            th = ParserUtils.clean_text(tr.find("th").get_text(" ")) if tr.find("th") else ""
            td = ParserUtils.clean_text(tr.find("td").get_text(" ")) if tr.find("td") else ""
            if "Максимальна кількість студентів" in th:
                limits_data["max_students"] = ParserUtils.parse_int(td)
            elif "Максимальна кількість груп" in th:
                limits_data["max_groups"] = ParserUtils.parse_int(td)
            elif "Кількість студентів в групі" in th:
                m = re.search(r"від\s*(\d+).*до\s*(\d+)", td)
                if m:
                    limits_data["group_size_min"] = int(m.group(1))
                    limits_data["group_size_max"] = int(m.group(2))
            elif "Обрахована максимальна кількість студентів" in th:
                limits_data["computed_max_students"] = ParserUtils.parse_int(td)
        return Limits(**limits_data)

    def _parse_enrollment(self, section) -> Enrollment:
        enrollment_data = {}
        for tr in section.select("tr"):
            th = ParserUtils.clean_text(tr.find("th").get_text(" ")) if tr.find("th") else ""
            td = tr.find("td")
            td_text = ParserUtils.clean_text(td.get_text(" ")) if td else ""
            if "Кількість вільних місць" in th:
                enrollment_data["free_places"] = td_text
            elif "Загальна кількість записаних чинних студентів" in th:
                enrollment_data["enrolled_active"] = ParserUtils.parse_int(td_text)
            elif "Кількість чинних студентів у затверджених групах" in th:
                enrollment_data["approved_enrolled"] = ParserUtils.parse_int(td_text)
            elif "Кількість затверджених груп" in th:
                enrollment_data["approved_groups"] = ParserUtils.parse_int(td_text)
            elif "Можна добрати студентів в групи" in th:
                enrollment_data["can_add_students_to_groups"] = ParserUtils.parse_int(td_text)
        return Enrollment(**enrollment_data)


class StudentsParser(BaseParser):
    def parse(self, html: str, **kwargs) -> list[StudentRow]:
        return self._parse_students_table(BeautifulSoup(html, "lxml"))

    def _parse_students_table(self, root) -> list[StudentRow]:
        res: list[StudentRow] = []

        table_tag = self._find_students_table(root)
        if table_tag:
            self._parse_table_rows(table_tag, res)
        else:
            self._parse_fallback_rows(root, res)

        return res

    def _find_students_table(self, root):
        for cap in root.find_all("caption"):
            if "Перелік студентів" in ParserUtils.clean_text(cap.get_text()):
                return cap.find_parent("table")
        return None

    def _parse_table_rows(self, table_tag, res: list[StudentRow]):
        tbody = table_tag.find("tbody")
        if tbody:
            for tr in tbody.find_all("tr"):
                tds = tr.find_all("td")
                self._append_row(tds, res)

    def _parse_fallback_rows(self, root, res: list[StudentRow]):
        for tr in root.select("tr.course-student-list-row"):
            tds = tr.find_all("td")
            self._append_row(tds, res)

    def _append_row(self, tds, res: list[StudentRow]):
        n = len(tds)
        if n == 0:
            return
        if n >= 9:
            res.append(
                StudentRow(
                    index=ParserUtils.clean_text(tds[0].get_text(" ")),
                    name=ParserUtils.clean_text(tds[1].get_text(" ")),
                    course=ParserUtils.clean_text(tds[2].get_text(" ")),
                    specialty=ParserUtils.clean_text(tds[3].get_text(" ")),
                    type=ParserUtils.clean_text(tds[4].get_text(" ")),
                    time=ParserUtils.clean_text(tds[5].get_text(" ")),
                    status=ParserUtils.clean_text(tds[6].get_text(" ")),
                    group=ParserUtils.clean_text(tds[7].get_text(" ")),
                    email=ParserUtils.clean_text(tds[8].get_text(" ")),
                )
            )
        elif n >= 2:
            res.append(
                StudentRow(
                    index=ParserUtils.clean_text(tds[0].get_text(" ")),
                    name=ParserUtils.clean_text(tds[1].get_text(" ")),
                )
            )
        elif n == 1:
            res.append(
                StudentRow(
                    index=ParserUtils.clean_text(tds[0].get_text(" ")),
                    name="",
                )
            )


class CourseDetailParser(BaseParser):
    LABEL_SELECTOR = "span.label"

    FIELD_MAPPINGS = {
        "Код курсу": "id",
        "Код": "id",
        "Факультет": "faculty",
        "Кафедра": "department",
        "Освітній рівень": "education_level",
        "Навчальний рік": "academic_year",
        "Викладач": "teachers",
    }

    def __init__(self):
        self.specialty_parser = SpecialtyParser()
        self.enrollment_parser = EnrollmentParser()
        self.students_parser = StudentsParser()

    def parse(self, html: str, url: str | None = None, **kwargs) -> ParsedCourseDetails:
        if url is None:
            url = kwargs.get("url", "") or ""
        return self._parse_course_details(html, url)

    def _parse_course_header(self, soup) -> str:
        h1 = soup.select_one(".page-header h1")
        if h1:
            direct_text = "".join(h1.find_all(string=True, recursive=False))
            return ParserUtils.clean_text(direct_text)
        return ""

    def _parse_basic_course_info(self, tbody) -> dict[str, Any]:
        data: dict[str, Any] = {}

        for tr in tbody.find_all("tr", recursive=False):
            th = tr.find("th")
            td = tr.find("td")
            if not (th and td):
                continue

            key = ParserUtils.clean_text(th.get("title") or th.get_text(" "))

            if key == "Інформація":
                data.update(self._parse_info_labels(td))
                continue

            for field_pattern, data_key in self.FIELD_MAPPINGS.items():
                if field_pattern in key:
                    data[data_key] = ParserUtils.clean_text(td.get_text(" "))
                    break

        data["annotation"] = self._parse_annotation(tbody)
        data["specialties"] = self.specialty_parser._parse_specialties(tbody)
        return data

    def _is_semester_block(self, rows) -> bool:
        seasons = {"Весна", "Осінь", "Літо"}
        return any(
            ParserUtils.clean_text(tr.find("th").get_text(" ")) in {"Семестри", *seasons}
            for tr in rows
            if tr.find("th")
        )

    def _parse_season_details(self, td) -> dict[str, Any]:
        season_parsers = {
            "кред": lambda text: ("credits", ParserUtils.parse_float(text)),
            "год./тиж": lambda text: ("hours_per_week", ParserUtils.parse_int(text)),
            "лекц": lambda text: ("lecture_hours", ParserUtils.parse_int(text)),
            "практ": lambda text: ("practice_type", "PRACTICE"),
            "сем.": lambda text: ("practice_type", "SEMINAR"),
        }

        details = {}
        for span in td.select(self.LABEL_SELECTOR):
            text = ParserUtils.clean_text(span.get_text(" "))

            if "практ" in text:
                details["practice_type"] = "PRACTICE"
                details["practice_hours"] = ParserUtils.parse_int(text)
            elif "сем." in text:
                details["practice_type"] = "SEMINAR"
                details["practice_hours"] = ParserUtils.parse_int(text)
            elif "екзам" in text or "залік" in text:
                details["exam_type"] = text
            else:
                for keyword, parser in season_parsers.items():
                    if keyword in text:
                        key, value = parser(text)
                        details[key] = value
                        break
                else:
                    details.setdefault("other", []).append(text)

        return details

    def _parse_semester_block(self, rows, data: dict[str, Any]) -> bool:
        seasons = {"Весна", "Осінь", "Літо"}

        for tr in rows:
            th = tr.find("th")
            td = tr.find("td")
            if not (th and td):
                continue

            key = ParserUtils.clean_text(th.get_text(" "))

            if key == "Семестри":
                data["semesters"] = [
                    ParserUtils.clean_text(s.get_text(" ")) for s in td.select(self.LABEL_SELECTOR)
                ]
                continue

            if key in seasons:
                details = self._parse_season_details(td)
                if details:
                    data.setdefault("season_details", {})[key] = details

        return True

    def _parse_tbody_content(self, tbody, data: dict[str, Any]) -> None:
        rows = tbody.select("tr")

        if self._is_semester_block(rows):
            self._parse_semester_block(rows, data)
            return

        if self._tbody_has(tbody, "Встановлені ліміти"):
            data["limits"] = self.enrollment_parser._parse_limits(tbody)
            return

        if self._tbody_has(tbody, "Інформація про запис"):
            data["enrollment"] = self.enrollment_parser._parse_enrollment(tbody)

    def _tbody_has(self, tbody, text: str) -> bool:
        return tbody.find(string=lambda s: isinstance(s, str) and text in s) is not None

    def _parse_course_details(self, html: str, url: str) -> ParsedCourseDetails:
        soup = BeautifulSoup(html, "lxml")

        data: dict[str, Any] = {
            "url": url,
            "title": self._parse_course_header(soup),
        }

        table = soup.select_one("table.table.table-condensed.table-bordered")
        if table:
            tbodies = table.find_all("tbody")
            if tbodies:
                basic_info = self._parse_basic_course_info(tbodies[0])
                data.update(basic_info)

                for tbody in tbodies[1:]:
                    self._parse_tbody_content(tbody, data)

        data["students"] = self.students_parser._parse_students_table(soup)
        return ParsedCourseDetails(**data)

    def _parse_info_labels(self, td) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for span in td.select(self.LABEL_SELECTOR):
            text = ParserUtils.clean_text(span.get_text(" "))
            if "кред" in text:
                out["credits"] = ParserUtils.parse_float(text)
            elif "год." in text:
                out["hours"] = ParserUtils.parse_int(text)
            elif "рік" in text:
                out["year"] = ParserUtils.parse_int(text)
            elif "Формат" in text:
                out["format"] = text.replace("Формат", "").strip()
            elif "Курс" in text:
                out["status"] = text
            else:
                out.setdefault("other", []).append(text)
        return out

    def _parse_annotation(self, root) -> str | None:
        div = root.select_one("div[id*='--info']")
        if not div:
            return None
        return ParserUtils.clean_text(div.get_text(" "))
