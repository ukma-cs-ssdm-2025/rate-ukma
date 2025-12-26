import pytest

from rating_app.ioc_container.repositories import rating_repository
from rating_app.ioc_container.services import course_service


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


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_no_n_plus_1_queries(
    token_client,
    course_factory,
    rating_factory,
    course_offering_factory,
    analytics_url,
    django_assert_num_queries,
):
    """Test that analytics endpoint doesn't have N+1 query problems."""
    # Arrange: Create multiple courses with departments and faculties
    courses = course_factory.create_batch(10)
    for course in courses:
        offering = course_offering_factory(course=course)
        rating_factory.create_batch(5, course_offering=offering)

    # Act & Assert: The number of queries should be constant regardless of course count
    # Expected queries:
    # 1. Main query with select_related(department__faculty) and annotations
    # 2. Prefetch course_specialities
    # 3. Prefetch offerings with semester
    # 4. Prefetch instructors for offerings
    # No additional queries should occur when accessing department.faculty in serializer
    with django_assert_num_queries(4):
        response = token_client.get(analytics_url)

    # Verify we got all courses
    data = response.json()
    assert response.status_code == 200
    assert len(data) == 10


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_single_course_no_n_plus_1(
    token_client,
    course_factory,
    rating_factory,
    course_offering_factory,
    analytics_url,
    django_assert_num_queries,
):
    """Test that fetching a single course analytics doesn't trigger extra queries."""
    # Arrange
    course = course_factory.create()
    offering = course_offering_factory(course=course)
    rating_factory.create_batch(5, course_offering=offering)

    url = f"{analytics_url}{course.id}/"

    # Act & Assert: Retrieving single course should use select_related for department/faculty
    # Expected queries:
    # 1. Main query with select_related(department__faculty) and annotations
    with django_assert_num_queries(1):
        response = token_client.get(url)

    # Verify response
    data = response.json()
    assert response.status_code == 200
    assert data["id"] == str(course.id)
    assert data["faculty_name"] == course.department.faculty.name


@pytest.mark.django_db
@pytest.mark.integration
def test_analytics_filter_by_ratings_count(
    token_client, course_factory, rating_factory, course_offering_factory, analytics_url
):
    # Arrange
    course_no_ratings = course_factory.create(title="No Ratings Course")
    course_with_ratings = course_factory.create(title="Popular Course")

    offering = course_offering_factory(course=course_with_ratings)
    rating_factory.create_batch(5, course_offering=offering)

    # Manually update aggregates
    stats = rating_repository().get_aggregated_course_stats(course_with_ratings)
    course_service().update_course_aggregates(course_with_ratings, stats)

    course_with_ratings.refresh_from_db()
    course_no_ratings.refresh_from_db()

    # Act
    url = f"{analytics_url}?ratings_count_min=1"
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert len(data) == 1
    assert data[0]["id"] == str(course_with_ratings.id)
    assert data[0]["ratings_count"] >= 1

    # Act (no filter)
    response_all = token_client.get(analytics_url)

    # Assert
    data_all = response_all.json()
    assert response_all.status_code == 200
    assert len(data_all) == 2
