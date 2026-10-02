import uuid

from django.urls import reverse

import pytest

from rating_app.repositories.instructor_repository import current_academic_year_start


@pytest.mark.django_db
@pytest.mark.integration
def test_get_instructor_detail(token_client, instructor_factory):
    # Arrange
    instructor = instructor_factory()
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
    instructor_factory(first_name="Ivan", last_name="Petrenko", email="ivan@ukma.edu.ua")
    instructor_factory(first_name="Anna", last_name="Koval", email="anna@ukma.edu.ua")

    url = reverse("instructor-list")
    response = token_client.get(url, {"search": "ivan"})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["first_name"] == "Ivan"
    # email is intentionally not exposed on the list payload either
    assert "email" not in data["items"][0]


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_search_matches_display_name_tokens(token_client, instructor_factory):
    instructor_factory(
        first_name="Микола",
        patronymic="Миколайович",
        last_name="Глибовець",
        email="mykola.hlybovets@ukma.edu.ua",
    )
    instructor_factory(
        first_name="Альбіна",
        patronymic="Андріївна",
        last_name="Глибовець",
        email="albina.hlybovets@ukma.edu.ua",
    )

    url = reverse("instructor-list")
    response = token_client.get(url, {"search": "Глибовець Микола"})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["first_name"] == "Микола"
    assert data["items"][0]["last_name"] == "Глибовець"


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_search_matches_patronymic_token(token_client, instructor_factory):
    instructor_factory(
        first_name="Микола",
        patronymic="Миколайович",
        last_name="Глибовець",
        email="mykola.hlybovets@ukma.edu.ua",
    )
    instructor_factory(
        first_name="Альбіна",
        patronymic="Андріївна",
        last_name="Глибовець",
        email="albina.hlybovets@ukma.edu.ua",
    )

    url = reverse("instructor-list")
    response = token_client.get(url, {"search": "Миколайович"})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["patronymic"] == "Миколайович"


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_orders_by_offering_mentions(
    token_client, instructor_factory, course_offering_factory, rating_factory
):
    offering = course_offering_factory()
    top = instructor_factory(last_name="Aaa")
    middle = instructor_factory(last_name="Bbb")
    bottom = instructor_factory(last_name="Ccc")

    # top → 2 ratings on this offering, middle → 1, bottom → 0
    for _ in range(2):
        r = rating_factory(course_offering=offering)
        r.instructors.add(top)
    r = rating_factory(course_offering=offering)
    r.instructors.add(middle)

    url = reverse("instructor-list")
    response = token_client.get(url, {"course_offering_id": str(offering.id)})

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"][:3]]
    assert ids == [str(top.id), str(middle.id), str(bottom.id)]


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_orders_by_speciality_mentions(
    token_client,
    instructor_factory,
    speciality_factory,
    course_offering_factory,
    course_offering_speciality_factory,
    rating_factory,
):
    speciality = speciality_factory()
    offering = course_offering_factory()
    course_offering_speciality_factory(offering=offering, speciality=speciality)
    other_offering = course_offering_factory()

    top = instructor_factory(last_name="Aaa")
    other = instructor_factory(last_name="Bbb")

    rating_on_spec = rating_factory(course_offering=offering)
    rating_on_spec.instructors.add(top)
    rating_elsewhere = rating_factory(course_offering=other_offering)
    rating_elsewhere.instructors.add(other)

    url = reverse("instructor-list")
    response = token_client.get(url, {"speciality_id": str(speciality.id)})

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"][:2]]
    assert ids[0] == str(top.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_global_fallback(token_client, instructor_factory, rating_factory):
    less = instructor_factory(last_name="Less")
    more = instructor_factory(last_name="More")
    rating_factory().instructors.add(less)
    for _ in range(3):
        rating_factory().instructors.add(more)

    url = reverse("instructor-list")
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"][:2]]
    assert ids == [str(more.id), str(less.id)]


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_mentioned_only_filters_unrated(
    token_client, instructor_factory, rating_factory
):
    rated = instructor_factory(last_name="Rated")
    instructor_factory(last_name="Unrated")
    rating = rating_factory()
    rating.instructors.add(rated)
    url = reverse("instructor-list")
    response = token_client.get(url, {"mentioned_only": "true"})

    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data["items"]]
    assert ids == [str(rated.id)]


@pytest.mark.django_db
@pytest.mark.integration
def test_list_instructors_without_mentioned_only_keeps_unrated(
    token_client, instructor_factory, rating_factory
):
    rated = instructor_factory(last_name="Rated")
    unrated = instructor_factory(last_name="Unrated")
    rating = rating_factory()
    rating.instructors.add(rated)

    url = reverse("instructor-list")
    response = token_client.get(url)

    assert response.status_code == 200
    data = response.json()
    ids = {item["id"] for item in data["items"]}
    assert {str(rated.id), str(unrated.id)} <= ids


@pytest.mark.django_db
@pytest.mark.integration
def test_suggestions_rank_speciality_then_year_then_mentions(
    token_client,
    instructor_factory,
    rating_factory,
    course_offering_factory,
    course_offering_speciality_factory,
    speciality_factory,
    student_factory,
):
    # The caller studies speciality `own` and is in their 2nd year.
    own = speciality_factory()
    student_factory(
        user=token_client.user,
        speciality=own,
        program_start_academic_year_start=current_academic_year_start() - 1,
    )
    own_offering = course_offering_factory(study_year=4)
    course_offering_speciality_factory(offering=own_offering, speciality=own)

    popular = instructor_factory(first_name="Олена", last_name="Коваль", email="a@x.ua")
    same_year = instructor_factory(first_name="Олег", last_name="Коваленко", email="b@x.ua")
    same_spec = instructor_factory(first_name="Ольга", last_name="Ковальчук", email="c@x.ua")
    instructor_factory(first_name="Оксана", last_name="Ковалик", email="d@x.ua")  # never rated

    for _ in range(3):
        rating_factory(course_offering=course_offering_factory(study_year=4)).instructors.add(
            popular
        )
    rating_factory(course_offering=course_offering_factory(study_year=2)).instructors.add(same_year)
    rating_factory(course_offering=own_offering).instructors.add(same_spec)

    # SQLite folds ASCII case only, so the query keeps the capital К.
    response = token_client.get(reverse("instructor-suggestions"), {"q": "Ковал"})

    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["last_name"] for i in items] == ["Ковальчук", "Коваленко", "Коваль"]
    assert items[2]["courses_count"] == 3
    assert "email" not in items[0]


@pytest.mark.django_db
@pytest.mark.integration
def test_suggestions_match_every_word_and_respect_limit(
    token_client, instructor_factory, rating_factory
):
    for n in range(4):
        instr = instructor_factory(first_name="Ivan", last_name=f"Petrenko{n}", email=f"i{n}@x.ua")
        rating_factory().instructors.add(instr)

    url = reverse("instructor-suggestions")
    assert len(token_client.get(url, {"q": "petr ivan", "limit": 2}).json()["items"]) == 2
    assert token_client.get(url, {"q": "petr anna"}).json()["items"] == []


@pytest.mark.django_db
@pytest.mark.integration
def test_suggestions_reject_one_letter_query(token_client):
    response = token_client.get(reverse("instructor-suggestions"), {"q": "a"})

    assert response.status_code == 400
