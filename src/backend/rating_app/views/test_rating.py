from decimal import Decimal

import pytest
from freezegun import freeze_time

DEFAULT_DATE = "2023-10-25"
DEFAULT_AFTER_MIDTERM_DATE = "2023-11-25"
DEFAULT_BEFORE_MIDTERM_DATE = "2023-09-25"
DEFAULT_YEAR = 2023
DEFAULT_TERM = "FALL"


@pytest.mark.django_db
@pytest.mark.integration
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
    assert len(data["items"]["ratings"]) == num_ratings


@pytest.mark.django_db
@pytest.mark.integration
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
    assert len(data["items"]["ratings"]) == 5


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)  # October = FALL semester
def test_create_rating(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)

    course = course_factory()
    offering = course_offering_factory(course=course, semester=semester)
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

    course.refresh_from_db()
    assert course.avg_difficulty == Decimal("4.00")
    assert course.avg_usefulness == Decimal("5.00")
    assert course.ratings_count == 1


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_BEFORE_MIDTERM_DATE)  # before midpoint, rating should be blocked
def test_create_rating_before_midterm_forbidden(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    course = course_factory()
    offering = course_offering_factory(course=course, semester=semester)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/courses/{course.id}/ratings/"
    payload = {
        "course_offering": str(offering.id),
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Too early to rate",
        "is_anonymous": False,
    }

    response = token_client.post(url, data=payload, format="json")

    assert response.status_code == 403
    assert "You cannot rate this course yet" in response.data["detail"]


@pytest.mark.django_db
@pytest.mark.integration
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

    course.refresh_from_db()
    assert course.avg_difficulty == Decimal("0.00")
    assert course.avg_usefulness == Decimal("0.00")
    assert course.ratings_count == 0


@pytest.mark.django_db
@pytest.mark.integration
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

    course.refresh_from_db()
    assert course.avg_difficulty == Decimal("4.00")
    assert course.avg_usefulness == Decimal("5.00")
    assert course.ratings_count == 1


@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
def test_create_rating_not_enrolled(
    token_client, course_factory, course_offering_factory, student_factory, semester_factory
):
    course = course_factory()
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    offering = course_offering_factory(course=course, semester=semester)
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
@pytest.mark.integration
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
    assert response.status_code == 403, response.data


@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
def test_retrieve_rating_invalid_uuid(
    token_client,
    course_factory,
):
    course = course_factory()

    url = f"/api/v1/courses/{course.id}/ratings/invalid-uuid/"
    response = token_client.get(url)

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)  # October = FALL semester
def test_create_duplicate_rating_same_offering(
    token_client,
    course_factory,
    course_offering_factory,
    student_factory,
    enrollment_factory,
    rating_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)

    course = course_factory()
    offering = course_offering_factory(course=course, semester=semester)
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
    assert len(data["items"]["ratings"]) == 0
    assert data["items"]["user_ratings"] is None


