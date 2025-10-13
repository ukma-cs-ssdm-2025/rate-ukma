from typing import Any, Awaitable, Callable

from django.http import HttpRequest, HttpResponse
from django.urls import path
from rateukma.ioc.decorators import once

from ..views.auth import login, logout, microsoft_login
from ..views.views import (
    CourseDetailView,
    CourseListView,
    CourseRatingDetailView,
    CourseRatingsListCreateView,
)

AsyncViewDelegate = Callable[[HttpRequest, Any], Awaitable[HttpResponse]]


@once
def course_list_view() -> AsyncViewDelegate:
    return CourseListView.as_view()


@once
def course_detail_view() -> AsyncViewDelegate:
    return CourseDetailView.as_view()


@once
def course_ratings_list_create_view() -> AsyncViewDelegate:
    return CourseRatingsListCreateView.as_view()


@once
def course_rating_detail_view() -> AsyncViewDelegate:
    return CourseRatingDetailView.as_view()


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
