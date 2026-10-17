import pytest
from freezegun import freeze_time

from rating_app.models.choices import SemesterTerm


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time("2026-04-15")
def test_suggestions_only_include_eligible_enrolled_unrated_offerings(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    student = student_factory(user=token_client.user)
    past = semester_factory(year=2025, term=SemesterTerm.FALL)
    current = semester_factory(year=2026, term=SemesterTerm.SPRING)
    future = semester_factory(year=2026, term=SemesterTerm.FALL)

    def enrolled(title, semester, count=0, owner=student):
        course = course_factory(title=title, ratings_count=count)
        offering = course_offering_factory(course=course, semester=semester)
        enrollment_factory(student=owner, offering=offering)
        return course, offering

    rare, rare_offering = enrolled("Database systems", current, 1)
    popular, _ = enrolled("Algorithms", current, 30)
    older, _ = enrolled("Discrete mathematics", past)
    enrolled("Future course", future)
    _, rated = enrolled("Already rated", current)
    rating_factory(student=student, course_offering=rated)
    enrolled("Another student's course", current, owner=student_factory())

    response = token_client.get("/api/v1/students/me/rating-suggestions/")
    assert response.status_code == 200
    data = response.json()
    assert [item["course_id"] for item in data] == [str(rare.id), str(popular.id), str(older.id)]
    assert data[0]["course_offering_id"] == str(rare_offering.id)
    assert data[0]["semester"] == {"year": 2026, "season": "SPRING"}
    assert data[0]["ratings_count"] == 1

    excluded = token_client.get(
        "/api/v1/students/me/rating-suggestions/", {"exclude_course": str(rare.id)}
    )
    assert excluded.status_code == 200
    assert [item["course_id"] for item in excluded.json()] == [str(popular.id), str(older.id)]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time("2026-04-15")
def test_suggestions_are_empty_for_student_with_no_enrollments(
    token_client,
    student_factory,
    semester_factory,
):
    student_factory(user=token_client.user)
    semester_factory(year=2026, term=SemesterTerm.SPRING)
    response = token_client.get("/api/v1/students/me/rating-suggestions/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.integration
def test_suggestions_require_student_record(token_client):
    response = token_client.get("/api/v1/students/me/rating-suggestions/")
    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_suggestions_reject_malformed_excluded_course(token_client, student_factory):
    student_factory(user=token_client.user)
    response = token_client.get(
        "/api/v1/students/me/rating-suggestions/", {"exclude_course": "invalid"}
    )
    assert response.status_code == 400
