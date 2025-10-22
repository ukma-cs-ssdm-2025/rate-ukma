from scraper.models import ParsedCourseDetails
from scraper.models.deduplicated import DeduplicatedCourse
from scraper.services.deduplication.merger import get_course_key


def test_get_course_key_basic():
    # Arrange
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "  Веб-розробка: основи та практики  ",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "  Факультет інформатики  ",
        "department": "  Кафедра програмної інженерії  ",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "specialties": [],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = get_course_key(course)

    # Assert
    expected = (
        "веб-розробка: основи та практики",
        "факультет інформатики",
        "кафедра програмної інженерії",
    )
    assert result == expected


def test_get_course_key_empty_fields():
    # Arrange
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "",
        "id": "550001",
        "credits": None,
        "hours": None,
        "year": None,
        "faculty": None,
        "department": "",
        "academic_year": None,
        "semesters": [],
        "specialties": [],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = get_course_key(course)

    # Assert
    expected = ("", "", "")
    assert result == expected


def test_get_course_key_case_insensitive():
    # Arrange
    course_data1 = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Веб-розробка: Основи та Практики",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет Інформатики",
        "department": "Кафедра Програмної Інженерії",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "specialties": [],
        "students": [],
    }
    course_data2 = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "веб-розробка: основи та практики",
        "id": "550002",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "факультет інформатики",
        "department": "кафедра програмної інженерії",
        "academic_year": "2025–2026",
        "semesters": ["осінній"],
        "specialties": [],
        "students": [],
    }
    course1 = ParsedCourseDetails(**course_data1)
    course2 = ParsedCourseDetails(**course_data2)

    # Act
    result1 = get_course_key(course1)
    result2 = get_course_key(course2)

    # Assert
    assert result1 == result2


def test_course_merger_merge_single_course(course_merger, sample_course):
    # Arrange
    courses = [sample_course]

    # Act
    result = course_merger.merge_duplicate_courses(courses)

    # Assert
    assert len(result) == 1
    deduplicated_course = result[0]
    assert isinstance(deduplicated_course, DeduplicatedCourse)
    assert deduplicated_course.title == "Test Course"
    assert len(deduplicated_course.offerings) == 1


def test_course_merger_merge_duplicate_courses(course_merger, duplicate_course_variants):
    # Arrange
    courses = duplicate_course_variants

    # Act
    result = course_merger.merge_duplicate_courses(courses)

    # Assert
    assert len(result) == 2

    # Find the merged course
    web_dev_course = next(
        (course for course in result if course.title == "Веб-розробка: основи та практики"), None
    )
    assert web_dev_course is not None
    assert len(web_dev_course.offerings) == 2

    # Check the separate course
    data_structures_course = next(
        (course for course in result if course.title == "Структури даних та алгоритми"), None
    )
    assert data_structures_course is not None
    assert len(data_structures_course.offerings) == 1


def test_course_merger_merge_empty_list(course_merger):
    # Arrange
    courses = []

    # Act
    result = course_merger.merge_duplicate_courses(courses)

    # Assert
    assert result == []


def test_course_merger_preserves_all_data(course_merger, duplicate_course_variants):
    # Arrange
    courses = duplicate_course_variants

    # Act
    result = course_merger.merge_duplicate_courses(courses)

    # Assert
    web_dev_course = next(
        (course for course in result if course.title == "Веб-розробка: основи та практики"), None
    )
    assert web_dev_course is not None

    total_enrollments = 0
    for offering in web_dev_course.offerings:
        total_enrollments += len(offering.enrollments)

    assert total_enrollments == 4


def test_course_merger_handles_different_academic_years(course_merger):
    # Arrange
    base_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Веб-розробка: основи та практики",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "format": "2015",
        "status": "Курс відбувся",
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "semesters": ["осінній"],
        "teachers": "Петренко І.П., д.т.н.",
        "annotation": "Основні концепції веб-розробки, HTML, CSS, JavaScript та сучасні фреймворки.",
        "specialties": [{"specialty": "Програмна інженерія", "type": "Професійно-орієнтована"}],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
        "students": [{"index": "1", "name": "Петренко Олександр Петрович"}],
    }

    course1_data = base_data.copy()
    course1_data["academic_year"] = "2025–2026"
    course1_data["id"] = "550001"

    course2_data = base_data.copy()
    course2_data["academic_year"] = "2024–2025"
    course2_data["id"] = "550002"

    course1 = ParsedCourseDetails(**course1_data)
    course2 = ParsedCourseDetails(**course2_data)

    # Act
    result = course_merger.merge_duplicate_courses([course1, course2])

    # Assert
    assert len(result) == 1
    deduplicated_course = result[0]
    assert len(deduplicated_course.offerings) == 2

    # Check that different academic years are preserved
    years = {offering.semester.year for offering in deduplicated_course.offerings}
    assert years == {2025, 2024}
