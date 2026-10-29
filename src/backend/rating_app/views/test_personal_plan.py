import uuid
from decimal import Decimal

from django.urls import reverse

import pytest
from freezegun import freeze_time

from rating_app.models import PlannedCourse
from rating_app.models.choices import CourseTypeKind, PlanSlot, SemesterTerm

# The 2024–2025 academic year: a student who started in 2023 is a second-year.
TODAY = "2024-10-15"
PROGRAM_START = 2023


def plan_url() -> str:
    return reverse("student-personal-plan")


def course_url(course_id) -> str:
    return reverse("student-personal-plan-course", kwargs={"course_id": str(course_id)})


def semester(body, study_year: int, term: str):
    year = next(y for y in body["years"] if y["study_year"] == study_year)
    return next(s for s in year["semesters"] if s["term"] == term)


@pytest.fixture
def me(token_client, student_factory):
    return student_factory(user=token_client.user, program_start_academic_year_start=PROGRAM_START)


@pytest.fixture
def make_offering(
    course_offering_factory,
    course_offering_term_factory,
    course_offering_speciality_factory,
    semester_factory,
):
    def build(course, year, term, credits="4.0", hours=3, speciality=None, kind=None):
        sem = semester_factory(year=year, term=term)
        offering = course_offering_factory(course=course, semester=sem)
        course_offering_term_factory(
            offering=offering, semester=sem, credits=Decimal(credits), weekly_hours=hours
        )
        if speciality is not None:
            course_offering_speciality_factory(
                offering=offering, speciality=speciality, type_kind=kind
            )
        return offering

    return build


@pytest.fixture
def offered_course(course_factory, make_offering):
    course = course_factory()
    make_offering(course, 2024, SemesterTerm.FALL, credits="5.0")
    return course


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_get_plan_returns_taken_and_planned_courses(
    token_client, me, course_factory, enrollment_factory, make_offering, planned_course_factory
):
    taken = course_factory(title="Алгоритми")
    taken_offering = make_offering(
        taken,
        2023,
        SemesterTerm.FALL,
        credits="5.0",
        hours=4,
        speciality=me.speciality,
        kind=CourseTypeKind.PROF_ORIENTED,
    )
    enrollment_factory(student=me, offering=taken_offering)
    picked = course_factory(title="Машинне навчання")
    make_offering(picked, 2025, SemesterTerm.SPRING, credits="3.0", hours=2)
    planned_course_factory(
        student=me, course=picked, study_year=3, term=SemesterTerm.SPRING, slot=PlanSlot.MAIN
    )

    response = token_client.get(plan_url())

    assert response.status_code == 200
    body = response.json()
    assert body["enrollment_year_start"] == PROGRAM_START
    assert body["current_year_start"] == 2024
    assert [(y["study_year"], y["academic_year_start"], y["status"]) for y in body["years"]] == [
        (1, 2023, "done"),
        (2, 2024, "current"),
        (3, 2025, "planned"),
        (4, 2026, "planned"),
    ]
    assert semester(body, 1, "FALL")["main"] == [
        {
            "course_id": str(taken.id),
            "title": "Алгоритми",
            "kind": "PROF_ORIENTED",
            "faculty_name": taken.department.faculty.name,
            "credits": "5.0",
            "weekly_hours": 4,
            "is_mandatory": True,
        }
    ]
    planned_main = semester(body, 3, "SPRING")["main"]
    assert [(c["course_id"], c["kind"], c["credits"], c["is_mandatory"]) for c in planned_main] == [
        (str(picked.id), "ELECTIVE", "3.0", False)
    ]
    assert semester(body, 4, "SUMMER")["is_graduation_summer"] is True


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_get_plan_hides_other_students_picks(
    token_client, me, student_factory, course_factory, planned_course_factory
):
    other = student_factory()
    planned_course_factory(
        student=other,
        course=course_factory(),
        study_year=3,
        term=SemesterTerm.FALL,
        slot=PlanSlot.MAIN,
    )

    response = token_client.get(plan_url())

    assert response.status_code == 200
    courses = [
        course
        for year in response.json()["years"]
        for sem in year["semesters"]
        for course in sem["main"] + sem["backup"]
    ]
    assert courses == []


