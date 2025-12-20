from unittest.mock import MagicMock

import pytest

from rating_app.application_schemas.course import CourseFilterCriteria
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
def pagination_course_adapter():
    mock_adapter = MagicMock()
    mock_adapter.paginate.return_value = MagicMock()
    return mock_adapter


@pytest.fixture
def service(
    course_repo,
    instructor_service,
    faculty_service,
    department_service,
    speciality_service,
    semester_service,
    pagination_course_adapter,
):
    return CourseService(
        pagination_course_adapter=pagination_course_adapter,
        course_repository=course_repo,
        instructor_service=instructor_service,
        faculty_service=faculty_service,
        department_service=department_service,
        speciality_service=speciality_service,
        semester_service=semester_service,
    )


def test_list_courses_returns_all_courses_from_repository(service, course_repo):
    expected_courses = [MagicMock(), MagicMock()]
    course_repo.get_all.return_value = expected_courses

    result = service.list_courses()

    assert result == expected_courses
    course_repo.get_all.assert_called_once()


def test_get_course_returns_course_by_id(service, course_repo):
    course_id = "course-123"
    expected_course = MagicMock()
    course_repo.get_by_id.return_value = expected_course

    result = service.get_course(course_id)

    assert result == expected_course
    course_repo.get_by_id.assert_called_once_with(course_id)


def test_filter_courses_returns_paginated_result_when_paginate_true(
    service, pagination_course_adapter
):
    # Arrange
    filters = CourseFilterCriteria()
    mock_search_result = MagicMock()
    pagination_course_adapter.paginate.return_value = mock_search_result

    # Act
    result = service.filter_courses(filters, paginate=True)

    # Assert
    assert result == mock_search_result
    pagination_course_adapter.paginate.assert_called_once_with(filters)


def test_filter_courses_returns_all_items_when_paginate_false(service, course_repo):
    # Arrange
    filters = CourseFilterCriteria()
    mock_courses = [MagicMock(), MagicMock()]
    course_repo.filter.return_value = mock_courses

    # Act
    result = service.filter_courses(filters, paginate=False)

    # Assert
    assert len(result.items) == 2
    assert result.items == mock_courses
    assert result.pagination.page == 1
    assert result.pagination.total == 2
    assert result.pagination.total_pages == 1
    course_repo.filter.assert_called_once_with(filters)


def test_filter_courses_uses_custom_page_size(service, pagination_course_adapter):
    # Arrange
    filters = CourseFilterCriteria(page=2, page_size=25)
    mock_search_result = MagicMock()
    pagination_course_adapter.paginate.return_value = mock_search_result

    # Act
    result = service.filter_courses(filters, paginate=True)

    # Assert
    assert result == mock_search_result
    pagination_course_adapter.paginate.assert_called_once_with(filters)


def test_create_course_returns_created_course(service, course_repo):
    # Arrange
    course_data = {"title": "Test Course", "description": "Description"}
    expected_course = MagicMock()
    course_repo.get_or_create.return_value = (expected_course, True)

    # Act
    result = service.create_course(**course_data)

    # Assert
    assert result == expected_course
    course_repo.get_or_create.assert_called_once_with(**course_data)


def test_create_course_returns_existing_course_when_already_exists(service, course_repo):
    # Arrange
    course_data = {"title": "Existing Course"}
    existing_course = MagicMock()
    course_repo.get_or_create.return_value = (existing_course, False)

    # Act
    result = service.create_course(**course_data)

    # Assert
    assert result == existing_course


def test_update_course_updates_and_returns_course(service, course_repo):
    # Arrange
    course_id = "course-123"
    update_data = {"title": "Updated Title"}
    existing_course = MagicMock()
    updated_course = MagicMock()
    course_repo.get_by_id.return_value = existing_course
    course_repo.update.return_value = updated_course

    # Act
    result = service.update_course(course_id, **update_data)

    # Assert
    assert result == updated_course
    course_repo.get_by_id.assert_called_once_with(course_id)
    course_repo.update.assert_called_once_with(existing_course, **update_data)


def test_update_course_returns_none_when_course_not_found(service, course_repo):
    # Arrange
    course_id = "nonexistent"
    course_repo.get_by_id.side_effect = Exception("Course not found")

    # Act
    result = service.update_course(course_id, title="New Title")

    # Assert
    assert result is None
    course_repo.update.assert_not_called()


def test_delete_course_deletes_course_by_id(service, course_repo):
    # Arrange
    course_id = "course-123"
    course = MagicMock()
    course_repo.get_by_id.return_value = course

    # Act
    service.delete_course(course_id)

    # Assert
    course_repo.get_by_id.assert_called_once_with(course_id)
    course_repo.delete.assert_called_once_with(course)


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
