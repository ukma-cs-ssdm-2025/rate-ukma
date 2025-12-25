from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.urls import path

from rateukma.caching.instances import redis_cache_manager
from rateukma.ioc.decorators import once

from ..views import (
    AnalyticsViewSet,
    CourseOfferingViewSet,
    CourseViewSet,
    InstructorViewSet,
    RatingViewSet,
    RatingVoteViewSet,
    StudentStatisticsViewSet,
)
from ..views.auth import csrf_token, login, logout, microsoft_login, session
from .services import (
    course_offering_service,
    course_service,
    instructor_service,
    rating_service,
    student_service,
    vote_service,
)


@once
def course_list_view():
    return CourseViewSet.as_view(
        {"get": "list"},
        course_service=course_service(),
    )


@once
def course_detail_view():
    return CourseViewSet.as_view(
        {"get": "retrieve"},
        course_service=course_service(),
    )


@once
def course_filter_options_view():
    return CourseViewSet.as_view(
        {"get": "filter_options"},
        course_service=course_service(),
    )


# TODO: move post request under a different endpoint
@once
def course_ratings_list_create_view():
    return RatingViewSet.as_view(
        {"get": "list", "post": "create"},
        rating_service=rating_service(),
        student_service=student_service(),
        cache_manager=redis_cache_manager(),
    )


@once
def course_rating_detail_view():
    return RatingViewSet.as_view(
        {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        rating_service=rating_service(),
        student_service=student_service(),
        cache_manager=redis_cache_manager(),
    )


@once
def course_rating_votes_view():
    return RatingVoteViewSet.as_view(
        {"post": "create", "delete": "destroy"},
        vote_service=vote_service(),
        rating_service=rating_service(),
        student_service=student_service(),
        cache_manager=redis_cache_manager(),
    )


@once
def course_rating_stats():
    return StudentStatisticsViewSet.as_view(
        {"get": "get_ratings"}, student_service=student_service()
    )


@once
def course_detailed_rating_stats():
    return StudentStatisticsViewSet.as_view(
        {"get": "get_detailed_ratings"}, student_service=student_service()
    )


@once
def instructor_detail_view():
    return InstructorViewSet.as_view({"get": "retrieve"}, instructor_service=instructor_service())


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
def analytics_list_view():
    return AnalyticsViewSet.as_view(
        {"get": "list"},
        course_service=course_service(),
    )


@once
def analytics_detail_view():
    return AnalyticsViewSet.as_view(
        {"get": "retrieve"},
        course_service=course_service(),
    )


@once
def course_offering_list_view():
    return CourseOfferingViewSet.as_view(
        {"get": "list"},
        course_offering_service=course_offering_service(),
    )


@once
def course_offering_detail_view():
    return CourseOfferingViewSet.as_view(
        {"get": "retrieve"},
        course_offering_service=course_offering_service(),
    )


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
            "courses/filter-options/",
            course_filter_options_view(),
            name="course-filter-options",
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
        path(
            "ratings/<str:rating_id>/votes/",
            course_rating_votes_view(),
            name="course-rating-votes",
        ),
        path(
            "students/me/courses/",
            course_rating_stats(),
            name="student-courses-stats",
        ),
        path(
            "students/me/grades/",
            course_detailed_rating_stats(),
            name="student-courses-grades",
        ),
        path(
            "instructors/<str:instructor_id>",
            instructor_detail_view(),
            name="instructor-detail",
        ),
        path(
            "analytics/",
            analytics_list_view(),
            name="analytics-list",
        ),
        path(
            "analytics/<str:course_id>/",
            analytics_detail_view(),
            name="analytics-detail",
        ),
        path(
            "courses/<str:course_id>/offerings/",
            course_offering_list_view(),
            name="course-offerings",
        ),
        path(
            "course-offerings/<str:course_offering_id>/",
            course_offering_detail_view(),
            name="course-offering-detail",
        ),
    ]


def urlpatterns() -> list:
    return rest_urlpatterns()
