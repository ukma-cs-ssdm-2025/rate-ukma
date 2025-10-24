from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import pytest

from rating_app.tests.factories import (
    CourseFactory,
    CourseOfferingFactory,
    EnrollmentFactory,
    RatingFactory,
    StudentFactory,
)


@pytest.fixture
def token_client(db):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="student", email="student@ukma.edu.ua", password="pass123"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def rating_factory():
    return RatingFactory


@pytest.fixture
def course_factory():
    return CourseFactory


@pytest.fixture
def course_offering_factory():
    return CourseOfferingFactory


@pytest.fixture
def enrollment_factory():
    return EnrollmentFactory


@pytest.mark.django_db
def test_ratings_list(token_client, course_factory, rating_factory):
    # Arrange
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)

    num_ratings = 4
    rating_factory.create_batch(num_ratings, course_offering=offering)
    url = f"/api/v1/courses/{course.id}/ratings/"

    # Act
    response = client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == num_ratings
    assert len(data["items"]) == num_ratings


@pytest.mark.django_db
def test_ratings_list_pagination(token_client, course_factory, rating_factory):
    # Arrange
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)

    total_ratings = 15
    rating_factory.create_batch(total_ratings, course_offering=offering)
    url = f"/api/v1/courses/{course.id}/ratings/?page=2&page_size=5"

    # Act
    response = client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == total_ratings
    assert data["page"] == 2
    assert data["page_size"] == 5
    assert len(data["items"]) == 5


@pytest.mark.django_db
def test_create_rating(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    student = StudentFactory(user=user)
    EnrollmentFactory(offering=offering, student=student)

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": offering.id,
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Great course!",
        "is_anonymous": False,
    }

    response = client.post(url, data=payload, format="json")
    assert response.status_code == 201, response.data


@pytest.mark.django_db
def test_delete_rating(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    student = StudentFactory(user=user)
    EnrollmentFactory(offering=offering, student=student)
    rating_factory = RatingFactory(
        course_offering=offering, student=student, difficulty=3, usefulness=4
    )

    url = f"/api/v1/courses/{course.id}/ratings/{rating_factory.id}/"

    response = client.delete(url)

    assert response.status_code == 204


@pytest.mark.django_db
def test_update_rating(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    student = StudentFactory(user=user)
    EnrollmentFactory(offering=offering, student=student)
    rating_factory = RatingFactory(
        course_offering=offering, student=student, difficulty=3, usefulness=4
    )

    url = f"/api/v1/courses/{course.id}/ratings/{rating_factory.id}/"

    payload = {
        "course_offering": offering.id,
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Different comm!",
        "is_anonymous": False,
    }

    response = client.put(url, data=payload, format="json")

    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_patch_rating(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    student = StudentFactory(user=user)
    EnrollmentFactory(offering=offering, student=student)
    rating_factory = RatingFactory(
        course_offering=offering, student=student, difficulty=3, usefulness=4
    )

    url = f"/api/v1/courses/{course.id}/ratings/{rating_factory.id}/"

    payload = {
        "comment": "Different comm!",
    }

    response = client.patch(url, data=payload, format="json")

    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_create_rating_not_enrolled(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    # student = StudentFactory(user=user)
    # EnrollmentFactory(offering=offering, student=student)

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": offering.id,
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Great course!",
        "is_anonymous": False,
    }

    response = client.post(url, data=payload, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_update_rating_not_enrolled(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    student = StudentFactory(user=user)
    EnrollmentFactory(offering=offering, student=student)
    rating_factory = RatingFactory(course_offering=offering, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating_factory.id}/"

    payload = {
        "course_offering": offering.id,
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Different comm!",
        "is_anonymous": False,
    }

    response = client.put(url, data=payload, format="json")

    assert response.status_code == 403, response.data


@pytest.mark.django_db
def test_patch_rating_not_enrolled(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    EnrollmentFactory(offering=offering)
    rating_factory = RatingFactory(course_offering=offering, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating_factory.id}/"

    payload = {
        "comment": "Different comm!",
    }

    response = client.patch(url, data=payload, format="json")

    assert response.status_code == 403, response.data


@pytest.mark.django_db
def test_delete_rating_not_enrolled(token_client, course_factory):
    client, user = token_client
    course = course_factory()
    offering = CourseOfferingFactory(course=course)
    rating_factory = RatingFactory(course_offering=offering, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating_factory.id}/"

    response = client.delete(url)

    assert response.status_code == 403
