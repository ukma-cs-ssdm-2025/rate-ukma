import pytest


@pytest.mark.django_db
def test_ratings_list(token_client, course_factory, course_offering_factory, rating_factory):
    course = course_factory()
    offering = course_offering_factory(course=course)

    num_ratings = 4
    rating_factory.create_batch(num_ratings, course_offering=offering)

    url = f"/api/v1/courses/{course.id}/ratings/"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == num_ratings
    assert len(data["items"]) == num_ratings


@pytest.mark.django_db
def test_ratings_list_pagination(
    token_client,
    course_factory,
    rating_factory,
    course_offering_factory,
):
    # Arrange
    course = course_factory()
    offering = course_offering_factory(course=course)

    total_ratings = 15
    rating_factory.create_batch(total_ratings, course_offering=offering)
    url = f"/api/v1/courses/{course.id}/ratings/?page=2&page_size=5"

    # Act
    response = token_client.get(url)

    # Assert
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == total_ratings
    assert data["page"] == 2
    assert data["page_size"] == 5
    assert len(data["items"]) == 5


@pytest.mark.django_db
def test_create_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)  # must be enrolled

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Great course!",
        "is_anonymous": False,
    }

    response = token_client.post(url, data=payload, format="json")

    assert response.status_code == 201, response.data


@pytest.mark.django_db
def test_delete_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    rating = rating_factory(course_offering=offering, student=student, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    response = token_client.delete(url)
    assert response.status_code == 204


@pytest.mark.django_db
def test_update_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
):
    client, _user = token_client
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    rating = rating_factory(course_offering=offering, student=student, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Different comm!",
        "is_anonymous": False,
    }

    response = client.put(url, data=payload, format="json")
    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_patch_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    rating = rating_factory(course_offering=offering, student=student, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    payload = {"comment": "Different comm!"}

    response = token_client.patch(url, data=payload, format="json")
    assert response.status_code == 200, response.data


@pytest.mark.django_db
def test_create_rating_not_enrolled(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student_factory(user=token_client.user)  # not-enrolled student

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Great course!",
        "is_anonymous": False,
    }

    response = token_client.post(url, data=payload, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_update_rating_not_enrolled(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)

    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    foreign_rating = rating_factory(course_offering=offering, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{foreign_rating.id}/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Different comm!",
        "is_anonymous": False,
    }

    response = token_client.put(url, data=payload, format="json")
    print(response.data)
    assert response.status_code == 403, response.data


@pytest.mark.django_db
def test_patch_rating_not_enrolled(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    enrollment_factory(offering=offering)

    # student for the authenticated user, but rating belongs to someone else
    student_factory(user=token_client.user)

    rating = rating_factory(course_offering=offering, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    payload = {"comment": "Different comm!"}

    response = token_client.patch(url, data=payload, format="json")
    assert response.status_code == 403, response.data


@pytest.mark.django_db
def test_delete_rating_not_enrolled(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    rating_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)

    # student for the authenticated user, but rating belongs to someone else
    student_factory(user=token_client.user)

    rating = rating_factory(course_offering=offering, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    response = token_client.delete(url)

    assert response.status_code == 403
