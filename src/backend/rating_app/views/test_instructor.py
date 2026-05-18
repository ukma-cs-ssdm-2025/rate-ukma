import uuid

from django.urls import reverse

import pytest

from rating_app.tests.factories import (
    CourseOfferingFactory,
    CourseOfferingSpecialityFactory,
    RatingFactory,
    SpecialityFactory,
)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_instructor_detail(token_client, instructor_factory):
    # Arrange
    instructor = instructor_factory.create()
    url = reverse("instructor-detail", args=[instructor.id])

    # Act
    response = token_client.get(url)

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(instructor.id)
    assert data["first_name"] == instructor.first_name
    assert data["last_name"] == instructor.last_name
    # email is intentionally not exposed in the API
    assert "email" not in data


@pytest.mark.django_db
@pytest.mark.integration
def test_nonexistent_instructor_id_returns_404(token_client):
    invalid_id = uuid.uuid4()
    url = reverse("instructor-detail", kwargs={"instructor_id": str(invalid_id)})

    response = token_client.get(url)

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.integration
def test_bad_uuid(token_client):
    url = reverse("instructor-detail", kwargs={"instructor_id": "not-a-uuid"})

    response = token_client.get(url)

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_paginated(token_client, instructor_factory):
    instructor_factory.create_batch(25)

    url = reverse("instructor-list")
    response = token_client.get(url, {"page": 1, "page_size": 10})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 25
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert len(data["items"]) == 10
    assert data["next_page"] == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_search(token_client, instructor_factory):
    instructor_factory.create(first_name="Ivan", last_name="Petrenko", email="ivan@ukma.edu.ua")
    instructor_factory.create(first_name="Anna", last_name="Koval", email="anna@ukma.edu.ua")

    url = reverse("instructor-list")
    response = token_client.get(url, {"search": "ivan"})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["first_name"] == "Ivan"


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_orders_by_offering_mentions(token_client, instructor_factory):
    offering = CourseOfferingFactory.create()
    top = instructor_factory.create(last_name="Aaa")
    middle = instructor_factory.create(last_name="Bbb")
    bottom = instructor_factory.create(last_name="Ccc")

    # top → 2 ratings on this offering, middle → 1, bottom → 0
    for _ in range(2):
        r = RatingFactory.create(course_offering=offering)
        r.instructors.add(top)
    r = RatingFactory.create(course_offering=offering)
    r.instructors.add(middle)

    url = reverse("instructor-list")
    response = token_client.get(url, {"course_offering_id": str(offering.id)})

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"][:3]]
    assert ids == [str(top.id), str(middle.id), str(bottom.id)]


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_orders_by_speciality_mentions(token_client, instructor_factory):
    speciality = SpecialityFactory.create()
    offering = CourseOfferingFactory.create()
    CourseOfferingSpecialityFactory.create(offering=offering, speciality=speciality)
    other_offering = CourseOfferingFactory.create()

    top = instructor_factory.create(last_name="Aaa")
    other = instructor_factory.create(last_name="Bbb")

    rating_on_spec = RatingFactory.create(course_offering=offering)
    rating_on_spec.instructors.add(top)
    rating_elsewhere = RatingFactory.create(course_offering=other_offering)
    rating_elsewhere.instructors.add(other)

    url = reverse("instructor-list")
    response = token_client.get(url, {"speciality_id": str(speciality.id)})

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"][:2]]
    assert ids[0] == str(top.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_global_fallback(token_client, instructor_factory):
    less = instructor_factory.create(last_name="Less")
    more = instructor_factory.create(last_name="More")
    RatingFactory.create().instructors.add(less)
    for _ in range(3):
        RatingFactory.create().instructors.add(more)

    url = reverse("instructor-list")
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"][:2]]
    assert ids == [str(more.id), str(less.id)]
