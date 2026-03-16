from pytest import approx

from scraper.models import ParsedCourseDetails
from scraper.models.deduplicated import DeduplicatedCourse
from scraper.services.deduplication.grouper import (
    _normalize_specialty_for_grouping,
    get_course_grouping_key,
)


def test_normalize_specialty_for_grouping_basic():
    # Arrange
    specialties = [
        {"specialty": "Програмна інженерія", "type": "Професійно-орієнтована"},
        {"specialty": "Інформатика", "type": "Обов'язкова"},
    ]

    # Act
    result = _normalize_specialty_for_grouping(specialties)

    # Assert
    expected = "програмна інженерія (професійно-орієнтована) | інформатика (обов'язкова)"
    assert result == expected


def test_normalize_specialty_for_grouping_empty():
    # Arrange
    specialties = []

    # Act
    result = _normalize_specialty_for_grouping(specialties)

    # Assert
    assert result == ""


def test_normalize_specialty_for_grouping_missing_type():
    # Arrange
    specialties = [
        {"specialty": "Програмна інженерія"},
        {"specialty": "Інформатика", "type": "Обов'язкова"},
    ]

    # Act
    result = _normalize_specialty_for_grouping(specialties)

    # Assert
    expected = "програмна інженерія | інформатика (обов'язкова)"
    assert result == expected


def test_normalize_specialty_for_grouping_whitespace_normalization():
    # Arrange
    specialties = [
        {"specialty": "  Програмна інженерія  ", "type": "  Професійно-орієнтована  "},
        {"specialty": "Інформатика", "type": "обов'язкова"},
    ]

    # Act
    result = _normalize_specialty_for_grouping(specialties)

    # Assert
    expected = "програмна інженерія (професійно-орієнтована) | інформатика (обов'язкова)"
    assert result == expected


def test_get_course_grouping_key_basic():
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
        "semesters": ["семестр 1"],
        "specialties": [{"specialty": "Програмна інженерія", "type": "Професійно-орієнтована"}],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = get_course_grouping_key(course)

    # Assert
    expected = (
        "веб-розробка: основи та практики",
        "факультет інформатики",
        "програмна інженерія (професійно-орієнтована)",
        "",
    )
    assert result == expected


def test_get_course_grouping_key_multiple_specialties():
    # Arrange
    course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Веб-розробка: основи та практики",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "specialties": [
            {"specialty": "Програмна інженерія", "type": "Професійно-орієнтована"},
            {"specialty": "Інформатика", "type": "Обов'язкова"},
        ],
        "students": [],
    }
    course = ParsedCourseDetails(**course_data)

    # Act
    result = get_course_grouping_key(course)

    # Assert
    expected = (
        "веб-розробка: основи та практики",
        "факультет інформатики",
        "програмна інженерія (професійно-орієнтована) | інформатика (обов'язкова)",
        "",
    )
    assert result == expected


def test_get_course_grouping_key_empty_fields():
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
    result = get_course_grouping_key(course)

    # Assert
    expected = ("", "", "", "")
    assert result == expected


def test_get_course_grouping_key_case_insensitive():
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
        "semesters": ["семестр 1"],
        "specialties": [{"specialty": "Програмна інженерія", "type": "Професійно-орієнтована"}],
        "students": [],
    }
    course_data2 = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "веб-розробка: основи та практики",
        "id": "550002",
        "credits": 5.0,
        "hours": 150,
        "year": 3,
        "faculty": "факультет інформатики",
        "department": "кафедра програмної інженерії",
        "academic_year": "2024–2025",
        "semesters": ["семестр 1"],
        "specialties": [{"specialty": "програмна інженерія", "type": "професійно-орієнтована"}],
        "students": [],
    }
    course1 = ParsedCourseDetails(**course_data1)
    course2 = ParsedCourseDetails(**course_data2)

    # Act
    result1 = get_course_grouping_key(course1)
    result2 = get_course_grouping_key(course2)

    # Assert
    assert result1 == result2


def test_get_course_grouping_key_different_credits_still_group():
    # Arrange
    course_data1 = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Computer Science",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Faculty of Informatics",
        "department": "Department of Software Engineering",
        "academic_year": "2025–2026",
        "semesters": ["fall"],
        "specialties": [{"specialty": "Software Engineering", "type": "Професійно-орієнтована"}],
        "students": [],
    }
    course_data2 = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "Computer Science",
        "id": "550002",
        "credits": 5.0,
        "hours": 150,
        "year": 3,
        "faculty": "Faculty of Informatics",
        "department": "Department of Computer Science",
        "academic_year": "2024–2025",
        "semesters": ["fall"],
        "specialties": [{"specialty": "Software Engineering", "type": "Професійно-орієнтована"}],
        "students": [],
    }
    course1 = ParsedCourseDetails(**course_data1)
    course2 = ParsedCourseDetails(**course_data2)

    # Act
    result1 = get_course_grouping_key(course1)
    result2 = get_course_grouping_key(course2)

    # Assert
    assert result1 == result2
    expected = (
        "computer science",
        "faculty of informatics",
        "software engineering (професійно-орієнтована)",
        "",
    )
    assert result1 == expected


