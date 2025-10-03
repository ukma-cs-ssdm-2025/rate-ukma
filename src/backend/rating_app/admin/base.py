from django.contrib import admin
from rating_app.models import Course
from reversion.admin import VersionAdmin


@admin.register(Course)
class CourseAdmin(VersionAdmin):
    list_display = ("name", "faculty", "year", "ukma_id")
    list_filter = ("faculty", "year")
    search_fields = ("name", "faculty", "year", "ukma_id")
    ordering = ("-year", "name")
