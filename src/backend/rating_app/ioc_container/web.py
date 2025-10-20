from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.urls import path

from rateukma.ioc.decorators import once

from ..views import CourseViewSet, RatingViewSet
from ..views.auth import login, logout, microsoft_login


@once
def course_list_view():
    return CourseViewSet.as_view({"get": "list"})


@once
def course_detail_view():
    return CourseViewSet.as_view({"get": "retrieve"})


@once
def course_ratings_list_create_view():
    return RatingViewSet.as_view({"get": "list", "post": "create"})


@once
def course_rating_detail_view():
    return RatingViewSet.as_view(
        {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
    )


@once
def microsoft_login_view() -> Callable[[HttpRequest], HttpResponse]:
    return microsoft_login


@once
def login_view() -> Callable[[HttpRequest], HttpResponse]:
    return login


@once
def logout_view() -> Callable[[HttpRequest], HttpResponse]:
    return logout


def rest_urlpatterns() -> list:
    return [
        path(
            "auth/login/",
            login_view(),
            name="login",
        ),
        path(
            "auth/login/microsoft/",
            microsoft_login_view(),
            name="microsoft-login",
        ),
        path(
            "auth/logout/",
            logout_view(),
            name="logout",
        ),
        path(
            "courses/",
            course_list_view(),
            name="course-list",
        ),
        path(
            "courses/<str:course_id>/",
            course_detail_view(),
            name="course-detail",
        ),
        path(
            "courses/<str:course_id>/ratings/",
            course_ratings_list_create_view(),
            name="course-ratings",
        ),
        path(
            "courses/<str:course_id>/ratings/<str:rating_id>/",
            course_rating_detail_view(),
            name="course-rating-detail",
        ),
    ]


def urlpatterns() -> list:
    return rest_urlpatterns()
