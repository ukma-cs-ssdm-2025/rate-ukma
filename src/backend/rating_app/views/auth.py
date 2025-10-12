import structlog
from django.shortcuts import redirect
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from .responses import R_OAUTH

logger = structlog.get_logger(__name__)


@extend_schema(
    summary="Microsoft OAuth Login",
    description=(
        "Initiates Microsoft OAuth2 authentication flow. "
        "Redirects to Microsoft login page for @ukma.edu.ua accounts."
        "Backend handles session authentication and redirects to frontend login page."
    ),
    responses=R_OAUTH,
    request=None,
    tags=["auth"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def microsoft_login(request):
    logger.info("microsoft_login_init", user_agent=request.META.get("HTTP_USER_AGENT"))
    return redirect(
        "/accounts/microsoft/login/"
    )  # TODO: extract hard-coded path to component init


@extend_schema(
    summary="Logout",
    description="Logs out current user and redirects to the configured logout URL.",
    responses=R_OAUTH,
    request=None,
    tags=["auth"],
)
@api_view(["POST"])
def logout(request):
    logger.info(
        "user_logout",
        user_id=request.user.id if request.user.is_authenticated else None,
    )
    return redirect(
        "/accounts/logout/"
    )  # TODO: extract hard-coded path to component init
