from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from allauth.core.exceptions import ImmediateHttpResponse
from faker import Faker

from rating_app.auth.microsoft_account_adapters import (
    MicrosoftAccountAdapter,
    MicrosoftSocialAccountAdapter,
)


@pytest.fixture
def social_adapter() -> MicrosoftSocialAccountAdapter:
    return MicrosoftSocialAccountAdapter()


@pytest.fixture
def account_adapter() -> MicrosoftAccountAdapter:
    return MicrosoftAccountAdapter()


@pytest.fixture
def http_request() -> MagicMock:
    return MagicMock()


@pytest.fixture
def social_login() -> MagicMock:
    return MagicMock()


def test_populate_user_sets_username_and_logs_email(
    social_adapter: MicrosoftSocialAccountAdapter,
    social_login: MagicMock,
    http_request: MagicMock,
    faker: Faker,
):
    adapter = social_adapter

    # Arrange
    email = faker.email(domain="ukma.edu.ua")
    mock_user = SimpleNamespace(email=email, username=None)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.populate_user",
        autospec=True,
    ) as mock_super:
        mock_super.return_value = mock_user

        # Act
        result = adapter.populate_user(http_request, social_login, {})

    # Assert
    assert result is mock_user
    assert result.username == mock_user.email
    mock_super.assert_called_once_with(adapter, http_request, social_login, {})


def test_pre_social_login_raises_when_email_missing(
    social_adapter: MicrosoftSocialAccountAdapter,
    http_request: MagicMock,
    social_login: MagicMock,
    settings,
):
    adapter = social_adapter

    # Arrange
    settings.LOGIN_ERROR_URL = "/login-error"

    with patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=None):
        # Act
        with pytest.raises(ImmediateHttpResponse) as exc:
            adapter.pre_social_login(http_request, social_login)

    # Assert
    assert exc.value.response.url == "/login-error?technical=1"


def test_pre_social_login_connects_existing_user(
    social_adapter: MicrosoftSocialAccountAdapter,
    social_login: MagicMock,
    http_request: MagicMock,
    settings,
    faker: Faker,
):
    adapter = social_adapter

    # Arrange
    social_login.connect = MagicMock()
    settings.LOGIN_ERROR_URL = "/login-error"
    email = faker.email(domain="ukma.edu.ua")

    with (
        patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=email),
        patch("rating_app.auth.microsoft_account_adapters.get_user_model") as mock_get_user_model,
        patch(
            "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.pre_social_login",
            autospec=True,
        ) as mock_super,
    ):
        mock_super.return_value = "super-result"
        user_model = MagicMock()
        existing_user = MagicMock()
        user_model.objects.get.return_value = existing_user
        mock_get_user_model.return_value = user_model

        # Act
        result = adapter.pre_social_login(http_request, social_login)

    # Assert
    assert result == "super-result"
    social_login.connect.assert_called_once_with(http_request, existing_user)
    mock_super.assert_called_once_with(adapter, http_request, social_login)


def test_pre_social_login_handles_new_user_registration(
    social_adapter: MicrosoftSocialAccountAdapter,
    social_login: MagicMock,
    http_request: MagicMock,
    settings,
    faker: Faker,
):
    adapter = social_adapter

    # Arrange
    social_login.connect = MagicMock()
    settings.LOGIN_ERROR_URL = "/login-error"
    email = faker.email(domain="ukma.edu.ua")

    with (
        patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=email),
        patch("rating_app.auth.microsoft_account_adapters.get_user_model") as mock_get_user_model,
        patch(
            "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.pre_social_login",
            autospec=True,
        ) as mock_super,
    ):
        mock_super.return_value = "super-result"
        user_model = MagicMock()

        class DoesNotExistError(Exception):
            pass

        user_model.DoesNotExist = DoesNotExistError
        user_model.objects.get.side_effect = DoesNotExistError
        mock_get_user_model.return_value = user_model

        # Act
        result = adapter.pre_social_login(http_request, social_login)

    # Assert
    assert result == "super-result"
    social_login.connect.assert_not_called()
    mock_super.assert_called_once_with(adapter, http_request, social_login)


def test_pre_social_login_rejects_disallowed_domain(
    social_adapter: MicrosoftSocialAccountAdapter,
    http_request: MagicMock,
    social_login: MagicMock,
    settings,
    faker: Faker,
):
    settings.LOGIN_ERROR_URL = "/login-error"
    email = faker.email(domain="example.com")

    with patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=email):
        with pytest.raises(ImmediateHttpResponse) as exc:
            social_adapter.pre_social_login(http_request, social_login)

    assert exc.value.response.url == "/login-error"


def test_save_user_calls_link_user_to_student(
    account_adapter: MicrosoftAccountAdapter, http_request: MagicMock
):
    # Arrange
    mock_user = SimpleNamespace(email="test@ukma.edu.ua", id=1)
    mock_form = MagicMock()

    with (
        patch(
            "rating_app.auth.microsoft_account_adapters.DefaultAccountAdapter.save_user",
            autospec=True,
        ) as mock_super,
        patch("rating_app.auth.microsoft_account_adapters.student_service") as mock_student_service,
    ):
        mock_super.return_value = mock_user
        mock_service_instance = MagicMock()
        mock_student_service.return_value = mock_service_instance

        # Act
        result = account_adapter.save_user(http_request, mock_user, mock_form, commit=True)

    # Assert
    assert result is mock_user
    mock_service_instance.link_user_to_student.assert_called_once_with(mock_user)


def test_save_user_does_not_link_when_commit_is_false(
    account_adapter: MicrosoftAccountAdapter, http_request: MagicMock
):
    # Arrange
    mock_user = SimpleNamespace(email="test@ukma.edu.ua", id=1)
    mock_form = MagicMock()

    with (
        patch(
            "rating_app.auth.microsoft_account_adapters.DefaultAccountAdapter.save_user",
            autospec=True,
        ) as mock_super,
        patch("rating_app.auth.microsoft_account_adapters.student_service") as mock_student_service,
    ):
        mock_super.return_value = mock_user

        # Act
        result = account_adapter.save_user(http_request, mock_user, mock_form, commit=False)

    # Assert
    assert result is mock_user
    mock_student_service.return_value.link_user_to_student.assert_not_called()


def test_social_adapter_save_user_links_user_to_student(
    social_adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock
):
    # Arrange
    mock_user = SimpleNamespace(email="test@ukma.edu.ua", id=1)
    mock_sociallogin = MagicMock()

    with (
        patch(
            "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
            autospec=True,
        ) as mock_super,
        patch("rating_app.auth.microsoft_account_adapters.student_service") as mock_student_service,
    ):
        mock_super.return_value = mock_user
        mock_service_instance = MagicMock()
        mock_service_instance.link_user_to_student.return_value = True
        mock_student_service.return_value = mock_service_instance

        # Act
        result = social_adapter.save_user(http_request, mock_sociallogin)

    # Assert
    assert result is mock_user
    mock_service_instance.link_user_to_student.assert_called_once_with(mock_user)