@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
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


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_BEFORE_MIDTERM_DATE)
def test_create_rating_before_midterm(
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


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_list_separate_current_user_false_flag(
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
    rating_factory(course_offering=offering, student=student, difficulty=3, usefulness=4)

    rating_factory.create_batch(3, course_offering=offering)

    url = f"/api/v1/courses/{course.id}/ratings/"
    response = token_client.get(url)
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == 4
    assert len(data["items"]["ratings"]) == 4
    assert data["items"]["user_ratings"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_list_separate_current_user_true_flag(
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
    user_rating = rating_factory(
        course_offering=offering, student=student, difficulty=3, usefulness=4
    )

    rating_factory.create_batch(3, course_offering=offering)

    url_with_separate = f"/api/v1/courses/{course.id}/ratings/?separate_current_user=true"
    response = token_client.get(url_with_separate)
    data = response.json()
    assert response.status_code == 200
    assert data["total"] == 4
    assert len(data["items"]["ratings"]) == 3
    assert len(data["items"]["user_ratings"]) == 1
    assert data["items"]["user_ratings"][0]["id"] == str(user_rating.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_by_newest(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
):
    """Test that ratings are sorted by creation time in descending order (newest first)."""
    course = course_factory()
    offering = course_offering_factory(course=course)

    with freeze_time("2023-10-01 10:00:00"):
        rating_1 = rating_factory(course_offering=offering, difficulty=1)
    with freeze_time("2023-10-02 10:00:00"):
        rating_2 = rating_factory(course_offering=offering, difficulty=2)
    with freeze_time("2023-10-03 10:00:00"):
        rating_3 = rating_factory(course_offering=offering, difficulty=3)

    url = f"/api/v1/courses/{course.id}/ratings/?time_order=desc"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 3
    assert data["items"]["ratings"][0]["id"] == str(rating_3.id)
    assert data["items"]["ratings"][1]["id"] == str(rating_2.id)
    assert data["items"]["ratings"][2]["id"] == str(rating_1.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_by_oldest(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
):
    """Test that ratings are sorted by creation time in ascending order (oldest first)."""
    course = course_factory()
    offering = course_offering_factory(course=course)

    with freeze_time("2023-10-01 10:00:00"):
        rating_1 = rating_factory(course_offering=offering, difficulty=1)
    with freeze_time("2023-10-02 10:00:00"):
        rating_2 = rating_factory(course_offering=offering, difficulty=2)
    with freeze_time("2023-10-03 10:00:00"):
        rating_3 = rating_factory(course_offering=offering, difficulty=3)

    url = f"/api/v1/courses/{course.id}/ratings/?time_order=asc"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 3
    assert data["items"]["ratings"][0]["id"] == str(rating_1.id)
    assert data["items"]["ratings"][1]["id"] == str(rating_2.id)
    assert data["items"]["ratings"][2]["id"] == str(rating_3.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_by_most_popular(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that ratings are sorted by Wilson score in descending order.
    Wilson score favors ratings with more votes and higher proportion of upvotes.
    """
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    # Create ratings with different popularity scores
    rating_1 = rating_factory(course_offering=offering)  # 2 upvotes (100%)
    rating_2 = rating_factory(course_offering=offering)  # 5 upvotes (100%) - highest Wilson score
    rating_3 = rating_factory(course_offering=offering)  # 1 downvote (0%) - lowest Wilson score

    for _ in range(2):
        voter = student_factory()
        vote_factory(rating=rating_1, student=voter, type=RatingVoteType.UPVOTE)

    for _ in range(5):
        voter = student_factory()
        vote_factory(rating=rating_2, student=voter, type=RatingVoteType.UPVOTE)

    voter = student_factory()
    vote_factory(rating=rating_3, student=voter, type=RatingVoteType.DOWNVOTE)

    url = f"/api/v1/courses/{course.id}/ratings/?popularity_order=true"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 3
    # With Wilson score, more votes = higher confidence, so rating_2 (5 votes) > rating_1 (2 votes)
    assert data["items"]["ratings"][0]["id"] == str(rating_2.id)
    assert data["items"]["ratings"][1]["id"] == str(rating_1.id)
    assert data["items"]["ratings"][2]["id"] == str(rating_3.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_with_mixed_votes(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that ratings with mixed upvotes and downvotes are sorted correctly using Wilson score.
    Wilson score considers both proportion and total votes.
    """
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    rating_1 = rating_factory(course_offering=offering)  # 3 up, 1 down = 75% positive, 4 total
    rating_2 = rating_factory(course_offering=offering)  # 5 up, 2 down = ~71% positive, 7 total

    for _ in range(3):
        voter = student_factory()
        vote_factory(rating=rating_1, student=voter, type=RatingVoteType.UPVOTE)
    voter = student_factory()
    vote_factory(rating=rating_1, student=voter, type=RatingVoteType.DOWNVOTE)

    for _ in range(5):
        voter = student_factory()
        vote_factory(rating=rating_2, student=voter, type=RatingVoteType.UPVOTE)
    for _ in range(2):
        voter = student_factory()
        vote_factory(rating=rating_2, student=voter, type=RatingVoteType.DOWNVOTE)

    url = f"/api/v1/courses/{course.id}/ratings/?popularity_order=true"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 2
    # With Wilson score, rating_2 (7 votes, ~71%) may rank higher than rating_1 (4 votes, 75%)
    # due to higher confidence from more votes
    assert data["items"]["ratings"][0]["id"] == str(rating_2.id)
    assert data["items"]["ratings"][1]["id"] == str(rating_1.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_default_sort_order(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that without explicit sorting, ratings default to most popular (Wilson score)."""
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    # Create ratings at different times with different popularity
    with freeze_time("2023-10-01 10:00:00"):
        rating_1 = rating_factory(course_offering=offering)  # Oldest, 1 upvote
    with freeze_time("2023-10-02 10:00:00"):
        rating_2 = rating_factory(course_offering=offering)  # Middle, 3 upvotes - most popular
    with freeze_time("2023-10-03 10:00:00"):
        rating_3 = rating_factory(course_offering=offering)  # Newest, no votes

    # Add votes
    voter = student_factory()
    vote_factory(rating=rating_1, student=voter, type=RatingVoteType.UPVOTE)

    for _ in range(3):
        voter = student_factory()
        vote_factory(rating=rating_2, student=voter, type=RatingVoteType.UPVOTE)

    # rating_3 has no votes

    url = f"/api/v1/courses/{course.id}/ratings/"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    # Default should be most popular first (by Wilson score)
    assert data["items"]["ratings"][0]["id"] == str(rating_2.id)  # 3 upvotes
    assert data["items"]["ratings"][1]["id"] == str(rating_1.id)  # 1 upvote
    assert data["items"]["ratings"][2]["id"] == str(rating_3.id)  # 0 votes


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_with_zero_votes_no_division_error(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that Wilson score handles ratings with zero votes without division errors (n=0)."""
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    _rating_no_votes = rating_factory(course_offering=offering)
    rating_with_votes = rating_factory(course_offering=offering)

    # Add votes to second rating
    for _ in range(2):
        voter = student_factory()
        vote_factory(rating=rating_with_votes, student=voter, type=RatingVoteType.UPVOTE)

    url = f"/api/v1/courses/{course.id}/ratings/?popularity_order=true"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 2
    # Rating with votes should come first
    assert data["items"]["ratings"][0]["id"] == str(rating_with_votes.id)
    assert data["items"]["ratings"][1]["id"] == str(_rating_no_votes.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_with_only_upvotes(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that Wilson score handles ratings with 100% upvotes (p=1)."""
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    rating_few_upvotes = rating_factory(course_offering=offering)
    rating_many_upvotes = rating_factory(course_offering=offering)

    # 2 upvotes
    for _ in range(2):
        voter = student_factory()
        vote_factory(rating=rating_few_upvotes, student=voter, type=RatingVoteType.UPVOTE)

    # 5 upvotes
    for _ in range(5):
        voter = student_factory()
        vote_factory(rating=rating_many_upvotes, student=voter, type=RatingVoteType.UPVOTE)

    url = f"/api/v1/courses/{course.id}/ratings/?popularity_order=true"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 2
    # More upvotes = higher Wilson score
    assert data["items"]["ratings"][0]["id"] == str(rating_many_upvotes.id)
    assert data["items"]["ratings"][1]["id"] == str(rating_few_upvotes.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_with_only_downvotes(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that Wilson score handles ratings with 100% downvotes (p=0)."""
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    rating_few_downvotes = rating_factory(course_offering=offering)
    rating_many_downvotes = rating_factory(course_offering=offering)

    # 1 downvote
    voter = student_factory()
    vote_factory(rating=rating_few_downvotes, student=voter, type=RatingVoteType.DOWNVOTE)

    # 3 downvotes
    for _ in range(3):
        voter = student_factory()
        vote_factory(rating=rating_many_downvotes, student=voter, type=RatingVoteType.DOWNVOTE)

    url = f"/api/v1/courses/{course.id}/ratings/?popularity_order=true"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 2
    # Ratings with only downvotes should have negative Wilson scores
    assert data["items"]["ratings"][0]["id"] in [
        str(rating_few_downvotes.id),
        str(rating_many_downvotes.id),
    ]
    assert data["items"]["ratings"][1]["id"] in [
        str(rating_few_downvotes.id),
        str(rating_many_downvotes.id),
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_ratings_sort_mixed_edge_cases(
    token_client,
    course_factory,
    course_offering_factory,
    rating_factory,
    vote_factory,
    student_factory,
):
    """Test that Wilson score correctly orders ratings with various edge case combinations."""
    from rating_app.models.choices import RatingVoteType

    course = course_factory()
    offering = course_offering_factory(course=course)

    rating_only_up = rating_factory(course_offering=offering)
    rating_only_down = rating_factory(course_offering=offering)
    rating_mixed = rating_factory(course_offering=offering)

    # Only upvotes (3 votes)
    for _ in range(3):
        voter = student_factory()
        vote_factory(rating=rating_only_up, student=voter, type=RatingVoteType.UPVOTE)

    # Only downvotes (2 votes)
    for _ in range(2):
        voter = student_factory()
        vote_factory(rating=rating_only_down, student=voter, type=RatingVoteType.DOWNVOTE)

    # Mixed votes (1 up, 1 down)
    voter = student_factory()
    vote_factory(rating=rating_mixed, student=voter, type=RatingVoteType.UPVOTE)
    voter = student_factory()
    vote_factory(rating=rating_mixed, student=voter, type=RatingVoteType.DOWNVOTE)

    url = f"/api/v1/courses/{course.id}/ratings/?popularity_order=true"
    response = token_client.get(url)
    data = response.json()

    assert response.status_code == 200
    assert len(data["items"]["ratings"]) == 3
    # Expected order: only_up > mixed > only_down
    assert data["items"]["ratings"][0]["id"] == str(rating_only_up.id)
    assert data["items"]["ratings"][2]["id"] == str(rating_only_down.id)
