from django.urls import path

from .views import CourseListView

app_name = "rating_app"

urlpatterns = [
    path("courses/", CourseListView.as_view(), name="courses"),
]
