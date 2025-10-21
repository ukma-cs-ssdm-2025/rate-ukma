from django.contrib import admin
from django.db.models import Avg, Count, FloatField, IntegerField, Value
from django.db.models.functions import Coalesce

from reversion.admin import VersionAdmin

from rating_app.models import (
    Course,
    CourseOffering,
    Department,
    Faculty,
    Instructor,
    Rating,
    Semester,
    Speciality,
    Student,
)


@admin.register(Course)
class CourseAdmin(VersionAdmin):
    list_display = (
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


@admin.register(Faculty)
class FacultyAdmin(VersionAdmin):
    list_display = ("name", "departments_count", "specialities_count")
    search_fields = ("name",)
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("departments", "specialities")

    @admin.display(description="Departments")
    def departments_count(self, obj):
        return obj.departments.count()

    @admin.display(description="Specialities")
    def specialities_count(self, obj):
        return obj.specialities.count()


@admin.register(Department)
class DepartmentAdmin(VersionAdmin):
    list_display = ("name", "faculty", "courses_count")
    list_select_related = ("faculty",)
    list_filter = ("faculty",)
    search_fields = ("name", "faculty__name")
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("faculty").prefetch_related("courses")

    @admin.display(description="Courses")
    def courses_count(self, obj):
        return obj.courses.count()


@admin.register(Speciality)
class SpecialityAdmin(VersionAdmin):
    list_display = ("name", "faculty", "courses_count")
    list_select_related = ("faculty",)
    list_filter = ("faculty",)
    search_fields = ("name", "faculty__name")
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("faculty").prefetch_related("courses")

    @admin.display(description="Courses")
    def courses_count(self, obj):
        return obj.courses.count()


@admin.register(CourseOffering)
class CourseOfferingAdmin(VersionAdmin):
    list_display = (
        "course",
        "semester",
        "credits",
        "weekly_hours",
        "exam_type",
        "practice_type",
        "instructors_count",
        "enrollments_count",
    )
    list_select_related = ("course", "semester")
    list_filter = ("semester", "exam_type", "practice_type", "course__department")
    search_fields = ("course__title", "course__department__name")
    ordering = ("-semester__year", "-semester__term", "course__title")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("course", "semester")
            .prefetch_related("instructors", "enrollments")
        )

    @admin.display(description="Instructors")
    def instructors_count(self, obj):
        return obj.instructors.count()

    @admin.display(description="Enrollments")
    def enrollments_count(self, obj):
        return obj.enrollments.count()


@admin.register(Instructor)
class InstructorAdmin(VersionAdmin):
    list_display = (
        "last_name",
        "first_name",
        "patronymic",
        "academic_degree",
        "academic_title",
        "courses_count",
    )
    list_filter = ("academic_degree", "academic_title")
    search_fields = ("last_name", "first_name", "patronymic")
    ordering = ("last_name", "first_name")

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("course_offerings")

    @admin.display(description="Courses")
    def courses_count(self, obj):
        return obj.course_offerings.count()


@admin.register(Student)
class StudentAdmin(VersionAdmin):
    list_display = (
        "last_name",
        "first_name",
        "patronymic",
        "education_level",
        "speciality",
        "overall_rated_courses",
        "rated_courses_this_sem",
    )
    list_select_related = ("speciality", "user")
    list_filter = ("education_level", "speciality__faculty")
    search_fields = ("last_name", "first_name", "patronymic", "speciality__name")
    ordering = ("last_name", "first_name")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("speciality", "user")


@admin.register(Rating)
class RatingAdmin(VersionAdmin):
    list_display = (
        "course_offering",
        "student",
        "difficulty",
        "usefulness",
        "is_anonymous",
        "created_at",
    )
    list_select_related = ("student", "course_offering", "course_offering__course")
    list_filter = (
        "is_anonymous",
        "difficulty",
        "usefulness",
        "course_offering__course__department",
        "created_at",
    )
    search_fields = (
        "student__last_name",
        "student__first_name",
        "course_offering__course__title",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "student",
                "course_offering",
                "course_offering__course",
                "course_offering__course__department",
            )
        )


@admin.register(Semester)
class SemesterAdmin(VersionAdmin):
    list_display = ("year", "term", "course_offerings_count")
    list_filter = ("year", "term")
    ordering = ("-year", "-term")

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("course_offerings")

    @admin.display(description="Course Offerings")
    def course_offerings_count(self, obj):
        return obj.course_offerings.count()
