from django.urls import path

from .views import (
    CourseDetailView,
    CourseListView,
    CourseRatingDetailView,
    CourseRatingsListCreateView,
)
from .views.auth import logout, microsoft_login

app_name = "rating_app"

urlpatterns = [
    # Auth
    path("auth/login/microsoft/", microsoft_login, name="microsoft-login"),
    path("auth/logout/", logout, name="logout"),
    # Models
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("courses/<str:course_id>/", CourseDetailView.as_view(), name="course-detail"),
    path(
        "courses/<str:course_id>/ratings/",
        CourseRatingsListCreateView.as_view(),
        name="course-ratings",
    ),
    path(
        "courses/<str:course_id>/ratings/<str:rating_id>/",
        CourseRatingDetailView.as_view(),
        name="course-rating-detail",
    ),
]
