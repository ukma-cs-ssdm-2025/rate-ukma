from django.contrib import admin
from reversion.admin import VersionAdmin
from rating_app.models import Course

@admin.register(Course)
class CourseAdmin(VersionAdmin):
    list_display = (
        "id",
        "title",
        "department",
        "status",
        "avg_difficulty",
        "avg_usefulness",
        "ratings_count",
    )
    list_select_related = ("department",)
    list_filter = ("department", "status")
    search_fields = ("title", "department__name")
    ordering = ("title",)