from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.http import HttpRequest
from django.shortcuts import redirect

import structlog
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_email
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin

logger = structlog.get_logger(__name__)


class MicrosoftSocialAccountAdapter(DefaultSocialAccountAdapter):
    ALLOWED_DOMAINS = ["ukma.edu.ua"]

    def populate_user(self, request: HttpRequest, sociallogin: SocialLogin, data: dict) -> User:
        user = super().populate_user(request, sociallogin, data)
        user.username = user.email

        logger.info("microsoft_oauth_authentication_received", email=user.email)
        return user

    def pre_social_login(self, request: HttpRequest, sociallogin: SocialLogin):
        if not self._is_allowed_to_login(request, sociallogin):
            raise ImmediateHttpResponse(redirect(settings.LOGIN_ERROR_URL))

        email = user_email(sociallogin.user)
        if not email:
            logger.error("email_address_required")
            raise ImmediateHttpResponse(redirect(settings.LOGIN_ERROR_URL))

        user_model = get_user_model()
        try:
            existing_user = user_model.objects.get(email=email)
            sociallogin.connect(request, existing_user)
            logger.info("user_connected", email=email)
        except user_model.DoesNotExist:
            logger.info("new_user_registration", email=email)

        return super().pre_social_login(request, sociallogin)

    def _is_allowed_to_login(self, request: HttpRequest, sociallogin: SocialLogin) -> bool:
        email = user_email(sociallogin.user)
        domain = email.split("@")[1] if email else None

        if not email:
            logger.debug("no_email_found_in_sociallogin")
            return False
        logger.debug("received_sociallogin", email_domain=domain)

        if not self._is_email_allowed(email):
            logger.error(
                "domain_not_allowed",
                allowed_domains=self.ALLOWED_DOMAINS,
            )
            return False

        return True

    def _is_email_allowed(self, email: str) -> bool:
        return email.endswith(tuple(self.ALLOWED_DOMAINS))


class MicrosoftAccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        return settings.ACCOUNT_ALLOW_REGISTRATION

    def get_login_redirect_url(self, request: HttpRequest) -> str:
        return settings.LOGIN_REDIRECT_URL

    def get_logout_redirect_url(self, request: HttpRequest) -> str:
        return settings.ACCOUNT_LOGOUT_REDIRECT_URL
