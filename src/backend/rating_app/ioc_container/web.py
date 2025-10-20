from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.urls import path

from rateukma.ioc.decorators import once

from ..views.auth import csrf_token, login, logout, microsoft_login, session
from ..views.course_viewset import CourseViewSet


@once
def course_list_view():
    return CourseViewSet.as_view({"get": "list"})


@once
def course_detail_view():
    return CourseViewSet.as_view({"get": "retrieve"})


# @once
# def course_ratings_list_create_view() -> AsyncViewDelegate:
#     return CourseRatingsListCreateView.as_view()


# @once
# def course_rating_detail_view() -> AsyncViewDelegate:
#     return CourseRatingDetailView.as_view()


@once
def microsoft_login_view() -> Callable[[HttpRequest], HttpResponse]:
    return microsoft_login


@once
def login_view() -> Callable[[HttpRequest], HttpResponse]:
    return login


@once
def logout_view() -> Callable[[HttpRequest], HttpResponse]:
    return logout


@once
def session_view() -> Callable[[HttpRequest], HttpResponse]:
    return session


@once
def csrf_token_view() -> Callable[[HttpRequest], HttpResponse]:
    return csrf_token


@once
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
            "auth/session/",
            session_view(),
            name="session",
        ),
        path(
            "auth/csrf/",
            csrf_token_view(),
            name="csrf-token",
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
        # path(
        #     "courses/<str:course_id>/ratings/",
        #     course_ratings_list_create_view(),
        #     name="course-ratings",
        # ),
        # path(
        #     "courses/<str:course_id>/ratings/<str:rating_id>/",
        #     course_rating_detail_view(),
        #     name="course-rating-detail",
        # ),
    ]


def urlpatterns() -> list:
    return rest_urlpatterns()
