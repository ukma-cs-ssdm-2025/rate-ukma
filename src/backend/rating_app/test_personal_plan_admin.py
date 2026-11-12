from decimal import Decimal

from django.urls import reverse

import pytest
from freezegun import freeze_time

from rateukma.caching.patterns import student_plan_namespace
from rating_app.models import PlannedCourse
from rating_app.models.choices import PlanSlot, SemesterTerm

TODAY = "2024-10-15"


@pytest.fixture
def admin_client(client, user_factory):
    client.force_login(user_factory(is_staff=True, is_superuser=True))
    return client


@pytest.fixture
def pick(
    student_factory,
    course_factory,
    course_offering_factory,
    course_offering_term_factory,
    semester_factory,
    planned_course_factory,
):
    semester = semester_factory(year=2024, term=SemesterTerm.FALL)
    offering = course_offering_factory(
        course=course_factory(title="Теорія ігор"), semester=semester
    )
    course_offering_term_factory(offering=offering, semester=semester, credits=Decimal("3.0"))
    return planned_course_factory(
        student=student_factory(program_start_academic_year_start=2023),
        offering=offering,
        study_year=3,
        term=SemesterTerm.FALL,
        slot=PlanSlot.BACKUP,
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_planned_course_changelist_lists_saved_picks(admin_client, pick):
    response = admin_client.get(reverse("admin:rating_app_plannedcourse_changelist"))

    assert response.status_code == 200
    assert "Теорія ігор" in response.content.decode()


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(TODAY)
def test_student_change_page_shows_the_plan(admin_client, pick):
    response = admin_client.get(reverse("admin:rating_app_student_change", args=[pick.student_id]))

    assert response.status_code == 200
    page = response.content.decode()
    assert "Personal plan" in page
    assert "Теорія ігор <small>(backup, 3.0 ECTS)</small>" in page


@pytest.mark.django_db
@pytest.mark.integration
def test_planned_course_cannot_be_added_in_admin(admin_client):
    response = admin_client.get(reverse("admin:rating_app_plannedcourse_add"))

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_deleting_a_pick_in_admin_clears_the_cached_plan(admin_client, pick, mock_cache_manager):
    namespace = student_plan_namespace(str(pick.student_id))
    version = mock_cache_manager.get_version(namespace)

    response = admin_client.post(
        reverse("admin:rating_app_plannedcourse_delete", args=[pick.pk]), {"post": "yes"}
    )

    assert response.status_code == 302
    assert not PlannedCourse.objects.exists()
    assert mock_cache_manager.get_version(namespace) > version


@pytest.mark.django_db
@pytest.mark.integration
def test_bulk_deleting_picks_in_admin_clears_the_cached_plan(
    admin_client, pick, mock_cache_manager
):
    namespace = student_plan_namespace(str(pick.student_id))
    version = mock_cache_manager.get_version(namespace)

    response = admin_client.post(
        reverse("admin:rating_app_plannedcourse_changelist"),
        {"action": "delete_selected", "_selected_action": [pick.pk], "post": "yes"},
    )

    assert response.status_code == 302
    assert not PlannedCourse.objects.exists()
    assert mock_cache_manager.get_version(namespace) > version
