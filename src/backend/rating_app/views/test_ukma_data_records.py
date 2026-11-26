from django.urls import reverse

import pytest

from rating_app.models import SyncSource
from rating_app.models.choices import SemesterTerm

URL = "ukma-data-records"


@pytest.fixture
def superuser_client(token_client):
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


@pytest.mark.django_db
@pytest.mark.integration
def test_records_name_disciplines_semesters_and_proposed_records_in_order(
    superuser_client,
    course_factory,
    course_offering_factory,
    semester_factory,
    rating_factory,
    sync_change_factory,
):
    course = course_factory(
        title="Тестова дисципліна А", ukma_data_id="ud-course", ratings_count=12
    )
    offering = course_offering_factory(
        course=course,
        ukma_data_id="ud-offering",
        semester=semester_factory(year=2026, term=SemesterTerm.SPRING),
    )
    rating_factory(course_offering=offering)
    sync_change_factory(
        source=SyncSource.CATALOG,
        group="new",
        kind="new_course",
        key="ud-new",
        ukma_data_id="ud-new",
        after={"title": "Тестова дисципліна Б", "display": {"course": {}}},
    )

    response = superuser_client.get(
        reverse(URL), {"ids": "ud-offering,ud-course,ud-new,ud-unknown"}
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["id"] for item in items] == ["ud-offering", "ud-course", "ud-new", "ud-unknown"]
    assert items[0] | {"course_id": None} == {
        "id": "ud-offering",
        "kind": "offering",
        "title": "Тестова дисципліна А",
        "place": course.department.name,
        "semester": "Весна 2026",
        "ratings": 1,
        "course_id": None,
        "on_site": True,
    }
    assert items[0]["course_id"] == str(course.pk)
    assert items[1]["kind"] == "course"
    assert items[1]["ratings"] == 12
    assert items[2]["title"] == "Тестова дисципліна Б"
    assert items[2]["on_site"] is False
    assert items[3]["kind"] is None
    assert items[3]["title"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_records_return_400_for_an_id_with_a_slash(superuser_client):
    response = superuser_client.get(reverse(URL), {"ids": "ud/../x"})

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_records_return_403_when_not_superuser(token_client):
    response = token_client.get(reverse(URL), {"ids": "ud-course"})

    assert response.status_code == 403
