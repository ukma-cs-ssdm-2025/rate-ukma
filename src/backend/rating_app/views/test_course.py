import uuid

import pytest


@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
def test_filter_by_instructor(
    token_client,
    course_factory,
    course_offering_factory,
    instructor_factory,
    course_instructor_factory,
):
    # Arrange
    course = course_factory.create()
    offering = course_offering_factory.create(course=course)
    instructor = instructor_factory.create()
    course_instructor_factory.create(course_offering=offering, instructor=instructor)

    url = f"/api/v1/courses/?instructor={instructor.id}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"


@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
def test_filter_by_semester(token_client, course_factory):
    # Arrange
    semester_year = "2024–2025"
    semester_term = "FALL"
    course_factory.create()
    url = f"/api/v1/courses/?semester_year={semester_year}&semester_term={semester_term}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_speciality_and_typekind(token_client, course_factory, course_speciality_factory):
    # Arrange
    course = course_factory.create()
    cs = course_speciality_factory.create(course=course, type_kind="COMPULSORY")
    speciality_id = cs.speciality.id
    url = f"/api/v1/courses/?speciality={speciality_id}&typeKind=COMPULSORY"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"


@pytest.mark.django_db
@pytest.mark.integration
def test_sorting_params(token_client, course_factory):
    # Arrange
    course_factory.create_batch(3)
    url = "/api/v1/courses/?avg_difficulty_order=asc&avg_usefulness_order=desc"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"


@pytest.mark.django_db
@pytest.mark.integration
def test_invalid_semester_term(course_factory, token_client):
    # Arrange
    course_factory.create_batch(3)
    url = "/api/v1/courses/?semester_term=INVALID_TERM"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"


@pytest.mark.django_db
@pytest.mark.integration
def test_non_existent_department(course_factory, token_client):
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
@pytest.mark.integration
def test_course_retrieve(course_factory, token_client):
    # Arrange
    existing = course_factory()
    url = f"/api/v1/courses/{existing.id}/"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.integration
def test_non_existent_course_retrieve(course_factory, token_client):
    # Arrange
    course_factory.create_batch(10)
    rand_id = uuid.uuid4()
    url = f"/api/v1/courses/{rand_id}/"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.integration
def test_course_list_pagination_last_page(token_client, course_factory):
    # Arrange
    total_courses = 12
    page_size = 5
    course_factory.create_batch(total_courses)
    url = f"/api/v1/courses/?page=3&page_size={page_size}"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert data["page"] == 3
    assert data["total"] == total_courses
    assert len(data["items"]) == 2  # Last page has only 2 items


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_multiple_parameters(
    token_client, course_factory, course_offering_factory, semester_factory
):
    semester = semester_factory(term="FALL", year=2024)
    course = course_factory()
    course_offering_factory(course=course, semester=semester)

    faculty_id = course.department.faculty.id
    department_id = course.department.id

    url = (
        f"/api/v1/courses/?department={department_id}&faculty={faculty_id}"
        f"&semester_year=2024–2025&semester_term=FALL"
    )

    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


@pytest.mark.django_db
@pytest.mark.integration
def test_course_list_with_avg_filters(token_client, course_factory):
    # Arrange
    course_factory.create_batch(5)
    url = "/api/v1/courses/?avg_difficulty_min=2&avg_difficulty_max=4"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.integration
def test_course_list_with_invalid_page_default_value(token_client, course_factory):
    # Arrange
    course_factory.create_batch(3)
    url = "/api/v1/courses/?page=999"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["total"] == 3
    assert len(data["items"]) == 3


@pytest.mark.django_db
@pytest.mark.integration
def test_course_retrieve_with_ratings(
    token_client, course_factory, course_offering_factory, rating_factory
):
    # Arrange
    course = course_factory()
    offering = course_offering_factory(course=course)
    rating_factory.create_batch(3, course_offering=offering, difficulty=4, usefulness=5)

    url = f"/api/v1/courses/{course.id}/"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "avg_difficulty" in data


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_type_kind(token_client, course_factory, course_speciality_factory):
    # Arrange
    course = course_factory()
    course_speciality_factory(course=course, type_kind="COMPULSORY")

    url = "/api/v1/courses/?type_kind=COMPULSORY"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.integration
def test_course_list_response_structure(token_client, course_factory):
    course_factory.create_batch(2)
    url = "/api/v1/courses/"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert isinstance(data["items"], list)


@pytest.mark.django_db
@pytest.mark.integration
def test_course_retrieve_invalid_uuid_format(token_client):
    # Arrange
    url = "/api/v1/courses/not-a-valid-uuid/"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_elective_business_rule(
    token_client, course_factory, course_speciality_factory, speciality_factory
):
    # Arrange
    spec = speciality_factory.create()
    diff_spec = speciality_factory.create()

    # 1. Compulsory course
    compulsory_course = course_factory.create(title="Compulsory")
    course_speciality_factory.create(
        course=compulsory_course, speciality=spec, type_kind="COMPULSORY"
    )

    # 2. Prof oriented course
    prof_oriented_course = course_factory.create(title="Prof Oriented")
    course_speciality_factory.create(
        course=prof_oriented_course, speciality=spec, type_kind="PROF_ORIENTED"
    )

    # 3. Elective course
    elective_course = course_factory.create(title="Elective")
    course_speciality_factory.create(course=elective_course, speciality=spec, type_kind="ELECTIVE")

    # 4. Prof oriented course for different speciality
    prof_oriented_course = course_factory.create(title="Prof Oriented for diff spec")
    course_speciality_factory.create(
        course=prof_oriented_course, speciality=diff_spec, type_kind="PROF_ORIENTED"
    )

    # 5. Elective course for different speciality
    elective_course = course_factory.create(title="Elective for diff spec")
    course_speciality_factory.create(
        course=elective_course, speciality=diff_spec, type_kind="ELECTIVE"
    )

    url = f"/api/v1/courses/?speciality={spec.id}&type_kind=ELECTIVE"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    data = response.json()
    returned_titles = {item["title"] for item in data["items"]}

    assert "Elective" in returned_titles
    assert "Elective for diff spec" in returned_titles
    assert "Prof Oriented for diff spec" in returned_titles
    assert "Compulsory" not in returned_titles
    assert "Prof Oriented" not in returned_titles
    assert len(returned_titles) == 3
