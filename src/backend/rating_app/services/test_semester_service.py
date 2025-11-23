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


class TestGetSemesters:
    def test_returns_all_semesters_from_repository(self, service, semester_repo):
        # Arrange
        expected_semesters = [MagicMock(), MagicMock()]
        semester_repo.get_all.return_value = expected_semesters

        # Act
        result = service.get_semesters()

        # Assert
        assert result == expected_semesters
        semester_repo.get_all.assert_called_once()


class TestGetFilterOptions:
    def test_returns_empty_lists_when_no_semesters(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = []

        # Act
        result = service.get_filter_options()

        # Assert
        assert result == {"terms": [], "years": []}

    def test_returns_filter_options_with_terms_and_years(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
            SimpleNamespace(year=2023, term=SemesterTerm.FALL),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        assert "terms" in result
        assert "years" in result
        assert isinstance(result["terms"], list)
        assert isinstance(result["years"], list)

    def test_orders_terms_by_priority_spring_summer_fall(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.SUMMER),
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        term_values = [t["value"] for t in result["terms"]]
        assert term_values == ["SPRING", "SUMMER", "FALL"]

    def test_orders_years_descending(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2022, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2023, term=SemesterTerm.FALL),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        year_values = [int(y["value"]) for y in result["years"]]
        assert year_values == [2024, 2023, 2022]

    def test_includes_term_labels(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        assert len(result["terms"]) == 1
        assert result["terms"][0]["value"] == "SPRING"
        assert result["terms"][0]["label"] == "Spring"

    def test_deduplicates_terms_across_years(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2023, term=SemesterTerm.FALL),
            SimpleNamespace(year=2022, term=SemesterTerm.FALL),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        assert len(result["terms"]) == 1
        assert result["terms"][0]["value"] == "FALL"

    def test_includes_all_unique_years(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
            SimpleNamespace(year=2023, term=SemesterTerm.FALL),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        year_values = [int(y["value"]) for y in result["years"]]
        assert year_values == [2024, 2023]

    def test_handles_semesters_with_missing_attributes(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=None, term=SemesterTerm.SPRING),
            SimpleNamespace(year=2023, term=None),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        year_values = [int(y["value"]) for y in result["years"]]
        assert 2024 in year_values
        assert len(result["terms"]) >= 1

    def test_handles_unknown_term_values(self, service, semester_repo):
        # Arrange
        semester_repo.get_all.return_value = [
            SimpleNamespace(year=2024, term="UNKNOWN_TERM"),
        ]

        # Act
        result = service.get_filter_options()

        # Assert
        assert len(result["terms"]) == 1
        assert result["terms"][0]["value"] == "UNKNOWN_TERM"
        assert result["terms"][0]["label"] == "Unknown_Term"


class TestSortSemesters:
    def test_sorts_by_year_descending(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(year=2022, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2023, term=SemesterTerm.FALL),
        ]

        # Act
        result = service._sort_semesters(semesters)

        # Assert
        years = [s.year for s in result]
        assert years == [2024, 2023, 2022]

    def test_sorts_same_year_by_term_priority(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.SUMMER),
        ]

        # Act
        result = service._sort_semesters(semesters)

        # Assert
        terms = [s.term for s in result]
        assert terms == [SemesterTerm.SUMMER, SemesterTerm.SPRING, SemesterTerm.FALL]

    def test_handles_empty_list(self, service):
        # Act
        result = service._sort_semesters([])

        # Assert
        assert result == []

    def test_handles_semesters_with_no_year_attribute(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
        ]

        # Act
        result = service._sort_semesters(semesters)

        # Assert
        assert len(result) == 2


class TestGetTermPriority:
    def test_returns_priority_for_semester_term_enum(self, service):
        # Act & Assert
        assert service._get_term_priority(SemesterTerm.SPRING) == 0
        assert service._get_term_priority(SemesterTerm.SUMMER) == 1
        assert service._get_term_priority(SemesterTerm.FALL) == 2

    def test_returns_priority_for_string_value(self, service):
        # Act & Assert
        assert service._get_term_priority("SPRING") == 0
        assert service._get_term_priority("SUMMER") == 1
        assert service._get_term_priority("FALL") == 2

    def test_returns_default_priority_for_unknown_value(self, service):
        # Act
        result = service._get_term_priority("UNKNOWN")

        # Assert
        assert result == 3


class TestExtractTermLabels:
    def test_extracts_unique_term_labels(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(term=SemesterTerm.FALL),
            SimpleNamespace(term=SemesterTerm.SPRING),
            SimpleNamespace(term=SemesterTerm.FALL),
        ]

        # Act
        result = service._extract_term_labels(semesters)

        # Assert
        assert len(result) == 2
        assert SemesterTerm.FALL in result
        assert SemesterTerm.SPRING in result

    def test_returns_correct_labels_for_terms(self, service):
        # Arrange
        semesters = [SimpleNamespace(term=SemesterTerm.SPRING)]

        # Act
        result = service._extract_term_labels(semesters)

        # Assert
        assert result[SemesterTerm.SPRING] == "Spring"

    def test_skips_semesters_without_term(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(term=None),
            SimpleNamespace(term=SemesterTerm.FALL),
        ]

        # Act
        result = service._extract_term_labels(semesters)

        # Assert
        assert len(result) == 1
        assert SemesterTerm.FALL in result


class TestExtractYears:
    def test_extracts_unique_years(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2023, term=SemesterTerm.FALL),
            SimpleNamespace(year=2024, term=SemesterTerm.SPRING),
        ]

        # Act
        result = service._extract_years(semesters)

        # Assert
        assert result == {2024, 2023}

    def test_excludes_years_without_term(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=2023, term=None),
        ]

        # Act
        result = service._extract_years(semesters)

        # Assert
        assert result == {2024}

    def test_excludes_terms_without_year(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(year=2024, term=SemesterTerm.FALL),
            SimpleNamespace(year=None, term=SemesterTerm.SPRING),
        ]

        # Act
        result = service._extract_years(semesters)

        # Assert
        assert result == {2024}

    def test_returns_empty_set_when_no_valid_semesters(self, service):
        # Arrange
        semesters = [
            SimpleNamespace(year=None, term=None),
        ]

        # Act
        result = service._extract_years(semesters)

        # Assert
        assert result == set()
