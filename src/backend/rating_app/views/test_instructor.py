import uuid

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

import pytest

from rating_app.tests.factories import InstructorFactory


@pytest.fixture
def token_client(db):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        username="student", email="student@ukma.edu.ua", password="pass123"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def instructor_factory():
    return InstructorFactory


@pytest.mark.django_db
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


@pytest.mark.django_db
def test_nonexistent_instructor_id_returns_404(token_client):
    invalid_id = uuid.uuid4()
    url = reverse("instructor-detail", kwargs={"instructor_id": str(invalid_id)})

    response = token_client.get(url)

    assert response.status_code == 404


@pytest.mark.django_db
def test_bad_uuid(token_client):
    url = reverse("instructor-detail", kwargs={"instructor_id": "not-a-uuid"})

    response = token_client.get(url)

    assert response.status_code == 400
