import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from scraper.models import ParsedCourseDetails
from scraper.services.deduplication.grouper import CourseGrouper
from scraper.services.deduplication.grouping_service import CourseGroupingService
from scraper.services.deduplication.loader import CourseLoader


@pytest.fixture
def sample_course_data_dict():
    return {
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
        "academic_year": "2025–2026",
        "semesters": ["семестр 3"],
        "teachers": "Петренко І.П., д.т.н., Ковальчук С.М., к.ф.-м.н.",
        "annotation": "Основні концепції веб-розробки, HTML, CSS,\
              JavaScript та сучасні фреймворки.",
        "specialties": [
            {"specialty": "Програмна інженерія", "type": "Бакалавр"},
            {"specialty": "Інформатика", "type": "Магістр"},
        ],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
        "students": [
            {"index": "1", "name": "Петренко Олександр Петрович"},
            {"index": "2", "name": "Коваленко Марія Сергіївна"},
            {"index": "3", "name": "Шевченко Андрій Володимирович"},
        ],
    }


@pytest.fixture
def sample_course():
    data = {
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "id": "550001",
        "credits": 4.0,
        "hours": 120,
        "year": 3,
        "format": "2015",
        "status": "Курс відбувся",
        "faculty": "Факультет інформатики",
        "department": "Кафедра програмної інженерії",
        "education_level": "Бакалавр",
        "academic_year": "2025–2026",
        "semesters": ["семестр 3"],
        "teachers": "Петренко І.П., д.т.н.",
        "annotation": "Основні концепції веб-розробки, HTML, CSS,\
              JavaScript та сучасні фреймворки.",
        "specialties": [{"specialty": "Програмна інженерія", "type": "Бакалавр"}],
        "limits": {
            "max_students": 30,
            "max_groups": 3,
            "group_size_min": 8,
            "group_size_max": 15,
        },
        "students": [
            {"index": "1", "name": "Петренко Олександр Петрович"},
            {"index": "2", "name": "Коваленко Марія Сергіївна"},
        ],
    }
    return ParsedCourseDetails(**data)


@pytest.fixture
def duplicate_course_variants():
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
        "academic_year": "2025–2026",
        "semesters": ["семестр 3"],
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
    }

    course1 = base_data.copy()
    course1["students"] = [
        {"index": "1", "name": "Петренко Олександр Петрович"},
        {"index": "2", "name": "Коваленко Марія Сергіївна"},
    ]

    course2 = base_data.copy()
    course2["students"] = [
        {"index": "3", "name": "Шевченко Андрій Володимирович"},
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
    course_data = [
        {
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
            "academic_year": "2025–2026",
            "semesters": ["семестр 3"],
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
            "students": [
                {"index": "1", "name": "Петренко Олександр Петрович"},
                {"index": "2", "name": "Коваленко Марія Сергіївна"},
                {"index": "3", "name": "Шевченко Андрій Володимирович"},
            ],
        },
        {
            "url": "https://my.ukma.edu.ua/course/550002",
            "title": "Структури даних та алгоритми",
            "id": "550002",
            "credits": 3.0,
            "hours": 90,
            "year": 3,
            "format": "2015",
            "status": "Курс відбувся",
            "faculty": "Факультет інформатики",
            "department": "Кафедра теоретичної інформатики",
            "education_level": "Бакалавр",
            "academic_year": "2025–2026",
            "semesters": ["семестр 3"],
            "teachers": "Ковальчук С.М., к.ф.-м.н.",
            "annotation": "Вивчення основних структур даних та алгоритмів, аналіз їх ефективності.",
            "specialties": [{"specialty": "Інформатика", "type": "Професійно-орієнтована"}],
            "limits": {
                "max_students": 25,
                "max_groups": 2,
                "group_size_min": 10,
                "group_size_max": 20,
            },
            "students": [
                {"index": "1", "name": "Мельник Олена Іванівна"},
                {"index": "2", "name": "Бондаренко Дмитро Михайлович"},
                {"index": "3", "name": "Ткаченко Наталія Олександрівна"},
            ],
        },
    ]

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    ) as f:
        for course in course_data:
            f.write(json.dumps(course, ensure_ascii=False) + "\n")
        return Path(f.name)


@pytest.fixture
def temp_input_file_with_duplicates():
    duplicate_course_data = [
        {
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
            "academic_year": "2025–2026",
            "semesters": ["семестр 3"],
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
            "students": [
                {"index": "1", "name": "Петренко Олександр Петрович"},
                {"index": "2", "name": "Коваленко Марія Сергіївна"},
            ],
        },
        {
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
            "academic_year": "2025–2026",
            "semesters": ["семестр 3"],
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
            "students": [
                {"index": "3", "name": "Шевченко Андрій Володимирович"},
                {"index": "4", "name": "Криворучка Максим Олександрович"},
            ],
        },
    ]

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    ) as f:
        for course in duplicate_course_data:
            f.write(json.dumps(course, ensure_ascii=False) + "\n")
        return Path(f.name)


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
        "url": "https://my.ukma.edu.ua/course/550001",
        "title": "Test Course",
        "academic_year": "2025–2026",
        "semesters": ["семестр 3"],
    }

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    ) as f:
        f.write(json.dumps(course_data_missing_id, ensure_ascii=False) + "\n")
        return Path(f.name)


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
