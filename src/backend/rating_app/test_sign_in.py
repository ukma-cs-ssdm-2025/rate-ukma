from django.db import DatabaseError
from django.urls import reverse
from rest_framework import status

import pytest

from rating_app.models import SignIn


def _sign_in(api_client, user):
    return api_client.post(
        reverse("login"), {"username": user.username, "password": "test-password"}
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_sign_in_records_one_row_when_user_signs_in(api_client, user_factory):
    user = user_factory()

    response = _sign_in(api_client, user)

    assert response.status_code == status.HTTP_200_OK
    assert SignIn.objects.filter(user=user).count() == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_sign_in_records_a_row_per_sign_in(api_client, user_factory):
    user = user_factory()

    _sign_in(api_client, user)
    _sign_in(api_client, user)

    assert SignIn.objects.filter(user=user).count() == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_sign_in_succeeds_when_recording_fails(api_client, user_factory, monkeypatch):
    user = user_factory()

    def _fail(**kwargs):
        raise DatabaseError("simulated write failure")

    monkeypatch.setattr(SignIn.objects, "create", _fail)

    response = _sign_in(api_client, user)

    assert response.status_code == status.HTTP_200_OK
    assert api_client.session["_auth_user_id"] == str(user.pk)
    assert not SignIn.objects.exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_sign_in_rows_go_when_user_is_deleted(api_client, user_factory):
    user = user_factory()
    _sign_in(api_client, user)

    user.delete()

    assert not SignIn.objects.exists()