@pytest.mark.django_db
@pytest.mark.integration
def test_get_plan_returns_403_when_unauthenticated(api_client):
    response = api_client.get(plan_url())

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_get_plan_returns_403_when_user_is_not_a_student(token_client):
    response = token_client.get(plan_url())

    assert response.status_code == 403
    assert response.json()["detail"] == "Only students can perform this action."


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_place_adds_course_and_returns_plan(token_client, me, offered_course):
    response = token_client.put(
        course_url(offered_course.id),
        {"study_year": 3, "term": "FALL", "slot": "BACKUP"},
        format="json",
    )

    assert response.status_code == 200
    fall = semester(response.json(), 3, "FALL")
    assert fall["main"] == []
    assert [(c["course_id"], c["credits"]) for c in fall["backup"]] == [
        (str(offered_course.id), "5.0")
    ]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_place_moves_course_when_already_planned(
    token_client, me, offered_course, planned_course_factory
):
    course = offered_course
    planned_course_factory(
        student=me, course=course, study_year=3, term=SemesterTerm.FALL, slot=PlanSlot.BACKUP
    )

    response = token_client.put(
        course_url(course.id),
        {"study_year": 2, "term": "SPRING", "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert semester(body, 3, "FALL")["backup"] == []
    assert [c["course_id"] for c in semester(body, 2, "SPRING")["main"]] == [str(course.id)]
    assert PlannedCourse.objects.filter(student=me).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_place_returns_400_when_slot_is_invalid(token_client, me, course_factory):
    course = course_factory()

    response = token_client.put(
        course_url(course.id),
        {"study_year": 3, "term": "FALL", "slot": "SPARE"},
        format="json",
    )

    assert response.status_code == 400
    assert "slot" in response.json()["fields"]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
@pytest.mark.parametrize(
    ("study_year", "term"),
    [
        (1, "FALL"),  # a past year is read-only
        (4, "SUMMER"),  # the final year has no summer
        (5, "FALL"),  # past the end of the programme
    ],
)
def test_place_returns_400_when_semester_cannot_be_planned(
    token_client, me, offered_course, study_year, term
):
    response = token_client.put(
        course_url(offered_course.id),
        {"study_year": study_year, "term": term, "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "This semester cannot be planned."
    assert not PlannedCourse.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_place_returns_400_when_course_has_no_offering(token_client, me, course_factory):
    course = course_factory()

    response = token_client.put(
        course_url(course.id),
        {"study_year": 3, "term": "FALL", "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "This course has no offering to plan."
    assert not PlannedCourse.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_place_returns_409_when_course_is_already_taken(
    token_client, me, course_factory, enrollment_factory, make_offering
):
    course = course_factory()
    enrollment_factory(student=me, offering=make_offering(course, 2023, SemesterTerm.FALL))

    response = token_client.put(
        course_url(course.id),
        {"study_year": 3, "term": "FALL", "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 409


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_place_returns_404_when_course_does_not_exist(token_client, me):
    response = token_client.put(
        course_url(uuid.uuid4()),
        {"study_year": 3, "term": "FALL", "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.integration
def test_place_returns_400_when_course_id_is_malformed(token_client, me):
    response = token_client.put(
        course_url("not-a-uuid"),
        {"study_year": 3, "term": "FALL", "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_place_returns_403_when_unauthenticated(api_client):
    response = api_client.put(
        course_url(uuid.uuid4()),
        {"study_year": 3, "term": "FALL", "slot": "MAIN"},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_remove_drops_planned_course(token_client, me, course_factory, planned_course_factory):
    course = course_factory()
    planned_course_factory(
        student=me, course=course, study_year=3, term=SemesterTerm.FALL, slot=PlanSlot.MAIN
    )

    response = token_client.delete(course_url(course.id))

    assert response.status_code == 204
    assert not PlannedCourse.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_remove_returns_404_when_course_is_not_in_own_plan(
    token_client, me, student_factory, course_factory, planned_course_factory
):
    course = course_factory()
    planned_course_factory(
        student=student_factory(),
        course=course,
        study_year=3,
        term=SemesterTerm.FALL,
        slot=PlanSlot.MAIN,
    )

    response = token_client.delete(course_url(course.id))

    assert response.status_code == 404
    assert PlannedCourse.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_remove_returns_403_when_unauthenticated(api_client):
    response = api_client.delete(course_url(uuid.uuid4()))

    assert response.status_code == 403
