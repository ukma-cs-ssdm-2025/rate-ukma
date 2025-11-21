import pytest
from freezegun import freeze_time


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
@freeze_time("2025-10-15")  # October = FALL semester
def test_create_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    semester_factory,
):
    # Create current semester for validation (Fall 2025)
    from rating_app.models.semester import SemesterTerm

    semester_factory(year=2025, term=SemesterTerm.FALL)

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


@pytest.mark.django_db
def test_retrieve_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    rating_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    rating = rating_factory(
        course_offering=offering, student=student, difficulty=4, usefulness=5, comment="Test"
    )

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert data["difficulty"] == 4
    assert data["usefulness"] == 5
    assert data["comment"] == "Test"


@pytest.mark.django_db
def test_retrieve_nonexistent_rating(
    token_client,
    course_factory,
):
    import uuid

    course = course_factory()
    fake_rating_id = uuid.uuid4()

    url = f"/api/v1/courses/{course.id}/ratings/{fake_rating_id}/"
    response = token_client.get(url)

    assert response.status_code == 404


@pytest.mark.django_db
def test_retrieve_rating_invalid_uuid(
    token_client,
    course_factory,
):
    course = course_factory()

    url = f"/api/v1/courses/{course.id}/ratings/invalid-uuid/"
    response = token_client.get(url)

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_rating_validation_error_missing_difficulty(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        # Missing difficulty
        "usefulness": 5,
        "comment": "Great course!",
    }

    response = token_client.post(url, data=payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_rating_validation_error_invalid_difficulty(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 10,  # Out of range (should be 1-5)
        "usefulness": 5,
        "comment": "Test",
    }

    response = token_client.post(url, data=payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
@freeze_time("2025-10-15")  # October = FALL semester
def test_create_duplicate_rating_same_offering(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
    semester_factory,
):
    # Create current semester for validation (Fall 2025)
    from rating_app.models.semester import SemesterTerm

    semester_factory(year=2025, term=SemesterTerm.FALL)

    course = course_factory()
    offering = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    # Create initial rating
    rating_factory(course_offering=offering, student=student, difficulty=3, usefulness=4)

    # Attempt to create duplicate
    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 5,
        "usefulness": 5,
        "comment": "Duplicate attempt",
    }

    response = token_client.post(url, data=payload, format="json")
    assert response.status_code == 409


@pytest.mark.django_db
def test_update_rating_with_immutable_field_attempt(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
):
    course = course_factory()
    offering1 = course_offering_factory(course=course)
    offering2 = course_offering_factory(course=course)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering1, student=student)
    rating = rating_factory(course_offering=offering1, student=student, difficulty=3, usefulness=4)

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    payload = {
        "course_offering": str(offering2.id),  # Attempt to change offering
        "difficulty": 5,
        "usefulness": 5,
        "comment": "Updated",
        "is_anonymous": False,
    }

    response = token_client.put(url, data=payload, format="json")
    # Should succeed but offering should not change
    assert response.status_code == 200

    # Verify offering didn't change
    rating.refresh_from_db()
    assert str(rating.course_offering.id) == str(offering1.id)


@pytest.mark.django_db
def test_partial_update_single_field(
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
    rating = rating_factory(
        course_offering=offering,
        student=student,
        difficulty=3,
        usefulness=4,
        comment="Original",
    )

    url = f"/api/v1/courses/{course.id}/ratings/{rating.id}/"
    payload = {"comment": "Updated comment only"}

    response = token_client.patch(url, data=payload, format="json")
    assert response.status_code == 200

    # Verify only comment changed
    rating.refresh_from_db()
    assert rating.comment == "Updated comment only"
    assert rating.difficulty == 3  # Unchanged
    assert rating.usefulness == 4  # Unchanged


@pytest.mark.django_db
def test_ratings_list_empty_for_course_with_no_ratings(
    token_client, course_factory, course_offering_factory
):
    course = course_factory()
    course_offering_factory(course=course)

    url = f"/api/v1/courses/{course.id}/ratings/"
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0


@pytest.mark.django_db
def test_ratings_list_filters_by_course(
    token_client, course_factory, course_offering_factory, rating_factory
):
    course1 = course_factory()
    offering1 = course_offering_factory(course=course1)
    rating_factory.create_batch(3, course_offering=offering1)

    course2 = course_factory()
    offering2 = course_offering_factory(course=course2)
    rating_factory.create_batch(2, course_offering=offering2)

    url = f"/api/v1/courses/{course1.id}/ratings/"
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3  # Only course1 ratings


@pytest.mark.django_db
def test_create_rating_without_student_record(
    token_client,
    course_factory,
    course_offering_factory,
):
    course = course_factory()
    offering = course_offering_factory(course=course)

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Test",
    }

    response = token_client.post(url, data=payload, format="json")
    assert response.status_code == 403
    assert "Only students can perform this action" in response.json()["detail"]