def test_course_grouper_group_single_course(course_grouper, sample_course):
    # Arrange
    courses = [sample_course]

    # Act
    result = course_grouper.group_course_offerings(courses)

    # Assert
    assert len(result) == 1
    grouped_course = result[0]
    assert isinstance(grouped_course, DeduplicatedCourse)
    assert grouped_course.title == "Test Course"
    assert len(grouped_course.offerings) == 1


def test_course_grouper_group_duplicate_courses(course_grouper, duplicate_course_variants):
    # Arrange
    courses = duplicate_course_variants

    # Act
    result = course_grouper.group_course_offerings(courses)

    # Assert
    assert len(result) == 2

    # Find the grouped course
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


def test_course_grouper_group_empty_list(course_grouper):
    # Arrange
    courses = []

    # Act
    result = course_grouper.group_course_offerings(courses)

    # Assert
    assert result == []


def test_course_grouper_preserves_all_data(course_grouper, duplicate_course_variants):
    # Arrange
    courses = duplicate_course_variants

    # Act
    result = course_grouper.group_course_offerings(courses)

    # Assert
    web_dev_course = next(
        (course for course in result if course.title == "Веб-розробка: основи та практики"), None
    )
    assert web_dev_course is not None

    total_enrollments = 0
    for offering in web_dev_course.offerings:
        total_enrollments += len(offering.enrollments)

    assert total_enrollments == 4


def test_course_grouper_handles_different_academic_years(course_grouper):
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
        "semesters": ["семестр 1"],
        "teachers": "Петренко І.П., д.т.н.",
        "annotation": "Основні концепції веб-розробки, HTML, CSS,\
              JavaScript та сучасні фреймворки.",
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
    course1_data["credits"] = 4.0

    course2_data = base_data.copy()
    course2_data["academic_year"] = "2024–2025"
    course2_data["id"] = "550002"
    course2_data["credits"] = 5.0

    course1 = ParsedCourseDetails(**course1_data)
    course2 = ParsedCourseDetails(**course2_data)

    # Act
    result = course_grouper.group_course_offerings([course1, course2])

    # Assert
    assert len(result) == 1
    grouped_course = result[0]
    assert len(grouped_course.offerings) == 2

    years = {offering.semester.year for offering in grouped_course.offerings}
    assert years == {2025, 2024}


def test_course_grouper_different_specialties_do_not_group(course_grouper):
    # Arrange
    base_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Веб-розробка: основи та практики",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    course1_data = base_data.copy()
    course1_data["id"] = "550001"
    course1_data["specialties"] = [
        {"specialty": "Програмна інженерія", "type": "Професійно-орієнтована"}
    ]

    course2_data = base_data.copy()
    course2_data["id"] = "550002"
    course2_data["specialties"] = [{"specialty": "Інформатика", "type": "Обов'язкова"}]

    course1 = ParsedCourseDetails(**course1_data)
    course2 = ParsedCourseDetails(**course2_data)

    # Act
    result = course_grouper.group_course_offerings([course1, course2])

    # Assert
    assert len(result) == 2


def test_course_grouper_filters_zero_credits(course_grouper):
    # Arrange
    valid_course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Valid Course",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    zero_credit_course_data = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "Zero Credits Course",
        "id": "550002",
        "credits": 0.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    valid_course = ParsedCourseDetails(**valid_course_data)
    zero_credit_course = ParsedCourseDetails(**zero_credit_course_data)

    # Act
    result = course_grouper.group_course_offerings([valid_course, zero_credit_course])

    # Assert
    assert len(result) == 1
    assert result[0].title == "Valid Course"


def test_course_grouper_filters_zero_hours(course_grouper):
    # Arrange
    valid_course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Valid Course",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    zero_hours_course_data = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "Zero Hours Course",
        "id": "550002",
        "credits": 4.0,
        "hours": 0,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    valid_course = ParsedCourseDetails(**valid_course_data)
    zero_hours_course = ParsedCourseDetails(**zero_hours_course_data)

    # Act
    result = course_grouper.group_course_offerings([valid_course, zero_hours_course])

    # Assert
    assert len(result) == 1
    assert result[0].title == "Valid Course"


