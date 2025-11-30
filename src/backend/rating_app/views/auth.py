from datetime import datetime
from typing import cast

from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema

from ..serializers.auth import CSRFTokenSerializer, LoginDto, LoginSerializer, SessionSerializer
from .responses import R_CSRF_TOKEN, R_LOGIN, R_LOGOUT, R_OAUTH, R_SESSION

logger = structlog.get_logger(__name__)


@extend_schema(
    summary="Microsoft OAuth Login",
    description=(
        "Initiates Microsoft OAuth2 authentication flow. "
        "Redirects to Microsoft login page for @ukma.edu.ua accounts. "
        "Backend handles session authentication and redirects to frontend. "
        "Version: v1."
    ),
    responses=R_OAUTH,
    request=None,
    tags=["auth"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def microsoft_login(request):
    logger.info(
        "microsoft_login_init",
        user_agent=request.META.get("HTTP_USER_AGENT"),
    )

    return redirect("/accounts/microsoft/login/")


@extend_schema(
    summary="Get CSRF Token",
    description=(
        "Returns a CSRF token for use with session-based authentication. "
        "The token should be included in the 'X-CSRFToken' header for subsequent "
        "POST requests that require CSRF protection. Version: v1."
    ),
    responses=R_CSRF_TOKEN,
    request=None,
    tags=["auth"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_token(request):
    logger.info("csrf_token_requested", user_agent=request.META.get("HTTP_USER_AGENT"))

    # Generate CSRF token
    token = get_token(request)

    data = {"csrf_token": token}
    serializer = CSRFTokenSerializer(data=data)
    serializer.is_valid(raise_exception=True)

    logger.info("csrf_token_generated")
    return Response(serializer.data)


@extend_schema(
    summary="Django Login",
    description=("Logs in user using Django authentication flow. Version: v1."),
    responses=R_LOGIN,
    request=LoginSerializer,
    tags=["auth"],
)
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    logger.info("django_login_init", user_agent=request.META.get("HTTP_USER_AGENT"))

    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    validated_data = cast(LoginDto, serializer.validated_data)
    username = validated_data["username"]
    password = validated_data["password"]
    user = authenticate(username=username, password=password)

    if user is None:
        return Response(
            {"detail": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    django_login(request, user)
    logger.info("user_login_successful")

    return Response({"detail": "Login Successful"})


@extend_schema(
    summary="Logout",
    description=("Logs out current user and redirects to the configured logout URL. Version: v1."),
    responses=R_LOGOUT,
    request=None,
    tags=["auth"],
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    was_authenticated = request.user.is_authenticated
    logger.info("user_logout", was_authenticated=was_authenticated)

    django_logout(request)
    return Response({"detail": "Successfully logged out"}, status=status.HTTP_200_OK)


def _get_session_expiry(request) -> datetime | None:
    try:
        return request.session.get_expiry_date()
    except (AttributeError, ValueError) as exc:
        logger.debug("session_expiry_lookup_failed", err=str(exc))
        return None


@extend_schema(
    summary="Session state",
    description=(
        "Returns current authentication session information."
        " Responds with 200 and user data when authenticated,"
        " or 401 when no active session. Version: v1."
    ),
    responses=R_SESSION,
    request=None,
    tags=["auth"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def session(request):
    user = request.user
    if not user.is_authenticated:
        logger.info("session_anonymous")
        return Response(status=status.HTTP_401_UNAUTHORIZED)

    student_profile = getattr(user, "student_profile", None)
    if student_profile:
        first_name = student_profile.first_name
        last_name = student_profile.last_name
        patronymic = student_profile.patronymic or ""
    else:
        first_name = user.first_name
        last_name = user.last_name
        patronymic = ""

    data = {
        "is_authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": first_name,
            "last_name": last_name,
            "patronymic": patronymic,
        },
        "expires_at": _get_session_expiry(request),
    }

    serializer = SessionSerializer(data=data)
    serializer.is_valid(raise_exception=True)

    logger.info("session_active", user_id=user.id)
    return Response(serializer.data)
