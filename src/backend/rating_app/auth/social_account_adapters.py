import logging  # TODO: change to structlog

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_email
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpRequest
from django.shortcuts import redirect

logger = logging.getLogger(__name__)


class MicrosoftSocialAccountAdapter(DefaultSocialAccountAdapter):
    ALLOWED_DOMAINS = ["ukma.edu.ua"]

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        user.username = user.email

        logger.info(
            f"received Microsoft OAuth authentication, populated user={user.email}"
        )

        return user

    def pre_social_login(self, request, sociallogin):
        if not self._is_allowed_to_login(request, sociallogin):
            raise ImmediateHttpResponse(redirect(settings.LOGIN_ERROR_URL))

        email = user_email(sociallogin.user)
        if not email:
            logger.error(request, "Email address is required.")
            raise ImmediateHttpResponse(redirect(settings.LOGIN_ERROR_URL))

        User = get_user_model()
        try:
            existing_user = User.objects.get(email=email)
            sociallogin.connect(request, existing_user)
            logger.info(f"user_connected, email={email}")
        except User.DoesNotExist:
            logger.info(f"new_user_registration, email={email}")

        return super().pre_social_login(request, sociallogin)

    def _is_allowed_to_login(
        self, request: HttpRequest, sociallogin: SocialLogin
    ) -> bool:
        logger.debug(
            f"received sociallogin, email addresses={sociallogin.email_addresses}, user={sociallogin.user}, token={sociallogin.token}"
        )
        email = user_email(sociallogin.user)

        if not email:
            logger.debug(
                f"no email found in sociallogin, user={sociallogin.user}, token={sociallogin.token}"
            )
            return False

        if not self._is_email_allowed(email):
            logger.error(
                request,
                f"Only {self.ALLOWED_DOMAINS} email addresses are allowed to log in.",
            )
            return False

        return True

    def _is_email_allowed(self, email: str) -> bool:
        return email.endswith(tuple(self.ALLOWED_DOMAINS))


class MicrosoftAccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return settings.ACCOUNT_ALLOW_REGISTRATION

    def get_login_redirect_url(self, request):
        return settings.LOGIN_REDIRECT_URL

    def get_logout_redirect_url(self, request):
        return settings.ACCOUNT_LOGOUT_REDIRECT_URL
