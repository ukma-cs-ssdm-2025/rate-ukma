from datetime import datetime
from typing import cast

from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema

from ..serializers.auth import LoginDto, LoginSerializer, SessionSerializer
from .responses import R_LOGIN, R_LOGOUT, R_OAUTH, R_SESSION
from .views import _with_request_id

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
    if not serializer.is_valid():
        response = Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )
        return _with_request_id(response)

    validated_data = cast(LoginDto, serializer.validated_data)
    username = validated_data["username"]
    password = validated_data["password"]
    user = authenticate(username=username, password=password)

    if user is None:
        response = Response(
            {"detail": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        return _with_request_id(response)

    django_login(request, user)
    logger.info("user_login_successful")

    response = Response({"detail": "Login Successful"})
    return _with_request_id(response)


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
    # * Check if redirect url can be passed as an argument
    return redirect("/accounts/logout/")


def _get_session_expiry(request) -> datetime | None:
    try:
        expiry = request.session.get_expiry_date()
    except Exception:
        return None
    return expiry


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

    data = {
        "is_authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
        "expires_at": _get_session_expiry(request),
    }

    serializer = SessionSerializer(data=data)
    serializer.is_valid(raise_exception=True)

    logger.info("session_active", user_id=user.id)
    return Response(serializer.data)
