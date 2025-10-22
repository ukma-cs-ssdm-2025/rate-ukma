import pytest

from scraper.models import ParsedCourseDetails
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


def test_semester_extractor_missing_academic_year():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "",
        "semesters": ["осінній"],
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }

    course = ParsedCourseDetails(**course_data)

    # Act & Assert - Should raise DataValidationError
    with pytest.raises(DataValidationError, match="Course 550001 missing required academic_year"):
        extractor.extract(course)


def test_semester_extractor_missing_semesters():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": [],
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }

    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert - Should return empty list instead of raising exception
    assert result == []


def test_semester_extractor_invalid_year():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "invalid-year",
        "semesters": ["осінній"],
    }

    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Cannot extract year from academic year"):
        extractor.extract(course)


def test_semester_extractor_year_out_of_range():
    # Arrange
    extractor = SemesterExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "1999–2000",
        "semesters": ["осінній"],
    }

    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Year 1999 is outside valid range"):
        extractor.extract(course)


def test_semester_extractor_raises_error_when_academic_year_is_empty():
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "",
        "semesters": ["осінній"],
        "credits": None,
        "hours": None,
        "year": None,
        "specialties": [],
        "students": [],
    }

    course = ParsedCourseDetails(**course_data)

    extractor = SemesterExtractor()

    # Act & Assert - Should raise DataValidationError
    with pytest.raises(DataValidationError, match="Course 550001 missing required academic_year"):
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
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "teachers": "",
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = extractor.extract(course)

    # Assert
    assert result == []


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
        "semesters": ["осінній"],
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
        "semesters": ["осінній"],
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
        "semesters": ["осінній"],
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
        "semesters": ["осінній"],
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
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "education_level": None,
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Course 550001 missing required education level"):
        extractor.extract(course)


def test_education_level_extractor_unrecognized_level():
    # Arrange
    extractor = EducationLevelExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "education_level": "Невідомий рівень",
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(
        DataValidationError,
        match="Course 550001 has unrecognized education level: Невідомий рівень",
    ):
        extractor.extract(course)


def test_practice_type_extractor_returns_none():
    # Arrange
    extractor = PracticeTypeExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
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
    assert result is None


def test_course_limits_extractor_missing_limits():
    # Arrange
    extractor = CourseLimitsExtractor()
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "limits": None,
    }
    course = ParsedCourseDetails(**course_data)

    # Act & Assert
    with pytest.raises(DataValidationError, match="Course 550001 missing required limits data"):
        extractor.extract(course)