def test_course_grouper_filters_negative_credits_and_hours(course_grouper):
    # Arrange
    valid_course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Valid Course",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    negative_credits_course_data = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "Negative Credits Course",
        "id": "550002",
        "credits": -1.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    negative_hours_course_data = {
        "url": "https://my.ukma.edu.ua/course/550003",
        "title": "Negative Hours Course",
        "id": "550003",
        "credits": 4.0,
        "hours": -5,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    valid_course = ParsedCourseDetails(**valid_course_data)
    negative_credits_course = ParsedCourseDetails(**negative_credits_course_data)
    negative_hours_course = ParsedCourseDetails(**negative_hours_course_data)

    # Act
    result = course_grouper.group_course_offerings(
        [valid_course, negative_credits_course, negative_hours_course]
    )

    # Assert
    assert len(result) == 1
    assert result[0].title == "Valid Course"


def test_course_grouper_keeps_none_credits_and_hours(course_grouper):
    # Arrange
    valid_course_data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Valid Course",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    none_values_course_data = {
        "url": "https://my.ukma.edu.ua/course/550002",
        "title": "None Values Course",
        "id": "550002",
        "credits": None,
        "hours": None,
        "year": 3,
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 1"],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    valid_course = ParsedCourseDetails(**valid_course_data)
    none_values_course = ParsedCourseDetails(**none_values_course_data)

    # Act
    result = course_grouper.group_course_offerings([valid_course, none_values_course])

    # Assert
    assert len(result) == 2
    titles = {course.title for course in result}
    assert titles == {"Valid Course", "None Values Course"}


def test_course_grouper_propagates_specialities_to_offerings(course_grouper, sample_course):
    # Arrange — sample_course has one specialty (SPECIALTY_NAME, education level type)
    courses = [sample_course]

    # Act
    result = course_grouper.group_course_offerings(courses)

    # Assert
    assert len(result) == 1
    grouped = result[0]
    assert len(grouped.offerings) == 1
    offering = grouped.offerings[0]

    # Offering must carry the same specialities as the source course
    assert len(offering.specialities) == len(grouped.specialities)
    for off_spec, course_spec in zip(offering.specialities, grouped.specialities):
        assert off_spec.name == course_spec.name
        assert off_spec.type_kind == course_spec.type_kind


def test_course_grouper_each_offering_gets_its_own_specialities(course_grouper):
    """When two raw courses share title/faculty/specialties, each resulting offering
    carries the specialities of the raw course it originated from."""
    from scraper.models import ParsedCourseDetails

    base = {
        "url": "https://example.com",
        "title": "Алгебра",
        "credits": 3.0,
        "hours": 90,
        "year": 2,
        "format": "2024",
        "status": "Курс відбувся",
        "faculty": "Факультет природничих наук",
        "department": "Кафедра математики",
        "education_level": "Бакалавр",
        "academic_year": "2024-2025",
        "semesters": ["семестр 1"],
        "teachers": "Іваненко А.Б.",
        "annotation": "",
        "specialties": [{"specialty": "Математика", "type": "Обов`язкова"}],
        "limits": {"max_students": 30, "max_groups": 2, "group_size_min": 10, "group_size_max": 20},
    }
    course_a = ParsedCourseDetails(**{**base, "id": "100001"})
    course_b = ParsedCourseDetails(**{**base, "id": "100002", "semesters": ["семестр 2"]})

    result = course_grouper.group_course_offerings([course_a, course_b])

    assert len(result) == 1
    grouped = result[0]
    assert len(grouped.offerings) == 2

    for offering in grouped.offerings:
        assert len(offering.specialities) == 1
        assert offering.specialities[0].name == "Математика"


def test_course_grouper_keeps_bachelor_and_master_variants_separate(course_grouper):
    base = {
        "url": "https://example.com/course",
        "title": "Історія прикордоння",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "format": "Формат 2015",
        "status": "рекомендовано",
        "faculty": "Факультет гуманітарних наук",
        "department": "Кафедра історії",
        "academic_year": "2026–2027",
        "semesters": ["Семестр 6"],
        "teachers": "Маслійчук В.Л., д.і.н.",
        "annotation": "",
        "specialties": [{"specialty": "Історія", "type": "Професійно-орієнтована"}],
        "limits": {"max_students": 37, "max_groups": 1, "group_size_min": 25, "group_size_max": 37},
        "season_details": {
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 24,
                "practice_hours": 16,
                "practice_type": "SEMINAR",
                "exam_type": "залік",
            }
        },
    }
    bachelor_course = ParsedCourseDetails(
        **{
            **base,
            "id": "363683",
            "education_level": "Бакалавр",
        }
    )
    master_course = ParsedCourseDetails(
        **{
            **base,
            "id": "463683",
            "education_level": "Магістр",
        }
    )

    result = course_grouper.group_course_offerings([bachelor_course, master_course])

    assert len(result) == 2
    levels = {grouped.education_level.value for grouped in result}
    assert levels == {"BACHELOR", "MASTER"}


