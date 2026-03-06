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
    course_factory.create()
    url = f"/api/v1/courses/?semester_year={semester_year}&semester_terms=FALL"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_credits_range_requires_semester_year(token_client, course_factory):
    # Arrange
    course_factory.create()
    url = "/api/v1/courses/?credits_min=3.0&credits_max=4.0"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_credits_range_with_semester_year(
    token_client, course_factory, course_offering_factory, semester_factory
):
    # Arrange
    matching_course = course_factory.create()
    non_matching_course = course_factory.create()

    target_semester = semester_factory(term="FALL", year=2024)
    other_semester = semester_factory(term="FALL", year=2023)

    course_offering_factory(
        course=matching_course,
        semester=target_semester,
        credits=4.0,
    )
    course_offering_factory(
        course=non_matching_course,
        semester=target_semester,
        credits=3.0,
    )
    course_offering_factory(
        course=non_matching_course,
        semester=other_semester,
        credits=4.0,
    )

    url = "/api/v1/courses/?semester_year=2024–2025&credits_min=3.5&credits_max=4.5"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    data = response.json()
    returned_ids = {item["id"] for item in data["items"]}
    assert str(matching_course.id) in returned_ids
    assert str(non_matching_course.id) not in returned_ids


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_speciality_and_typekind(
    token_client,
    course_factory,
    course_offering_factory,
    course_offering_speciality_factory,
):
    # Arrange
    course = course_factory.create()
    offering = course_offering_factory.create(course=course)
    cos = course_offering_speciality_factory.create(offering=offering, type_kind="COMPULSORY")
    speciality_id = cos.speciality.id
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
    url = "/api/v1/courses/?semester_terms=INVALID_TERM"

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
        f"&semester_year=2024–2025&semester_terms=FALL"
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
def test_course_is_elective_for_speciality_if_no_explicit_type_assigned(
    token_client,
    course_factory,
    course_offering_factory,
    speciality_factory,
    course_offering_speciality_factory,
):
    # Arrange
    course = course_factory()
    offering = course_offering_factory(course=course)
    speciality_1 = speciality_factory()
    speciality_2 = speciality_factory()

    course_offering_speciality_factory(
        offering=offering,
        speciality=speciality_1,
        type_kind="COMPULSORY",
    )

    url = f"/api/v1/courses/?type_kind=ELECTIVE&speciality={speciality_2.id}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200

    data = response.json()
    print(data)
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == str(course.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_course_is_elective_for_speciality_if_no_type_assigned(
    token_client,
    course_factory,
    course_offering_factory,
    speciality_factory,
    course_offering_speciality_factory,
):
    # Arrange
    course = course_factory()
    speciality = speciality_factory()

    url = f"/api/v1/courses/?type_kind=ELECTIVE&speciality={speciality.id}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200

    data = response.json()
    print(data)
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == str(course.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_by_elective_type_kind(
    token_client,
    course_factory,
    course_offering_factory,
    speciality_factory,
    course_offering_speciality_factory,
):
    # Arrange
    course = course_factory()
    offering = course_offering_factory(course=course)
    speciality = speciality_factory()

    course_offering_speciality_factory(
        offering=offering,
        speciality=speciality,
        type_kind="ELECTIVE",
    )

    url = f"/api/v1/courses/?type_kind=ELECTIVE&speciality={speciality.id}"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200

    data = response.json()
    print(data)
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == str(course.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_type_kind_without_speciality_fails(
    token_client,
    course_factory,
    course_offering_factory,
    speciality_factory,
    course_offering_speciality_factory,
):
    # Arrange
    course = course_factory()
    offering = course_offering_factory(course=course)
    speciality = speciality_factory()

    course_offering_speciality_factory(
        offering=offering,
        speciality=speciality,
        type_kind="ELECTIVE",
    )

    url = "/api/v1/courses/?type_kind=COMPULSORY"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_speciality_without_type_kind(
    token_client,
    course_factory,
    course_offering_factory,
    speciality_factory,
    course_offering_speciality_factory,
):
    # Arrange
    course_1 = course_factory()
    course_2 = course_factory()
    offering_1 = course_offering_factory(course=course_1)
    offering_2 = course_offering_factory(course=course_2)
    speciality = speciality_factory()

    course_offering_speciality_factory(
        offering=offering_1,
        speciality=speciality,
        type_kind="ELECTIVE",
    )
    course_offering_speciality_factory(
        offering=offering_2,
        speciality=speciality,
        type_kind="COMPULSORY",
    )

    url = f"/api/v1/courses/?speciality={speciality.id}"

    # Act
    response = token_client.get(url)

    data = response.json()

    # Assert
    assert response.status_code == 200
    assert len(data["items"]) == 2


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
def test_sorting_preserves_order_with_various_ratings(token_client, course_factory):
    """Test that courses are sorted correctly by avg_difficulty and avg_usefulness.

    Courses with ratings_count=0 should always appear at the end regardless of sort direction.
    """
    course_medium = course_factory.create()
    course_medium.avg_difficulty = 3.0
    course_medium.avg_usefulness = 4.0
    course_medium.ratings_count = 5
    course_medium.save()

    course_low = course_factory.create()
    course_low.avg_difficulty = 1.5
    course_low.avg_usefulness = 2.5
    course_low.ratings_count = 3
    course_low.save()

    course_high = course_factory.create()
    course_high.avg_difficulty = 4.5
    course_high.avg_usefulness = 4.8
    course_high.ratings_count = 8
    course_high.save()

    course_no_ratings = course_factory.create()
    course_no_ratings.avg_difficulty = 0.0
    course_no_ratings.avg_usefulness = 0.0
    course_no_ratings.ratings_count = 0
    course_no_ratings.save()

    url_diff_asc = "/api/v1/courses/?avg_difficulty_order=asc&page_size=10"
    response_diff_asc = token_client.get(url_diff_asc)
    assert response_diff_asc.status_code == 200
    items_diff_asc = response_diff_asc.json()["items"]

    assert [item["id"] for item in items_diff_asc[:4]] == [
        str(course_low.id),
        str(course_medium.id),
        str(course_high.id),
        str(course_no_ratings.id),
    ]
    assert items_diff_asc[3]["ratings_count"] == 0

    url_diff_desc = "/api/v1/courses/?avg_difficulty_order=desc&page_size=10"
    response_diff_desc = token_client.get(url_diff_desc)
    assert response_diff_desc.status_code == 200
    items_diff_desc = response_diff_desc.json()["items"]

    assert [item["id"] for item in items_diff_desc[:4]] == [
        str(course_high.id),
        str(course_medium.id),
        str(course_low.id),
        str(course_no_ratings.id),
    ]
    assert items_diff_desc[3]["ratings_count"] == 0

    url_use_asc = "/api/v1/courses/?avg_usefulness_order=asc&page_size=10"
    response_use_asc = token_client.get(url_use_asc)
    assert response_use_asc.status_code == 200
    items_use_asc = response_use_asc.json()["items"]

    assert [item["id"] for item in items_use_asc[:4]] == [
        str(course_low.id),
        str(course_medium.id),
        str(course_high.id),
        str(course_no_ratings.id),
    ]
    assert items_use_asc[3]["ratings_count"] == 0

    url_use_desc = "/api/v1/courses/?avg_usefulness_order=desc&page_size=10"
    response_use_desc = token_client.get(url_use_desc)
    assert response_use_desc.status_code == 200
    items_use_desc = response_use_desc.json()["items"]

    assert [item["id"] for item in items_use_desc[:4]] == [
        str(course_high.id),
        str(course_medium.id),
        str(course_low.id),
        str(course_no_ratings.id),
    ]
    assert items_use_desc[3]["ratings_count"] == 0
