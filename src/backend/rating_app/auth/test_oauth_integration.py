from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from allauth.core.exceptions import ImmediateHttpResponse

from rating_app.auth.microsoft_account_adapters import MicrosoftSocialAccountAdapter
from rating_app.models import Student
from rating_app.tests.factories import StudentFactory


def _make_social_login(email: str | None) -> MagicMock:
    login = MagicMock()
    login.user = SimpleNamespace(email=email)
    login.connect = MagicMock()
    return login


@pytest.fixture
def adapter() -> MicrosoftSocialAccountAdapter:
    return MicrosoftSocialAccountAdapter()


@pytest.fixture
def http_request() -> MagicMock:
    return MagicMock()


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_new_user_with_ukma_email_creates_user_and_links_to_student(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, user_factory
):
    email = "newuser@ukma.edu.ua"
    student = StudentFactory(email=email, user=None)
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
        autospec=True,
        side_effect=lambda self, request, social_login, **kwargs: user_factory(
            email=social_login.user.email
        ),
    ):
        user = adapter.save_user(http_request, sociallogin)

    student.refresh_from_db()
    assert user.email == email
    assert student.user == user


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_new_user_without_matching_student_creates_user_only(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, user_factory
):
    email = "orphan@ukma.edu.ua"
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
        autospec=True,
        side_effect=lambda self, request, social_login, **kwargs: user_factory(
            email=social_login.user.email
        ),
    ):
        user = adapter.save_user(http_request, sociallogin)

    assert user.email == email
    assert not Student.objects.filter(user=user).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_new_user_with_non_ukma_email_is_rejected(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, settings
):
    settings.LOGIN_ERROR_URL = "/login-error"
    sociallogin = _make_social_login("hacker@gmail.com")

    with pytest.raises(ImmediateHttpResponse) as exc:
        adapter.pre_social_login(http_request, sociallogin)

    assert exc.value.response.url == "/login-error"


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_new_user_without_email_is_rejected(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, settings
):
    settings.LOGIN_ERROR_URL = "/login-error"
    sociallogin = _make_social_login(None)

    with pytest.raises(ImmediateHttpResponse) as exc:
        adapter.pre_social_login(http_request, sociallogin)

    assert exc.value.response.url == "/login-error?technical=1"


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_existing_user_reconnects_to_account(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, settings, user_factory
):
    settings.LOGIN_ERROR_URL = "/login-error"
    email = "returning@ukma.edu.ua"
    user = user_factory(email=email)
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.pre_social_login",
        autospec=True,
        return_value="ok",
    ) as mock_super:
        result = adapter.pre_social_login(http_request, sociallogin)

    sociallogin.connect.assert_called_once_with(http_request, user)
    assert result == "ok"
    mock_super.assert_called_once()


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_save_user_respects_commit_flag(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, user_factory
):
    email = "commit-flag@ukma.edu.ua"
    student = StudentFactory(email=email, user=None)
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
        autospec=False,
        side_effect=lambda request, social_login, **kwargs: user_factory(
            email=social_login.user.email
        ),
    ):
        user = adapter.save_user(http_request, sociallogin, commit=False)

    student.refresh_from_db()
    assert user.email == email
    assert student.user is None


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_does_not_relink_student_owned_by_another_user(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, user_factory
):
    email = "linked@ukma.edu.ua"
    existing_user = user_factory(email=email)
    student = StudentFactory(email=email, user=existing_user)
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
        autospec=True,
        side_effect=lambda self, request, social_login, **kwargs: user_factory(
            email=f"other-{social_login.user.email}"
        ),
    ):
        new_user = adapter.save_user(http_request, sociallogin)

    student.refresh_from_db()
    assert student.user == existing_user
    assert new_user.email.startswith("other-")
    assert not Student.objects.filter(user=new_user).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_handles_multiple_students_with_same_email(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, user_factory
):
    email = "duplicate@ukma.edu.ua"
    StudentFactory(email=email, user=None)
    StudentFactory(email=email, user=None)
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
        autospec=True,
        side_effect=lambda self, request, social_login, **kwargs: user_factory(
            email=social_login.user.email
        ),
    ):
        user = adapter.save_user(http_request, sociallogin)

    assert user.email == email
    assert not Student.objects.filter(user=user).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_populate_user_sets_username_to_email(adapter: MicrosoftSocialAccountAdapter):
    sociallogin = _make_social_login("populate@ukma.edu.ua")

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.populate_user",
        autospec=True,
        return_value=SimpleNamespace(email="populate@ukma.edu.ua", username=None),
    ) as mock_super:
        user = adapter.populate_user(MagicMock(), sociallogin, {})

    assert user.username == "populate@ukma.edu.ua"
    mock_super.assert_called_once()


@pytest.mark.django_db
@pytest.mark.integration
def test_oauth_links_existing_user_without_student(
    adapter: MicrosoftSocialAccountAdapter, http_request: MagicMock, user_factory
):
    email = "ingested@ukma.edu.ua"
    student = StudentFactory(email=email, user=None)
    existing_user = user_factory(email=email)
    sociallogin = _make_social_login(email)

    with patch(
        "rating_app.auth.microsoft_account_adapters.DefaultSocialAccountAdapter.save_user",
        autospec=True,
        return_value=existing_user,
    ):
        user = adapter.save_user(http_request, sociallogin)

    student.refresh_from_db()
    assert user == existing_user
    assert student.user == existing_user
