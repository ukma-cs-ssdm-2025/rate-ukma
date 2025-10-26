from unittest.mock import MagicMock, patch

from django.http import HttpResponseRedirect
from django.urls import reverse
from rest_framework import status

import pytest


@pytest.mark.django_db
@patch("rating_app.views.auth.redirect")
def test_microsoft_login_redirects(mock_redirect, api_client):
    # Arrange
    url = reverse("microsoft_login")
    expected_redirect_url = "https://login.microsoftonline.com"
    mock_redirect.return_value = HttpResponseRedirect(expected_redirect_url)

    # Act
    response = api_client.get(url)

    # Assert
    assert response.status_code == status.HTTP_302_FOUND
    assert response.url.startswith(expected_redirect_url)


@pytest.mark.django_db
@patch("rating_app.views.auth.authenticate")
@patch("rating_app.views.auth.django_login")
def test_login_successful(mock_django_login, mock_authenticate, api_client):
    # Arrange
    url = reverse("login")
    mock_user = MagicMock()
    mock_authenticate.return_value = mock_user
    login_data = {"username": "test@ukma.edu.ua", "password": "test_password"}

    # Act
    response = api_client.post(url, login_data, format="json")

    # Assert
    assert response.status_code == status.HTTP_200_OK
    assert response.data["detail"] == "Login Successful"
    mock_authenticate.assert_called_once_with(username="test@ukma.edu.ua", password="test_password")
    mock_django_login.assert_called_once()


@pytest.mark.django_db
@patch("rating_app.views.auth.authenticate")
def test_login_invalid_credentials(mock_authenticate, api_client):
    # Arrange
    url = reverse("login")
    mock_authenticate.return_value = None
    login_data = {"username": "wrong@ukma.edu.ua", "password": "wrong_password"}

    # Act
    response = api_client.post(url, login_data, format="json")

    # Assert
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["detail"] == "Invalid credentials"
    mock_authenticate.assert_called_once_with(
        username="wrong@ukma.edu.ua", password="wrong_password"
    )


@pytest.mark.django_db
@patch("rating_app.views.auth.django_logout")
def test_logout_successful(mock_logout, api_client):
    # Arrange
    url = reverse("logout")
    api_client.force_authenticate(user=MagicMock())

    # Act
    response = api_client.post(url)

    # Assert
    assert response.status_code == status.HTTP_200_OK
    assert response.data["detail"] == "Successfully logged out"
    mock_logout.assert_called_once()
