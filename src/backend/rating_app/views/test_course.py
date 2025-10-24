from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import pytest

from rating_app.tests.factories import CourseFactory


@pytest.fixture
def token_client(db):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="student", email="student@ukma.edu.ua", password="pass123"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def course_factory():
    return CourseFactory


@pytest.mark.django_db
def test_courses_list_no_filters(token_client, course_factory):
    # Arrange
    num_courses = 5
    course_factory.create_batch(num_courses)
    url = "/api/v1/courses/"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == num_courses
    assert len(data["items"]) == num_courses


@pytest.mark.django_db
def test_courses_paging(token_client, course_factory):
    # Arrange
    num_courses = 7
    page = 2
    page_size = 3
    course_factory.create_batch(num_courses)
    url = f"/api/v1/courses/?page={page}&page_size={page_size}"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == num_courses
    assert data["page"] == page
    assert data["page_size"] == page_size
    assert len(data["items"]) <= page_size


@pytest.mark.django_db
def test_filter_by_department_and_faculty(token_client, course_factory):
    # Arrange
    course = course_factory.create()
    department_id = course.department.id
    faculty_id = course.department.faculty.id
    url = f"/api/v1/courses/?department={department_id}&faculty={faculty_id}"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    for result in data["items"]:
        assert result["department"] == str(department_id)


@pytest.mark.django_db
def test_filter_by_instructor(token_client, course_factory):
    # Arrange
    course = course_factory.create()
    instructor_id = course.department.faculty.id  # Use faculty as a stand-in for instructor
    url = f"/api/v1/courses/?instructor={instructor_id}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"


@pytest.mark.django_db
def test_filter_by_name(token_client, course_factory):
    # Arrange
    unique_title = "UniqueCourseTitle123"
    course_factory.create(title=unique_title)
    url = f"/api/v1/courses/?name={unique_title}"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert any(unique_title in item["title"] for item in data["items"])


@pytest.mark.django_db
def test_filter_by_semester(token_client, course_factory):
    # Arrange
    semester_year = 2024
    semester_term = "FALL"
    course_factory.create()
    url = f"/api/v1/courses/?semesterYear={semester_year}&semesterTerm={semester_term}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
def test_filter_by_speciality_and_typekind(token_client, course_factory):
    # Arrange
    speciality_id = "00000000-0000-0000-0000-000000000000"
    type_kind = "COMPULSORY"
    course_factory.create()
    url = f"/api/v1/courses/?speciality={speciality_id}&typeKind={type_kind}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"


@pytest.mark.django_db
def test_sorting_params(token_client, course_factory):
    # Arrange
    course_factory.create_batch(3)
    url = "/api/v1/courses/?avg_difficulty_order=asc&avg_usefulness_order=desc"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"


@pytest.mark.django_db
def test_invalid_semester_term(course_factory, token_client):
    # Arrange
    course_factory.create_batch(3)
    invalid_semester_term = "INVALID_TERM"
    url = f"/api/v1/courses/?semesterTerm={invalid_semester_term}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"


@pytest.mark.django_db
def test_non_existent_department(course_factory, token_client):
    import uuid

    # Arrange
    course_factory.create_batch(10)
    invalid_department_uuid = uuid.uuid4()
    url = f"/api/v1/courses/?department={invalid_department_uuid}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    assert response.json().get("total", 0) == 0


@pytest.mark.django_db
def test_course_retrieve(course_factory, token_client):
    # Arrange
    existing = course_factory()
    existing_id = existing.id
    url = f"/api/v1/courses/{existing_id}/"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
def test_non_existent_course_retrieve(course_factory, token_client):
    import uuid

    # Arrange
    course_factory.create_batch(10)
    rand_id = uuid.uuid4()
    url = f"/api/v1/courses/{rand_id}/"
    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 404


@pytest.mark.django_db
def test__to_int_and__to_bool(monkeypatch):
    # Avoid constructing a real service during __init__
    from rating_app.views.course_viewset import CourseViewSet

    monkeypatch.setattr(
        "rating_app.views.course_viewset.course_service",
        lambda: object(),
        raising=True,
    )

    vs = CourseViewSet()

    assert vs._to_int(None, default=7) == 7
    assert vs._to_int("12", default=0) == 12
    assert vs._to_int("abc", default=5) == 5

    # _to_bool branches
    assert vs._to_bool(None) is None
    assert vs._to_bool("true") is True
    assert vs._to_bool("1") is True
    assert vs._to_bool("yes") is True
    assert vs._to_bool("false") is False
    assert vs._to_bool("0") is False
    assert vs._to_bool("no") is False
