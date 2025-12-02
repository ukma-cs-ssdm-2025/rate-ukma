from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from rating_app.exception.semester_exception import SemesterDoesNotExistError
from rating_app.models import Semester
from rating_app.models.choices import SemesterTerm
from rating_app.repositories import SemesterRepository
from rating_app.services.protocols import IFilterable


@dataclass
class SemesterFilterOption:
    value: str
    label: str


@dataclass
class SemesterFilterData:
    terms: list[SemesterFilterOption]
    years: list[SemesterFilterOption]

    def to_dict(self) -> dict[str, list[dict[str, Any]]]:
        return {
            "terms": [{"value": t.value, "label": t.label} for t in self.terms],
            "years": [{"value": y.value, "label": y.label} for y in self.years],
        }


class SemesterService(IFilterable):
    TERM_PRIORITY = {
        SemesterTerm.SPRING: 0,
        SemesterTerm.SUMMER: 1,
        SemesterTerm.FALL: 2,
    }

    MIDTERM_MONTH = {
        SemesterTerm.SPRING: 3,  # March
        SemesterTerm.SUMMER: 6,  # June
        SemesterTerm.FALL: 11,  # November
    }

    def __init__(self, semester_repository: SemesterRepository):
        self.semester_repository = semester_repository

    def get_semesters(self):
        return self.semester_repository.get_all()

    def get_filter_options(self) -> dict[str, Any]:
        return self._build_filter_options().to_dict()

    def get_current(self) -> Semester:
        now = datetime.now()
        month = now.month
        if month >= 9:
            term = SemesterTerm.FALL
        elif month < 5:
            term = SemesterTerm.SPRING
        else:
            term = SemesterTerm.SUMMER

        year = now.year

        try:
            return self.semester_repository.get_by_year_and_term(year=year, term=term)
        except Semester.DoesNotExist as exc:
            raise SemesterDoesNotExistError(
                f"Current semester ({now.year} {now.strftime('%B')})"
            ) from exc

    def is_midpoint(
        self,
        current_semester: Semester | None = None,
        current_date: datetime | None = None,
    ) -> bool:
        if current_date is None:
            current_date = datetime.now()
        if current_semester is None:
            current_semester = self.get_current()

        term = SemesterTerm(current_semester.term)

        semester_year = current_semester.year
        midpoint_month = self.MIDTERM_MONTH[term]
        midpoint_date = date(year=semester_year, month=midpoint_month, day=1)

        today = current_date.date()
        return today >= midpoint_date

    def is_past_semester(
        self, semester_to_check: Semester, current_semester: Semester | None = None
    ) -> bool:
        if not current_semester:
            current_semester = self.get_current()

        check_priority = self._get_term_priority(semester_to_check.term)
        current_priority = self._get_term_priority(current_semester.term)

        return (semester_to_check.year, check_priority) < (
            current_semester.year,
            current_priority,
        )

    def _build_filter_options(self) -> SemesterFilterData:
        semesters = self.semester_repository.get_all()
        sorted_semesters = self._sort_semesters(semesters)
        term_labels = self._extract_term_labels(sorted_semesters)
        academic_years = self._extract_academic_years(sorted_semesters)
        semester_terms = self._build_semester_terms(term_labels)
        semester_years = self._build_semester_years(academic_years)
        return SemesterFilterData(terms=semester_terms, years=semester_years)

    def _sort_semesters(self, semesters):
        semester_term_order = {value: index for index, value in enumerate(SemesterTerm.values)}

        return sorted(
            semesters,
            key=lambda semester: (
                getattr(semester, "year", 0) or 0,
                semester_term_order.get(getattr(semester, "term", None), -1),
            ),
            reverse=True,
        )

    def _extract_term_labels(self, sorted_semesters) -> dict[str | SemesterTerm, str]:
        term_labels: dict[str | SemesterTerm, str] = {}

        for semester in sorted_semesters:
            term = getattr(semester, "term", None)
            if not term or term in term_labels:
                continue

            label = SemesterTerm(term).label if term in SemesterTerm.values else str(term).title()
            term_labels[term] = label  # type: ignore

        return term_labels

    def _extract_academic_years(self, sorted_semesters) -> set[tuple[int, int]]:
        """Extract academic year ranges from semesters.

        Academic year is determined by:
        - Fall semester: starts the academic year (e.g., Fall 2024 → 2024-2025)
        - Spring/Summer semester: ends the academic year (e.g., Spring 2025 → 2024-2025)
        """
        academic_years: set[tuple[int, int]] = set()

        for semester in sorted_semesters:
            year = getattr(semester, "year", None)
            term = getattr(semester, "term", None)
            if year is not None and term is not None:
                academic_year = self._get_academic_year_range(year, term)
                if academic_year:
                    academic_years.add(academic_year)

        return academic_years

    def _get_academic_year_range(self, year: int, term: str) -> tuple[int, int] | None:
        """Get academic year range for a given semester year and term.

        Returns a tuple of (start_year, end_year) representing the academic year.
        """
        if term == SemesterTerm.FALL:
            return (year, year + 1)
        elif term in (SemesterTerm.SPRING, SemesterTerm.SUMMER):
            return (year - 1, year)
        return None

    def _build_semester_terms(
        self, term_labels: dict[str | SemesterTerm, str]
    ) -> list[SemesterFilterOption]:
        return [
            SemesterFilterOption(value=str(term), label=term_labels[term])
            for term in sorted(term_labels.keys(), key=self._get_term_priority)
        ]

    def _get_term_priority(self, value: str | SemesterTerm) -> int:
        if isinstance(value, SemesterTerm):
            return self.TERM_PRIORITY.get(value, len(self.TERM_PRIORITY))
        elif value in SemesterTerm.values:
            return self.TERM_PRIORITY.get(SemesterTerm(value), len(self.TERM_PRIORITY))
        else:
            return len(self.TERM_PRIORITY)

    def _build_semester_years(
        self, academic_years: set[tuple[int, int]]
    ) -> list[SemesterFilterOption]:
        """Build academic year filter options from academic year ranges.

        Format: "start_year–end_year" (e.g., "2024–2025")
        """
        return [
            SemesterFilterOption(
                value=f"{start_year}–{end_year}", label=f"{start_year}–{end_year}"
            )
            for start_year, end_year in sorted(academic_years, reverse=True)
        ]
