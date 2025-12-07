from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from rating_app.models.choices import SemesterTerm
from rating_app.services.semester_service import SemesterService


@pytest.fixture
def semester_repo():
    return MagicMock()


@pytest.fixture
def service(semester_repo):
    return SemesterService(semester_repository=semester_repo)


def test_get_semesters_returns_all_semesters_from_repository(service, semester_repo):
    expected_semesters = [MagicMock(), MagicMock()]
    semester_repo.get_all.return_value = expected_semesters

    result = service.get_semesters()

    assert result == expected_semesters
    semester_repo.get_all.assert_called_once()


def test_get_filter_options_returns_empty_lists_when_no_semesters(service, semester_repo):
    semester_repo.get_all.return_value = []

    result = service.get_filter_options()

    assert result == {"terms": [], "years": []}


def test_get_filter_options_orders_terms_by_priority_spring_summer_fall(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2024, term=SemesterTerm.FALL),
        SimpleNamespace(year=2024, term=SemesterTerm.SUMMER),
        SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
    ]

    result = service.get_filter_options()

    term_values = [t["value"] for t in result["terms"]]
    assert term_values == ["SPRING", "SUMMER", "FALL"]


def test_get_filter_options_orders_years_descending(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2022, term=SemesterTerm.FALL),
        SimpleNamespace(year=2024, term=SemesterTerm.FALL),
        SimpleNamespace(year=2023, term=SemesterTerm.FALL),
    ]

    result = service.get_filter_options()

    year_values = [y["value"] for y in result["years"]]
    assert year_values == ["2024–2025", "2023–2024", "2022–2023"]


def test_get_filter_options_includes_term_labels(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
    ]

    result = service.get_filter_options()

    assert len(result["terms"]) == 1
    assert result["terms"][0]["value"] == "SPRING"
    assert result["terms"][0]["label"] == "Spring"


def test_get_filter_options_deduplicates_terms_across_years(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2024, term=SemesterTerm.FALL),
        SimpleNamespace(year=2023, term=SemesterTerm.FALL),
        SimpleNamespace(year=2022, term=SemesterTerm.FALL),
    ]

    result = service.get_filter_options()

    assert len(result["terms"]) == 1
    assert result["terms"][0]["value"] == "FALL"


def test_get_filter_options_includes_all_unique_academic_years(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2024, term=SemesterTerm.FALL),
        SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
        SimpleNamespace(year=2023, term=SemesterTerm.FALL),
    ]

    result = service.get_filter_options()

    # Fall 2024 -> 2024-2025, Spring 2024 -> 2023-2024, Fall 2023 -> 2023-2024
    year_values = [y["value"] for y in result["years"]]
    assert year_values == ["2024–2025", "2023–2024"]


def test_get_filter_options_handles_semesters_with_missing_attributes(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2024, term=SemesterTerm.FALL),
        SimpleNamespace(year=None, term=SemesterTerm.SPRING),
        SimpleNamespace(year=2023, term=None),
    ]

    result = service.get_filter_options()

    # Only Fall 2024 should produce a valid academic year (2024-2025)
    year_values = [y["value"] for y in result["years"]]
    assert "2024–2025" in year_values
    assert len(result["terms"]) >= 1


def test_get_filter_options_handles_unknown_term_values(service, semester_repo):
    semester_repo.get_all.return_value = [
        SimpleNamespace(year=2024, term="UNKNOWN_TERM"),
    ]

    result = service.get_filter_options()

    assert len(result["terms"]) == 1
    assert result["terms"][0]["value"] == "UNKNOWN_TERM"
    assert result["terms"][0]["label"] == "Unknown_Term"
