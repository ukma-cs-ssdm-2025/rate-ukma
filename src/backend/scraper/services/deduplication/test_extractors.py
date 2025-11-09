import pytest

from scraper.models import ParsedCourseDetails
from scraper.models.deduplicated import PracticeType
from scraper.services.deduplication.base import DataValidationError
from scraper.services.deduplication.extractors import (
    CourseLimitsExtractor,
    DescriptionExtractor,
    EducationLevelExtractor,
    InstructorExtractor,
    PracticeTypeExtractor,
    SemesterExtractor,
    SpecialtyExtractor,
    StudentExtractor,
)

BASE_TEST_COURSE = {
    "url": "https://my.ukma.edu.ua/course/550001",
    "title": "Test Course",
    "id": "550001",
    "academic_year": "2025–2026",
    "semesters": ["Семестр 1"],
    "credits": None,
    "hours": None,
    "year": None,
    "specialties": [],
    "students": [],
}


def test_semester_extractor_missing_academic_year():
    # Arrange
    extractor = SemesterExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["academic_year"] = ""
    course_data["semesters"] = ["Семестр 5"]

    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Course 550001 missing required academic_year"):
        extractor.extract(course)


def test_semester_extractor_missing_semesters():
    # Arrange
    extractor = SemesterExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["semesters"] = []

    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


def test_semester_extractor_invalid_year():
    # Arrange
    extractor = SemesterExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["academic_year"] = "invalid-year"
    course_data["semesters"] = ["Семестр 3"]

    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Academic year must contain exactly 2 years"):
        extractor.extract(course)


def test_semester_extractor_success(sample_course):
    # Arrange
    extractor = SemesterExtractor()

    # Act
    result = extractor.extract(sample_course)

    # Assert
    assert result is not None
    assert len(result) > 0
    semester = result[0]
    assert hasattr(semester, "year")
    assert hasattr(semester, "term")
    assert semester.year == 2025


def test_instructor_extractor_success(sample_course):
    # Arrange
    extractor = InstructorExtractor()

    # Act
    result = extractor.extract(sample_course)

    # Assert
    assert result is not None
    assert len(result) > 0


def test_instructor_extractor_empty_teachers():
    # Arrange
    extractor = InstructorExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["teachers"] = ""
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


def test_instructor_extractor_with_initials():
    # Arrange
    extractor = InstructorExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["teachers"] = "Ростовська Т.В."
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 1
    instructor = result[0].instructor
    assert instructor.last_name == "Ростовська"
    assert instructor.first_name == "Т"
    assert instructor.patronymic == "В"


def test_instructor_extractor_with_initials_no_dots():
    # Arrange
    extractor = InstructorExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["teachers"] = "Петров А Б"
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 1
    instructor = result[0].instructor
    assert instructor.last_name == "Петров"
    assert instructor.first_name == "А"
    assert instructor.patronymic == "Б"


def test_instructor_extractor_with_single_initial():
    # Arrange
    extractor = InstructorExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "teachers": "Іванов І.",
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 1
    instructor = result[0].instructor
    assert instructor.last_name == "Іванов"
    assert instructor.first_name == "І"
    assert instructor.patronymic == ""


def test_student_extractor_success(sample_course):
    # Arrange
    extractor = StudentExtractor()

    # Act
    result = extractor.extract(sample_course)

    # Assert
    assert result is not None
    assert len(result) == 2


def test_student_extractor_empty_students():
    # Arrange
    extractor = StudentExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


def test_specialty_extractor_success(sample_course):
    # Arrange
    extractor = SpecialtyExtractor()

    # Act
    result = extractor.extract(sample_course)

    # Assert
    assert result is not None
    assert len(result) == 1


def test_specialty_extractor_multiple_specialties(sample_course_data_dict):
    # Arrange
    extractor = SpecialtyExtractor()
    course = ParsedCourseDetails(**sample_course_data_dict)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert len(result) == 2


def test_specialty_extractor_empty_specialties():
    # Arrange
    extractor = SpecialtyExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "specialties": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


def test_specialty_extractor_unknown_education_level():
    # Arrange
    extractor = SpecialtyExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "specialties": [{"specialty": "Програмна інженерія", "type": "Невідомий рівень"}],
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(
        DataValidationError, match="Unrecognized specialty education level: Невідомий рівень"
    ):
        extractor.extract(course)


def test_description_extractor_missing_annotation():
    # Arrange
    extractor = DescriptionExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "annotation": None,
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == ""


def test_education_level_extractor_missing_level():
    # Arrange
    extractor = EducationLevelExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["education_level"] = None
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Course 550001 missing required education level"):
        extractor.extract(course)


def test_education_level_extractor_unrecognized_level():
    # Arrange
    extractor = EducationLevelExtractor()
    course_data = BASE_TEST_COURSE.copy()
    course_data["education_level"] = "Невідомий рівень"
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(
        DataValidationError,
        match="Course 550001 has unrecognized education level: Невідомий рівень",
    ):
        extractor.extract(course)


