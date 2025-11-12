from dataclasses import dataclass
from typing import Any

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

    def __init__(self, semester_repository: SemesterRepository):
        self.semester_repository = semester_repository

    def get_semesters(self):
        return self.semester_repository.get_all()

    def get_filter_options(self) -> dict[str, Any]:
        return self._build_filter_options().to_dict()

    def _build_filter_options(self) -> SemesterFilterData:
        semesters = self.semester_repository.get_all()
        sorted_semesters = self._sort_semesters(semesters)
        term_labels = self._extract_term_labels(sorted_semesters)
        years = self._extract_years(sorted_semesters)
        semester_terms = self._build_semester_terms(term_labels)
        semester_years = self._build_semester_years(years)
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

    def _extract_years(self, sorted_semesters) -> set[int]:
        years: set[int] = set()

        for semester in sorted_semesters:
            year = getattr(semester, "year", None)
            term = getattr(semester, "term", None)
            if year is not None and term is not None:
                years.add(year)

        return years

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

    def _build_semester_years(self, years: set[int]) -> list[SemesterFilterOption]:
        return [
            SemesterFilterOption(value=str(year), label=str(year))
            for year in sorted(years, reverse=True)
        ]
