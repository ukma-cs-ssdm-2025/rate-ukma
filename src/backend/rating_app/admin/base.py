from django.contrib import admin
from django.db.models import Avg, Count, FloatField, IntegerField, Value
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
        "avg_difficulty",
        "avg_usefulness",
        "ratings_count",
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
                Count("offerings__ratings__id", distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
        )

    @admin.display(ordering="avg_difficulty_annot", description="Avg difficulty")
    def avg_difficulty(self, obj):
        return getattr(obj, "avg_difficulty_annot", None)

    @admin.display(ordering="avg_usefulness_annot", description="Avg usefulness")
    def avg_usefulness(self, obj):
        return getattr(obj, "avg_usefulness_annot", None)

    @admin.display(ordering="ratings_count_annot", description="Ratings count")
    def ratings_count(self, obj):
        return getattr(obj, "ratings_count_annot", None)
