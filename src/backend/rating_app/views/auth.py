from typing import cast

import structlog
from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.shortcuts import redirect
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..serializers.auth import LoginDto, LoginSerializer
from .responses import R_LOGIN, R_OAUTH
from .views import _with_request_id

logger = structlog.get_logger(__name__)


@extend_schema(
    summary="Microsoft OAuth Login",
    description=(
        "Initiates Microsoft OAuth2 authentication flow. "
        "Redirects to Microsoft login page for @ukma.edu.ua accounts."
        "Backend handles session authentication and redirects to frontend"
        "Version: v1."
    ),
    responses=R_OAUTH,
    request=None,
    tags=["auth"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def microsoft_login(request):
    logger.info("microsoft_login_init", user_agent=request.META.get("HTTP_USER_AGENT"))

    # * Check if redirect url can be passed as an argument
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
    logger.info("user_login_successful", user_id=user.id)

    response = Response({"detail": "Login Successful"})
    return _with_request_id(response)


@extend_schema(
    summary="Logout",
    description="Logs out current user and redirects to the configured logout URL. Version: v1.",
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

    # * Check if redirect url can be passed as an argument
    return redirect("/accounts/logout/")
