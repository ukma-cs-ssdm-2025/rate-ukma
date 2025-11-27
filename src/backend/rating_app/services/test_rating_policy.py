from datetime import datetime
from unittest.mock import MagicMock

import pytest

from rating_app.models import Semester
from rating_app.models.choices import SemesterTerm
from rating_app.services.rating_policy import RatingWindowPolicy


@pytest.fixture
def semester_service():
    return MagicMock()


@pytest.fixture
def rating_policy(semester_service):
    return RatingWindowPolicy(semester_service=semester_service)


class TestIsOpenForRating:
    """Test cases for RatingWindowPolicy.is_semester_open_for_rating method."""

    def test_past_semester_returns_true(self, rating_policy, semester_service):
        """Past semesters should always be open for rating."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.SPRING)
        current_semester = Semester(year=2024, term=SemesterTerm.FALL)
        current_date = datetime(2024, 11, 15)

        semester_service.is_past_semester.return_value = True
        semester_service.is_midpoint.return_value = False

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is True
        semester_service.is_past_semester.assert_called_once_with(
            semester_to_check, current_semester
        )

    def test_current_semester_before_midpoint_returns_false(self, rating_policy, semester_service):
        """Current semester before midpoint should not be open for rating."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.FALL)
        current_semester = Semester(year=2024, term=SemesterTerm.FALL)
        current_date = datetime(2024, 10, 15)  # Before November midpoint

        semester_service.is_past_semester.return_value = False
        semester_service.is_midpoint.return_value = False

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is False
        semester_service.is_past_semester.assert_called_once_with(
            semester_to_check, current_semester
        )
        semester_service.is_midpoint.assert_called_once_with(semester_to_check, current_date)

    def test_current_semester_at_midpoint_returns_true(self, rating_policy, semester_service):
        """Current semester at midpoint should be open for rating."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.FALL)
        current_semester = Semester(year=2024, term=SemesterTerm.FALL)
        current_date = datetime(2024, 11, 1)  # Exactly at November midpoint

        semester_service.is_past_semester.return_value = False
        semester_service.is_midpoint.return_value = True

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is True
        semester_service.is_midpoint.assert_called_once_with(semester_to_check, current_date)

    def test_current_semester_after_midpoint_returns_true(self, rating_policy, semester_service):
        """Current semester after midpoint should be open for rating."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.FALL)
        current_semester = Semester(year=2024, term=SemesterTerm.FALL)
        current_date = datetime(2024, 11, 15)  # After November midpoint

        semester_service.is_past_semester.return_value = False
        semester_service.is_midpoint.return_value = True

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is True

    def test_future_semester_returns_false(self, rating_policy, semester_service):
        """Future semesters should not be open for rating."""
        # Arrange
        semester_to_check = Semester(year=2025, term=SemesterTerm.SPRING)
        current_semester = Semester(year=2024, term=SemesterTerm.FALL)
        current_date = datetime(2024, 11, 15)

        semester_service.is_past_semester.return_value = False
        semester_service.is_midpoint.return_value = False

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is False

    def test_spring_semester_midpoint_logic(self, rating_policy, semester_service):
        """Spring semester should open at March midpoint."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.SPRING)
        current_semester = Semester(year=2024, term=SemesterTerm.SPRING)
        current_date = datetime(2024, 3, 1)  # March 1st

        semester_service.is_past_semester.return_value = False
        semester_service.is_midpoint.return_value = True

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is True

    def test_summer_semester_midpoint_logic(self, rating_policy, semester_service):
        """Summer semester should open at June midpoint."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.SUMMER)
        current_semester = Semester(year=2024, term=SemesterTerm.SUMMER)
        current_date = datetime(2024, 6, 1)  # June 1st

        semester_service.is_past_semester.return_value = False
        semester_service.is_midpoint.return_value = True

        # Act
        result = rating_policy.is_semester_open_for_rating(
            semester_to_check,
            current_semester=current_semester,
            current_date=current_date,
        )

        # Assert
        assert result is True

    def test_uses_defaults_when_no_parameters_provided(self, rating_policy, semester_service):
        """Should use defaults from semester_service when parameters not provided."""
        # Arrange
        semester_to_check = Semester(year=2024, term=SemesterTerm.FALL)
        semester_service.is_past_semester.return_value = True
        semester_service.is_midpoint.return_value = False

        # Act
        result = rating_policy.is_semester_open_for_rating(semester_to_check)

        # Assert
        assert result is True
        # Should be called with None when not provided
        semester_service.is_past_semester.assert_called_once_with(semester_to_check, None)
