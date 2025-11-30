import pytest


@pytest.fixture
def analytics_url():
    return "/api/v1/analytics/"


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_list_no_filters(token_client, course_factory, analytics_url):
    # Arrange
    num_courses = 5
    course_factory.create_batch(num_courses)
    url = analytics_url

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert len(data) == num_courses


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_no_pagination(token_client, course_factory, analytics_url):
    # Arrange
    num_courses = 5
    course_factory.create_batch(num_courses)
    url = f"{analytics_url}?page=2&page_size=2"  # page and page_size are ignored

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert len(data) == num_courses


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_filter_applied(
    token_client, course_factory, rating_factory, course_offering_factory, analytics_url
):
    # Arrange
    math_course = course_factory.create(title="Math")
    physics_course = course_factory.create(title="Physics")
    offering_math = course_offering_factory(course=math_course)
    offering_physics = course_offering_factory(course=physics_course)
    rating_factory.create_batch(5, course_offering=offering_math)
    rating_factory.create_batch(5, course_offering=offering_physics)

    url = f"{analytics_url}?faculty={math_course.department.faculty.id}"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert len(data) == 1

    expected_data = {
        "id": str(math_course.id),
        "name": math_course.title,
        "faculty_name": math_course.department.faculty.name,
        "avg_difficulty": math_course.avg_difficulty,
        "avg_usefulness": math_course.avg_usefulness,
        "ratings_count": math_course.ratings_count,
    }

    for field, value in data[0].items():
        assert value == expected_data[field]


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_by_course_id(token_client, course_factory, analytics_url):
    # Arrange
    course = course_factory.create()
    url = f"{analytics_url}?course_id={course.id}"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert len(data) == 1
    assert data[0]["id"] == str(course.id)
    assert data[0]["name"] == course.title


@pytest.mark.django_db
@pytest.mark.integration
def test_invalid_filter_provided(course_factory, token_client, analytics_url):
    # Arrange
    course_factory.create_batch(3)
    url = f"{analytics_url}?semester_term=INVALID_TERM"

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 400
