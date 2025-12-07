import pytest


@pytest.mark.django_db
@pytest.mark.integration
def test_course_offering_list_filters_by_course(
    token_client, course_factory, course_offering_factory
):
    course_one = course_factory()
    course_two = course_factory()
    course_offering_factory.create_batch(2, course=course_one)
    course_offering_factory.create_batch(1, course=course_two)

    url = f"/api/v1/courses/{course_one.id}/offerings/"
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert len(data["course_offerings"]) == 2
    assert all(offering["course_id"] == str(course_one.id) for offering in data["course_offerings"])


@pytest.mark.django_db
@pytest.mark.integration
def test_course_offering_detail_returns_offering(
    token_client, course_factory, course_offering_factory
):
    course = course_factory()
    offering = course_offering_factory(course=course)

    url = f"/api/v1/course-offerings/{offering.id}/"
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(offering.id)
    assert data["course_id"] == str(course.id)
