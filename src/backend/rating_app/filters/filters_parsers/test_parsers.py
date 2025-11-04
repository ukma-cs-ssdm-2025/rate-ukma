import math

from rest_framework.fields import ValidationError

import pytest

from rating_app.filters.filters_parsers.course import CourseFilterParser
from rating_app.models.choices import SemesterTerm


@pytest.fixture
def mock_semester_term():
    return SemesterTerm


@pytest.fixture
def parser(mock_semester_term) -> CourseFilterParser:
    return CourseFilterParser(min_rating=1.0, max_rating=5.0, semester_term_enum=mock_semester_term)


@pytest.fixture
def query_params():
    return {
        "name": "Test Course",
        "typeKind": "COMPULSORY",
        "semesterYear": "2024",
        "semesterTerm": "fall",
        "avg_difficulty_min": "2.5",
        "avg_difficulty_max": "4.0",
        "avg_usefulness_min": "3.0",
        "avg_usefulness_max": "5.0",
        "page": "2",
        "page_size": "10",
    }


def test_course_filter_parser_valid_inputs(parser: CourseFilterParser, query_params: dict):
    # Arrange and Act
    result = parser.parse(query_params)

    # Assert
    assert result.name == "Test Course"
    assert result.type_kind == "COMPULSORY"
    assert result.semester_year == 2024
    assert result.semester_term == "FALL"
    assert math.isclose(result.avg_difficulty_min or 0, 2.5)
    assert math.isclose(result.avg_difficulty_max or 0, 4.0)
    assert math.isclose(result.avg_usefulness_min or 0, 3.0)
    assert math.isclose(result.avg_usefulness_max or 0, 5.0)
    assert result.page == 2
    assert result.page_size == 10


def test_course_filter_parser_none_values(parser):
    # Arrange and Act
    result = parser.parse({})

    # Assert
    assert result.name is None
    assert result.semester_year is None
    assert result.semester_term is None
    assert result.avg_difficulty_min is None
    assert result.avg_difficulty_max is None
    assert result.page is None
    assert result.page_size is None


@pytest.mark.parametrize("year", ["1990", "invalid"])
def test_course_filter_parser_invalid_semester_year(parser, year):
    # Arrange and Act
    with pytest.raises(ValidationError) as exc_info:
        parser.parse({"semesterYear": year})

    # Assert
    assert "semesterYear" in exc_info.value.detail


@pytest.mark.parametrize("page", ["0", "invalid"])
def test_course_filter_parser_invalid_page(parser, page):
    # Arrange and Act
    with pytest.raises(ValidationError) as exc_info:
        parser.parse({"page": page})

    # Assert
    assert "page" in exc_info.value.detail


@pytest.mark.parametrize("page_size", ["0", "invalid"])
def test_course_filter_parser_invalid_page_size(parser, page_size):
    # Arrange and Act
    with pytest.raises(ValidationError) as exc_info:
        parser.parse({"page_size": page_size})

    # Assert
    assert "page_size" in exc_info.value.detail


def test_course_filter_parser_invalid_semester_term(parser):
    # Arrange and Act
    with pytest.raises(ValidationError) as exc_info:
        parser.parse({"semesterTerm": "INVALID_TERM"})

    # Assert
    assert "semesterTerm" in exc_info.value.detail


@pytest.mark.parametrize(
    "rating, param",
    [
        ("invalid", "avg_difficulty_min"),
        ("0.5", "avg_difficulty_min"),
        ("5.5", "avg_difficulty_max"),
    ],
)
def test_course_filter_parser_invalid_rating_value(parser, rating, param):
    # Arrange and Act
    with pytest.raises(ValidationError) as exc_info:
        parser.parse({param: rating})

    # Assert
    assert param in exc_info.value.detail


@pytest.mark.parametrize(
    "difficulty_min, difficulty_max",
    [
        ("-1", "-1"),
        ("invalid", "invalid"),
        ("6", "5"),
    ],
)
def test_course_filter_parser_rating_range_invalid(parser, difficulty_min, difficulty_max):
    # Arrange and Act
    with pytest.raises(ValidationError) as exc_info:
        parser.parse({"avg_difficulty_min": difficulty_min, "avg_difficulty_max": difficulty_max})

    # Assert
    assert "avg_difficulty_min" in exc_info.value.detail


def test_course_filter_parser_rating_range_valid(parser):
    # Arrange and Act
    result = parser.parse({"avg_difficulty_min": "2.0", "avg_difficulty_max": "4.0"})

    # Assert
    assert math.isclose(result.avg_difficulty_min or 0, 2.0)
    assert math.isclose(result.avg_difficulty_max or 0, 4.0)


@pytest.mark.parametrize(
    "input, expected_term", [("fall", "FALL"), ("SpRiNg", "SPRING"), ("SUMMER", "SUMMER")]
)
def test_course_filter_parser_case_insensitive_semester_term(parser, input, expected_term):
    # Arrange and Act
    result = parser.parse({"semesterTerm": input})

    # Assert
    assert result.semester_term == expected_term
