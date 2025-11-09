import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from scraper.models import ParsedCourseDetails
from scraper.services.deduplication.grouper import CourseGrouper
from scraper.services.deduplication.grouping_service import CourseGroupingService
from scraper.services.deduplication.loader import CourseLoader

COURSE_URL = "https://my.ukma.edu.ua/course/550001"
COURSE_URL_2 = "https://my.ukma.edu.ua/course/550002"
COURSE_TITLE = "Веб-розробка: основи та практики"
COURSE_STATUS = "Курс відбувся"
FACULTY_NAME = "Факультет інформатики"
DEPARTMENT_NAME = "Кафедра програмної інженерії"
EDUCATION_LEVEL = "Бакалавр"
ACADEMIC_YEAR = "2025–2026"
SEMESTER = "семестр 3"
TEACHER_NAME = "Петренко І.П., д.т.н."
SPECIALTY_NAME = "Програмна інженерія"
SPECIALTY_TYPE = "Професійно-орієнтована"
COURSE_ANNOTATION = "Основні концепції веб-розробки, HTML, CSS, JavaScript та сучасні фреймворки."
STUDENT_NAME_1 = "Петренко Олександр Петрович"
STUDENT_NAME_2 = "Коваленко Марія Сергіївна"
STUDENT_NAME_3 = "Шевченко Андрій Володимирович"


def create_temp_jsonl_file(course_list: list) -> Path:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    ) as f:
        for course in course_list:
            f.write(json.dumps(course, ensure_ascii=False) + "\n")
        return Path(f.name)


BASE_COURSE_DICT = {
    "url": COURSE_URL,
    "title": COURSE_TITLE,
    "id": "550001",
    "credits": 4.0,
    "hours": 120,
    "year": 3,
    "format": "2015",
    "status": COURSE_STATUS,
    "faculty": FACULTY_NAME,
    "department": DEPARTMENT_NAME,
    "education_level": EDUCATION_LEVEL,
    "academic_year": ACADEMIC_YEAR,
    "semesters": [SEMESTER],
    "teachers": TEACHER_NAME,
    "annotation": COURSE_ANNOTATION,
    "specialties": [{"specialty": SPECIALTY_NAME, "type": SPECIALTY_TYPE}],
    "limits": {
        "max_students": 30,
        "max_groups": 3,
        "group_size_min": 8,
        "group_size_max": 15,
    },
}

BASE_COURSE_2_DICT = {
    "url": COURSE_URL_2,
    "title": "Структури даних та алгоритми",
    "id": "550002",
    "credits": 3.0,
    "hours": 90,
    "year": 3,
    "format": "2015",
    "status": COURSE_STATUS,
    "faculty": FACULTY_NAME,
    "department": "Кафедра теоретичної інформатики",
    "education_level": EDUCATION_LEVEL,
    "academic_year": ACADEMIC_YEAR,
    "semesters": [SEMESTER],
    "teachers": "Ковальчук С.М., к.ф.-м.н.",
    "annotation": "Вивчення основних структур даних та алгоритмів, аналіз їх ефективності.",
    "specialties": [{"specialty": "Інформатика", "type": SPECIALTY_TYPE}],
    "limits": {
        "max_students": 25,
        "max_groups": 2,
        "group_size_min": 10,
        "group_size_max": 20,
    },
}


@pytest.fixture
def sample_course_data_dict():
    return {
        "url": COURSE_URL,
        "title": COURSE_TITLE,
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "format": "2015",
        "status": COURSE_STATUS,
        "faculty": FACULTY_NAME,
        "department": DEPARTMENT_NAME,
        "education_level": EDUCATION_LEVEL,
        "academic_year": ACADEMIC_YEAR,
        "semesters": [SEMESTER],
        "teachers": "Петренко І.П., д.т.н., Ковальчук С.М., к.ф.-м.н.",
        "annotation": COURSE_ANNOTATION,
        "specialties": [
            {"specialty": SPECIALTY_NAME, "type": EDUCATION_LEVEL},
            {"specialty": "Інформатика", "type": "Магістр"},
        ],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
        "students": [
            {"index": "1", "name": STUDENT_NAME_1},
            {"index": "2", "name": STUDENT_NAME_2},
            {"index": "3", "name": STUDENT_NAME_3},
        ],
    }