def test_practice_type_extractor_no_season_details():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "format": "2015",
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result == PracticeType.PRACTICE


def test_practice_type_extractor_success_english():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_type": "PRACTICE",
                "practice_hours": 20,
                "exam_type": "залік",
            }
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result.value == "PRACTICE"


def test_practice_type_extractor_seminar_english():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_type": "SEMINAR",
                "practice_hours": 20,
                "exam_type": "залік",
            }
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result.value == "SEMINAR"


def test_practice_type_extractor_unknown_type_defaults_to_practice():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_type": "UNKNOWN_TYPE",
                "practice_hours": 20,
                "exam_type": "залік",
            }
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result.value == "PRACTICE"


def test_practice_type_extractor_case_insensitive():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_type": "practice",
                "practice_hours": 20,
                "exam_type": "залік",
            }
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result.value == "PRACTICE"


def test_practice_type_extractor_with_whitespace():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_type": "  PRACTICE  ",
                "practice_hours": 20,
                "exam_type": "залік",
            }
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result.value == "PRACTICE"


def test_practice_type_extractor_no_practice_type_in_season_details():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_hours": 20,
                "exam_type": "залік",
                # practice_type is missing
            }
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result == PracticeType.PRACTICE


def test_practice_type_extractor_multiple_seasons():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1", "Семестр 2"],
        "season_details": {
            "Осінь": {
                "credits": 4.0,
                "practice_type": "SEMINAR",
            },
            "Весна": {
                "credits": 4.0,
                "practice_type": "PRACTICE",
            },
        },
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result is not None
    assert result.value == "SEMINAR"


def test_course_limits_extractor_missing_limits():
    # Arrange
    extractor = CourseLimitsExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
        "limits": None,
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Course 550001 missing required limits data"):
        extractor.extract(course)


def test_semester_extractor_new_format_fall():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 1
    assert result[0].year == 2025
    assert result[0].term.value == "FALL"


def test_semester_extractor_new_format_spring():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 2"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 1
    assert result[0].year == 2026
    assert result[0].term.value == "SPRING"


def test_semester_extractor_new_format_summer():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 2д"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 1
    assert result[0].year == 2026
    assert result[0].term.value == "SUMMER"


def test_semester_extractor_new_format_multiple_semesters():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1", "Семестр 2", "Семестр 2д"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 3
    terms = [semester.term.value for semester in result]

    assert "FALL" in terms
    assert "SPRING" in terms
    assert "SUMMER" in terms

    fall_semesters = [s for s in result if s.term.value == "FALL"]
    spring_summer_semesters = [s for s in result if s.term.value in ["SPRING", "SUMMER"]]

    assert all(s.year == 2025 for s in fall_semesters)
    assert all(s.year == 2026 for s in spring_summer_semesters)


def test_semester_extractor_new_format_higher_numbers():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 3", "Семестр 4", "Семестр 4д"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 3
    terms = [semester.term.value for semester in result]

    assert "FALL" in terms
    assert "SPRING" in terms
    assert "SUMMER" in terms

    for semester in result:
        if semester.term.value == "FALL":
            assert semester.year == 2025
        else:
            assert semester.year == 2026


def test_semester_extractor_invalid_semester_label():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["недійсний Семестр"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


def test_semester_extractor_mixed_valid_invalid():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["Семестр 1", "недійсний", "Семестр 2д"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert len(result) == 2
    terms = [semester.term.value for semester in result]
    assert "FALL" in terms
    assert "SUMMER" in terms


def test_semester_extractor_single_year_format_raises_error():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025",
        "semesters": ["Семестр 1"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Academic year must contain exactly 2 years"):
        extractor.extract(course)


def test_semester_extractor_three_years_format_raises_error():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2024-2025-2026",
        "semesters": ["Семестр 1"],
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Academic year must contain exactly 2 years"):
        extractor.extract(course)


def test_semester_extractor_different_academic_year_formats():
    test_cases = [
        ("2024–2025", "Семестр 1", 2024, "FALL"),
        ("2024-2025", "Семестр 2", 2025, "SPRING"),
        ("2024/2025", "Семестр 3", 2024, "FALL"),
        ("2024-2025", "Семестр 4", 2025, "SPRING"),
        ("2024-2025", "Семестр 5", 2024, "FALL"),
        ("2024-2025", "Семестр 6", 2025, "SPRING"),
    ]

    extractor = SemesterExtractor()

    for academic_year, semester, expected_year, expected_term in test_cases:
        course_data = {
            "url": "https://my.ukma.edu.ua/course/550001",
            "title": "Test Course",
            "id": "550001",
            "academic_year": academic_year,
            "semesters": [semester],
        }
        course = ParsedCourseDetails(**course_data)

        result = extractor.extract(course)
        assert len(result) == 1
        assert result[0].year == expected_year
        assert result[0].term.value == expected_term
