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
        except Exception:
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
        except Exception:
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
        table_tag = None
        for cap in root.find_all("caption"):
            if "Перелік студентів" in cap.get_text():
                table_tag = cap.find_parent("table")
                break
        if table_tag:
            tbody = table_tag.find("tbody")
            if tbody:
                for tr in tbody.find_all("tr"):
                    tds = tr.find_all("td")
                    if len(tds) >= 1:
                        vals = [ParserUtils.clean_text(td.get_text(" ")) for td in tds]
                        res.append(
                            StudentRow(
                                index=vals[0] if vals else "",
                                name=vals[1] if len(vals) > 1 else "",
                            )
                        )
            return res

        rows = root.select("tr.course-student-list-row")
        for tr in rows:
            tds = tr.find_all("td")
            if len(tds) >= 9:
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
        return res


class CourseDetailParser(BaseParser):
    def __init__(self):
        self.specialty_parser = SpecialtyParser()
        self.enrollment_parser = EnrollmentParser()
        self.students_parser = StudentsParser()

    def parse(self, html: str, **kwargs) -> ParsedCourseDetails:
        url = kwargs.get("url", "")
        if not url:
            raise ValueError("url is required for CourseDetailParser")

        return self._parse_course_details(html, url)

    def _parse_course_details(self, html: str, url: str) -> ParsedCourseDetails:
        soup = BeautifulSoup(html, "lxml")

        h1 = soup.select_one(".page-header h1")
        if h1:
            direct_text = "".join(h1.find_all(string=True, recursive=False))
            title = ParserUtils.clean_text(direct_text)
        else:
            title = ""

        table = soup.select_one("table.table.table-condensed.table-bordered")
        data: dict[str, Any] = {
            "url": url,
            "title": title,
        }
        course_id: str | None = None

        if table:
            tbodies = table.find_all("tbody")
            if tbodies:
                for tr in tbodies[0].find_all("tr", recursive=False):
                    th = tr.find("th")
                    td = tr.find("td")
                    if not (th and td):
                        continue
                    key = ParserUtils.clean_text(th.get("title") or th.get_text(" "))
                    if key == "Код курсу" or key == "Код":
                        course_id = ParserUtils.clean_text(td.get_text(" "))
                        data["id"] = course_id
                    elif key == "Інформація":
                        info_data = self._parse_info_labels(td)
                        for k, v in info_data.items():
                            data[k] = v
                    elif "Факультет" in key:
                        data["faculty"] = ParserUtils.clean_text(td.get_text(" "))
                    elif "Кафедра" in key:
                        data["department"] = ParserUtils.clean_text(td.get_text(" "))
                    elif "Освітній рівень" in key:
                        data["education_level"] = ParserUtils.clean_text(td.get_text(" "))
                    elif "Навчальний рік" in key:
                        data["academic_year"] = ParserUtils.clean_text(td.get_text(" "))
                    elif "Викладач" in key:
                        data["teachers"] = ParserUtils.clean_text(td.get_text(" "))
                    else:
                        pass

                data["annotation"] = self._parse_annotation(tbodies[0])
                data["specialties"] = self.specialty_parser._parse_specialties(tbodies[0])

            for tbody in tbodies[1:]:
                hdr = tbody.select_one("tr th.info")
                if hdr:
                    ParserUtils.clean_text(hdr.get_text(" "))
                    continue
                if tbody.find(string=lambda s: isinstance(s, str) and "Встановлені ліміти" in s):
                    data["limits"] = self.enrollment_parser._parse_limits(tbody)
                    continue
                if tbody.find(string=lambda s: isinstance(s, str) and "Інформація про запис" in s):
                    data["enrollment"] = self.enrollment_parser._parse_enrollment(tbody)
                    continue
                if tbody.find(string=lambda s: isinstance(s, str) and "Семестри" in s):
                    sem_labels = []
                    row = tbody.select_one("tr td")
                    if row:
                        for span in row.select("span.label"):
                            sem_labels.append(ParserUtils.clean_text(span.get_text(" ")))
                    data["semesters"] = sem_labels
                    continue
                th = tbody.select_one("tr th")
                if th:
                    season = ParserUtils.clean_text(th.get_text(" "))
                    tds = tbody.select_one("tr td")
                    if tds:
                        labels = [
                            ParserUtils.clean_text(s.get_text(" "))
                            for s in tds.select("span.label")
                        ]
                        if season:
                            if "season_details" not in data:
                                data["season_details"] = {}
                            if data["season_details"] is None:
                                data["season_details"] = {}
                            data["season_details"][season] = labels

        data["students"] = self.students_parser._parse_students_table(soup)
        return ParsedCourseDetails(**data)

    def _parse_info_labels(self, td) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for span in td.select("span.label"):
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