@pytest.fixture
def sample_course():
    data = {
        "url": COURSE_URL,
        "title": "Test Course",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "format": "2015",
        "status": COURSE_STATUS,
        "faculty": FACULTY_NAME,
        "department": DEPARTMENT_NAME,
        "education_level": EDUCATION_LEVEL,
        "academic_year": ACADEMIC_YEAR,
        "semesters": [SEMESTER],
        "teachers": TEACHER_NAME,
        "annotation": COURSE_ANNOTATION,
        "specialties": [{"specialty": SPECIALTY_NAME, "type": EDUCATION_LEVEL}],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
        "students": [
            {"index": "1", "name": STUDENT_NAME_1},
            {"index": "2", "name": STUDENT_NAME_2},
        ],
    }
    return ParsedCourseDetails(**data)


@pytest.fixture
def duplicate_course_variants():
    base_data = {
        "url": COURSE_URL,
        "title": COURSE_TITLE,
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "format": "2015",
        "status": COURSE_STATUS,
        "faculty": FACULTY_NAME,
        "department": DEPARTMENT_NAME,
        "education_level": EDUCATION_LEVEL,
        "academic_year": ACADEMIC_YEAR,
        "semesters": [SEMESTER],
        "teachers": TEACHER_NAME,
        "annotation": COURSE_ANNOTATION,
        "specialties": [{"specialty": SPECIALTY_NAME, "type": SPECIALTY_TYPE}],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
    }

    course1 = base_data.copy()
    course1["students"] = [
        {"index": "1", "name": STUDENT_NAME_1},
        {"index": "2", "name": STUDENT_NAME_2},
    ]

    course2 = base_data.copy()
    course2["students"] = [
        {"index": "3", "name": STUDENT_NAME_3},
        {"index": "4", "name": "Криворучка Максим Олександрович"},
    ]

    course3 = base_data.copy()
    course3["title"] = "Структури даних та алгоритми"
    course3["id"] = "550002"
    course3["students"] = [
        {"index": "1", "name": "Мельник Олена Іванівна"},
    ]

    return [
        ParsedCourseDetails(**course1),
        ParsedCourseDetails(**course2),
        ParsedCourseDetails(**course3),
    ]


@pytest.fixture
def temp_input_file():
    course1 = BASE_COURSE_DICT.copy()
    course1["students"] = [
        {"index": "1", "name": STUDENT_NAME_1},
        {"index": "2", "name": STUDENT_NAME_2},
        {"index": "3", "name": STUDENT_NAME_3},
    ]

    course2 = BASE_COURSE_2_DICT.copy()
    course2["students"] = [
        {"index": "1", "name": "Мельник Олена Іванівна"},
        {"index": "2", "name": "Бондаренко Дмитро Михайлович"},
        {"index": "3", "name": "Ткаченко Наталія Олександрівна"},
    ]

    return create_temp_jsonl_file([course1, course2])


@pytest.fixture
def temp_input_file_with_duplicates():
    course1 = BASE_COURSE_DICT.copy()
    course1["students"] = [
        {"index": "1", "name": STUDENT_NAME_1},
        {"index": "2", "name": STUDENT_NAME_2},
    ]

    course2 = BASE_COURSE_DICT.copy()
    course2["students"] = [
        {"index": "3", "name": STUDENT_NAME_3},
        {"index": "4", "name": "Криворучка Максим Олександрович"},
    ]

    duplicate_course_data = [course1, course2]
    return create_temp_jsonl_file(duplicate_course_data)


@pytest.fixture
def temp_invalid_json_file():
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    ) as f:
        f.write('{"invalid": json}\n')
        return Path(f.name)


@pytest.fixture
def temp_missing_id_file():
    course_data_missing_id = {
        "url": COURSE_URL,
        "title": "Test Course",
        "academic_year": ACADEMIC_YEAR,
        "semesters": [SEMESTER],
    }
    return create_temp_jsonl_file([course_data_missing_id])


@pytest.fixture
def course_loader():
    return CourseLoader()


@pytest.fixture
def course_grouper():
    return CourseGrouper()


@pytest.fixture
def course_grouper_service():
    return CourseGroupingService()


@pytest.fixture
def mock_jsonl_writer():
    with patch("scraper.services.deduplication.grouping_service.JSONLWriter") as mock:
        yield mock
