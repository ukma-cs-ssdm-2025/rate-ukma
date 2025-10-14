from django.contrib import admin
from django.db.models import Avg, Count, Value, FloatField, IntegerField
from django.db.models.functions import Coalesce
from reversion.admin import VersionAdmin
from rating_app.models import Course

@admin.register(Course)
class CourseAdmin(VersionAdmin):
    list_display = (
        "id",
        "title",
        "department",
        "status",
        "avg_difficulty_annot",
        "avg_usefulness_annot",
        "ratings_count_annot",
    )
    list_select_related = ("department",)
    list_filter = ("department", "status")
    search_fields = ("title", "department__name")
    ordering = ("title",)

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related("department")
        return qs.annotate(
            avg_difficulty_annot=Coalesce(
                Avg("offerings__ratings__difficulty"), Value(0.0), output_field=FloatField()
            ),
            avg_usefulness_annot=Coalesce(
                Avg("offerings__ratings__usefulness"), Value(0.0), output_field=FloatField()
            ),
            ratings_count_annot=Coalesce(
                Count("offerings__ratings__id", distinct=True), Value(0), output_field=IntegerField()
            ),
        )