def test_course_grouper_uses_term_specific_season_details(course_grouper):
    course = ParsedCourseDetails(
        url="https://example.com/course/340519",
        title="Методи розробки програмних систем",
        id="340519",
        credits=8.0,
        hours=240,
        year=3,
        format="Формат 2015",
        status="рекомендовано",
        faculty="Факультет інформатики",
        department="Кафедра інформатики",
        education_level="Бакалавр",
        academic_year="2025–2026",
        semesters=["Семестр 5", "Семестр 6"],
        specialties=[{"specialty": "Комп`ютерні науки", "type": "Обов`язкова"}],
        limits={"max_students": 30, "max_groups": 3, "group_size_min": 9, "group_size_max": 12},
        season_details={
            "Осінь": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 22,
                "practice_hours": 22,
                "practice_type": "PRACTICE",
                "exam_type": "екзамен",
            },
            "Весна": {
                "credits": 4.0,
                "hours_per_week": 2,
                "lecture_hours": 18,
                "practice_hours": 12,
                "practice_type": "SEMINAR",
                "exam_type": "залік",
            },
        },
    )

    result = course_grouper.group_course_offerings([course])

    assert len(result) == 1
    grouped = result[0]
    assert len(grouped.offerings) == 1

    offering = grouped.offerings[0]
    assert offering.semester.term.value == "SPRING"
    assert offering.study_year == 3
    assert len(offering.terms) == 2

    terms_by_term = {term.semester.term.value: term for term in offering.terms}

    fall = terms_by_term["FALL"]
    assert fall.credits == approx(4.0)
    assert fall.weekly_hours == 3
    assert fall.lecture_count == 22
    assert fall.practice_count == 22
    assert fall.practice_type.value == "PRACTICE"
    assert fall.exam_type.value == "EXAM"

    spring = terms_by_term["SPRING"]
    assert spring.credits == approx(4.0)
    assert spring.weekly_hours == 2
    assert spring.lecture_count == 18
    assert spring.practice_count == 12
    assert spring.practice_type.value == "SEMINAR"
    assert spring.exam_type.value == "CREDIT"


def test_course_grouper_falls_back_to_course_credits_when_term_credits_are_zero(
    course_grouper,
):
    course = ParsedCourseDetails(
        url="https://example.com/course/342277",
        title="Бюджетна система",
        id="342277",
        credits=4.0,
        hours=120,
        year=3,
        format="Формат 2015",
        status="рекомендовано",
        faculty="Факультет економічних наук",
        department="Кафедра фінансів",
        education_level="Бакалавр",
        academic_year="2025–2026",
        semesters=["Семестр 6"],
        specialties=[
            {"specialty": "Фінанси, банківська справа та страхування", "type": "Обов`язкова"}
        ],
        limits={"max_students": 30, "max_groups": 3, "group_size_min": 9, "group_size_max": 12},
        season_details={
            "Весна": {
                "credits": 0.0,
                "hours_per_week": 1,
                "lecture_hours": 8,
                "practice_hours": 6,
                "practice_type": "SEMINAR",
                "exam_type": "екзамен",
            }
        },
    )

    result = course_grouper.group_course_offerings([course])

    assert len(result) == 1
    grouped = result[0]
    assert len(grouped.offerings) == 1

    spring = grouped.offerings[0]
    assert spring.credits == approx(4.0)
    assert spring.weekly_hours == 1


def test_course_grouper_treats_ispyt_as_exam(course_grouper):
    course = ParsedCourseDetails(
        url="https://example.com/course/365146",
        title="Дискретна математика",
        id="365146",
        credits=8.0,
        hours=240,
        year=1,
        format="Формат 2015",
        status="рекомендовано",
        faculty="Факультет інформатики",
        department="Кафедра математики",
        education_level="Бакалавр",
        academic_year="2026–2027",
        semesters=["Семестр 1", "Семестр 2"],
        specialties=[{"specialty": "Комп`ютерні науки", "type": "Обов`язкова"}],
        limits={"max_students": 30, "max_groups": 1, "group_size_min": 25, "group_size_max": 31},
        season_details={
            "Осінь": {
                "credits": 4.0,
                "hours_per_week": 3,
                "lecture_hours": 28,
                "practice_hours": 14,
                "practice_type": "SEMINAR",
                "exam_type": "іспит",
            }
        },
    )

    result = course_grouper.group_course_offerings([course])

    assert len(result) == 1
    assert result[0].offerings[0].exam_type.value == "EXAM"
