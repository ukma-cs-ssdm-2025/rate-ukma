from django.urls import path
from .views import (
    CourseListView,
    CourseDetailView,
    CourseRatingsListCreateView,
    CourseRatingDetailView,
)

app_name = "rating_app"

urlpatterns = [
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("courses/<str:course_id>/", CourseDetailView.as_view(), name="course-detail"),
    path("courses/<str:course_id>/ratings/", CourseRatingsListCreateView.as_view(), name="course-ratings"),
    path("courses/<str:course_id>/ratings/<str:rating_id>/", CourseRatingDetailView.as_view(), name="course-rating-detail"),
]
