from django.contrib import admin

from reversion.admin import VersionAdmin

from rating_app.models import Course


@admin.register(Course)
class CourseAdmin(VersionAdmin):
    list_display = ("code", "title", "faculty", "department", "status", "type_kind")
    list_select_related = ("faculty", "department")
    list_filter = ("faculty", "department", "status", "type_kind")
    search_fields = ("code", "title", "faculty__name", "department__name")
    ordering = ("title",)
