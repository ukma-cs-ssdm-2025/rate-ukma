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
        patch.object(adapter, "_is_allowed_to_login", return_value=True),
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
        patch.object(adapter, "_is_allowed_to_login", return_value=True),
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


def test_is_allowed_to_login_returns_false_without_email(
    social_adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, social_login: MagicMock
):
    adapter = social_adapter

    # Arrange
    with patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=None):
        # Act
        result = adapter._is_allowed_to_login(http_request, social_login)

    # Assert
    assert result is False


def test_is_allowed_to_login_rejects_disallowed_domain(
    social_adapter: MicrosoftSocialAccountAdapter,
    http_request: MagicMock,
    social_login: MagicMock,
    faker: Faker,
):
    adapter = social_adapter

    # Arrange
    email = faker.email(domain="example.com")

    with patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=email):
        # Act
        result = adapter._is_allowed_to_login(http_request, social_login)

    # Assert
    assert result is False


def test_is_allowed_to_login_accepts_allowed_domain(
    social_adapter: MicrosoftSocialAccountAdapter,
    http_request: MagicMock,
    social_login: MagicMock,
    faker: Faker,
):
    adapter = social_adapter

    # Arrange
    email = faker.email(domain="ukma.edu.ua")

    with patch("rating_app.auth.microsoft_account_adapters.user_email", return_value=email):
        # Act
        result = adapter._is_allowed_to_login(http_request, social_login)

    # Assert
    assert result is True


def test_account_adapter_respects_registration_setting(
    account_adapter: MicrosoftAccountAdapter, http_request: MagicMock, settings
):
    adapter = account_adapter
    settings.ACCOUNT_ALLOW_REGISTRATION = False

    # Act
    result = adapter.is_open_for_signup(http_request)

    # Assert
    assert result is False


def test_account_adapter_returns_login_redirect(
    account_adapter: MicrosoftAccountAdapter, http_request: MagicMock, settings
):
    adapter = account_adapter
    settings.LOGIN_REDIRECT_URL = "/dashboard"

    # Act
    result = adapter.get_login_redirect_url(http_request)

    # Assert
    assert result == "/dashboard"


def test_account_adapter_returns_logout_redirect(
    account_adapter: MicrosoftAccountAdapter, http_request: MagicMock, settings
):
    adapter = account_adapter
    settings.ACCOUNT_LOGOUT_REDIRECT_URL = "/goodbye"

    # Act
    result = adapter.get_logout_redirect_url(http_request)

    # Assert
    assert result == "/goodbye"
