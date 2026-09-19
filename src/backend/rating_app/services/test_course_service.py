from unittest.mock import MagicMock

import pytest

from rating_app.services.course_service import CourseService


@pytest.fixture
def course_repo():
    return MagicMock()


@pytest.fixture
def instructor_service():
    return MagicMock()


@pytest.fixture
def faculty_service():
    return MagicMock()


@pytest.fixture
def department_service():
    return MagicMock()


@pytest.fixture
def speciality_service():
    return MagicMock()


@pytest.fixture
def semester_service():
    return MagicMock()


@pytest.fixture
def service(
    course_repo,
    instructor_service,
    faculty_service,
    department_service,
    speciality_service,
    semester_service,
):
    return CourseService(
        course_repository=course_repo,
        instructor_service=instructor_service,
        faculty_service=faculty_service,
        department_service=department_service,
        speciality_service=speciality_service,
        semester_service=semester_service,
    )


def test_get_filter_options_aggregates_options_from_all_services(
    service,
    instructor_service,
    faculty_service,
    department_service,
    speciality_service,
    semester_service,
):
    # Arrange
    instructor_service.get_filter_options.return_value = [{"value": "1", "label": "Instructor 1"}]
    faculty_service.get_filter_options.return_value = [{"id": "fac-1", "name": "Faculty 1"}]
    department_service.get_filter_options.return_value = [
        {"id": "dept-1", "name": "Dept 1", "faculty_id": "fac-1"}
    ]
    speciality_service.get_filter_options.return_value = [
        {"id": "spec-1", "name": "Spec 1", "faculty_id": "fac-1"}
    ]
    semester_service.get_filter_options.return_value = {
        "terms": [{"value": "FALL", "label": "Fall"}],
        "years": [{"value": "2024", "label": "2024"}],
    }

    # Act
    result = service.get_filter_options()

    # Assert
    assert result.instructors == [{"value": "1", "label": "Instructor 1"}]
    assert len(result.faculties) == 1
    assert result.faculties[0]["id"] == "fac-1"
    assert result.faculties[0]["name"] == "Faculty 1"
    assert len(result.faculties[0]["departments"]) == 1
    assert result.faculties[0]["departments"][0]["id"] == "dept-1"
    assert result.faculties[0]["departments"][0]["name"] == "Dept 1"
    assert len(result.faculties[0]["specialities"]) == 1
    assert result.faculties[0]["specialities"][0]["id"] == "spec-1"
    assert result.faculties[0]["specialities"][0]["name"] == "Spec 1"
    assert result.semester_terms == [{"value": "FALL", "label": "Fall"}]
    assert result.semester_years == [{"value": "2024", "label": "2024"}]
    assert len(result.course_types) > 0


def test_get_filter_options_includes_all_course_type_choices(service, semester_service):
    # Arrange
    semester_service.get_filter_options.return_value = {"terms": [], "years": []}

    # Act
    result = service.get_filter_options()

    # Assert
    course_type_values = [ct["value"] for ct in result.course_types]
    assert "COMPULSORY" in course_type_values
    assert "ELECTIVE" in course_type_values
    assert "PROF_ORIENTED" in course_type_values
